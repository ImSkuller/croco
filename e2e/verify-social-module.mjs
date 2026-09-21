// Drives the real, compiled Croco app to verify the social module
// (docs/social/*.md, src-tauri/src/social.rs): settings defaults and
// persistence, and that every new window.api.social.* command is wired
// through real Tauri IPC end-to-end and fails *gracefully* rather than
// hanging or crashing — the actual current state of the world, since
// croco-server isn't deployed yet (see docs/social/00-index.md's
// blocker list). This does NOT exercise a live social backend — that
// needs a real deployed server and a real GitHub test account, neither
// of which exist yet. What it verifies instead: the module-off default,
// settings persistence for the new modules.social shape, and that the
// entire client-side command surface degrades correctly (clean "not
// logged in" / network errors, never a hang or an unhandled panic)
// when there's nothing to talk to — exactly what a real user hits today
// if they turn the module on before it's deployed.
//
// Same pattern as e2e/verify-modules.mjs — see that file's header and
// .claude/skills/run-croco-e2e/SKILL.md for the one-time setup and the
// "why a release build" / "why isolate settings.json before launch"
// gotchas this script relies on.
//
// Run with: node e2e/verify-social-module.mjs

import { Builder } from 'selenium-webdriver'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const appPath = path.join(repoRoot, 'src-tauri', 'target', 'release', 'croco.exe')
const DRIVER_PORT = 4741 // distinct from every other script's port — see the others' own comments on why

function log(msg) { console.log(`[e2e] ${msg}`) }
function assert(cond, msg) { if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`); log(`ok: ${msg}`) }

async function waitFor(fn, { timeoutMs = 4000, intervalMs = 150, label = 'condition' } = {}) {
  const start = Date.now()
  let last
  while (Date.now() - start < timeoutMs) {
    last = await fn()
    if (last) return last
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error(`Timed out waiting for: ${label}`)
}

async function callApi(driver, dotted, ...args) {
  const result = await driver.executeAsyncScript(
    function (dotted, args, callback) {
      const fn = dotted.split('.').reduce((o, k) => o[k], window.api)
      fn(...args)
        .then(value => callback({ ok: true, value }))
        .catch(err => callback({ ok: false, error: err?.message || String(err) }))
    },
    dotted, args
  )
  return result
}
async function callApiOk(driver, dotted, ...args) {
  const r = await callApi(driver, dotted, ...args)
  if (!r.ok) throw new Error(`window.api.${dotted}(${args.map(a => JSON.stringify(a)).join(', ')}) rejected: ${r.error}`)
  return r.value
}

// Calls that need a valid session must fail with this exact message
// (ensure_session_token in entitlements.rs) BEFORE ever attempting a
// network call, since there's no stored GitHub token in a fresh
// isolated e2e profile — these should resolve near-instantly, not wait
// on any timeout.
const NOT_LOGGED_IN = /not logged in with github/i

async function assertRejectsNotLoggedIn(driver, dotted, ...args) {
  const started = Date.now()
  const r = await callApi(driver, dotted, ...args)
  const elapsedMs = Date.now() - started
  assert(r.ok === false, `${dotted} rejects with no GitHub login`)
  assert(NOT_LOGGED_IN.test(r.error), `${dotted} error message is the clean "not logged in" one (got "${r.error}")`)
  assert(elapsedMs < 3000, `${dotted} fails fast (no network attempt before the login check) — took ${elapsedMs}ms`)
}

async function main() {
  if (!fs.existsSync(appPath)) throw new Error(`App binary not found at ${appPath} — run \`npm run tauri:build\` first.`)

  const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-social-data-'))
  log(`temp data dir: ${tmpDataDir}`)

  const isolatedSettings = { app: { onboarded: true, dataPath: tmpDataDir } }
  fs.writeFileSync(path.join(tmpDataDir, 'settings.json'), JSON.stringify(isolatedSettings, null, 2))
  log('wrote isolated settings.json (temp dataPath) before launching the app')

  log('starting tauri-driver...')
  const driverProc = spawn('tauri-driver', ['--port', String(DRIVER_PORT)], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CROCO_DATA_DIR: tmpDataDir } })
  driverProc.stdout.on('data', d => { if (process.env.E2E_VERBOSE) process.stdout.write(`[tauri-driver] ${d}`) })
  driverProc.stderr.on('data', d => { if (process.env.E2E_VERBOSE) process.stderr.write(`[tauri-driver] ${d}`) })
  await new Promise((resolve, reject) => {
    const onErr = e => reject(e)
    driverProc.once('error', onErr)
    setTimeout(() => { driverProc.off('error', onErr); resolve() }, 1500)
  })

  let driver
  try {
    log('opening WebDriver session (this launches the app)...')
    driver = await new Builder()
      .usingServer(`http://localhost:${DRIVER_PORT}`)
      .withCapabilities({ 'tauri:options': { application: appPath }, browserName: 'wry' })
      .build()

    await waitFor(async () => {
      try { return await driver.executeScript('return !!window.api') } catch { return false }
    }, { timeoutMs: 20000, label: 'window.api to be ready' })
    assert(true, 'app launched and window.api is available')

    // ── Module is off by default, with the documented default sub-settings ──
    const settingsInitial = await callApiOk(driver, 'settings.get')
    assert(settingsInitial.modules.social.enabled === false, 'social module is off by default')
    assert(settingsInitial.modules.social.feed.defaultSort === 'algorithmic', 'default feed sort is algorithmic')
    assert(settingsInitial.modules.social.streak.includeGithubActivity === false, 'GitHub-activity streak opt-in is off by default')

    // ── Module toggle + sub-settings persist ──────────────────────────────
    await callApiOk(driver, 'settings.update', {
      modules: { social: { enabled: true, feed: { defaultSort: 'chrono' }, streak: { includeGithubActivity: true } } },
    })
    const settingsAfter = await callApiOk(driver, 'settings.get')
    assert(settingsAfter.modules.social.enabled === true, 'social module enabled persisted')
    assert(settingsAfter.modules.social.feed.defaultSort === 'chrono', 'feed.defaultSort persisted')
    assert(settingsAfter.modules.social.streak.includeGithubActivity === true, 'streak.includeGithubActivity persisted')

    // ── Every session-requiring command fails fast and cleanly with no
    //    GitHub login, rather than hanging or throwing something opaque ──
    await assertRejectsNotLoggedIn(driver, 'social.getMe')
    await assertRejectsNotLoggedIn(driver, 'social.getStreak')
    await assertRejectsNotLoggedIn(driver, 'social.checkGithubStreak')
    await assertRejectsNotLoggedIn(driver, 'social.getFeed', 'following')
    await assertRejectsNotLoggedIn(driver, 'social.search', 'test')
    await assertRejectsNotLoggedIn(driver, 'social.suggestedUsers')
    await assertRejectsNotLoggedIn(driver, 'social.createPost', { bodyText: 'e2e test post' })
    await assertRejectsNotLoggedIn(driver, 'social.likePost', 'fake-post-id')
    await assertRejectsNotLoggedIn(driver, 'social.follow', 'someone')
    await assertRejectsNotLoggedIn(driver, 'social.listNotifications')
    await assertRejectsNotLoggedIn(driver, 'social.createLaunch', { tagline: 'e2e', category: 'dev-tools' })
    await assertRejectsNotLoggedIn(driver, 'social.listLaunches')
    await assertRejectsNotLoggedIn(driver, 'social.createReport', 'post', 'fake-id', 'spam')

    // ── The one unauthenticated command (public profile read) still
    //    fails cleanly — the real server isn't deployed, so this hits a
    //    DNS/connect failure, not a crash or an indefinite hang. Bounded
    //    by the 15s timeout set in social.rs's public_request(). ─────────
    const publicProfileStarted = Date.now()
    const publicProfile = await callApi(driver, 'social.getPublicProfile', 'someone')
    const publicProfileElapsedMs = Date.now() - publicProfileStarted
    assert(publicProfile.ok === false, 'social_get_public_profile fails cleanly when croco-server is unreachable')
    assert(publicProfileElapsedMs < 16000, `social_get_public_profile respects its own timeout rather than hanging (took ${publicProfileElapsedMs}ms)`)

    // ── Turning the module back off doesn't affect stored settings for
    //    other modules and the toggle itself still round-trips ───────────
    await callApiOk(driver, 'settings.update', { modules: { social: { enabled: false } } })
    const settingsOff = await callApiOk(driver, 'settings.get')
    assert(settingsOff.modules.social.enabled === false, 'social module disables cleanly')
    assert(settingsOff.modules.social.feed.defaultSort === 'chrono', 'disabling the module does not reset its other sub-settings')

    log('ALL CHECKS PASSED')
  } finally {
    log('cleaning up...')
    try { if (driver) await driver.quit() } catch (e) { log(`driver.quit() error (non-fatal): ${e.message}`) }
    driverProc.kill()
    fs.rmSync(tmpDataDir, { recursive: true, force: true })
  }
}

main().catch(err => {
  console.error(`[e2e] FAILED: ${err.message}`)
  process.exitCode = 1
})
