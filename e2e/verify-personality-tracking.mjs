// Drives the real, compiled Croco app to verify work-habits tracking
// ("personality monitoring") end-to-end: real window.api.* calls hitting
// the real Rust track()/personality_get_profile commands and real
// habits.json writes — not a mock. See e2e/verify-obsidian-sync.mjs for the
// original version of this pattern and .claude/skills/run-croco-e2e/SKILL.md
// for the full recipe and hard-won gotchas (release build required; SQLite
// installs need the dataPath override written into settings.json BEFORE the
// app launches, not sent via API after boot).
//
// Scope: this covers notes/todos tracking (note_created, todo_created,
// todo_completed) via direct window.api calls. Commit tracking and
// project-open tracking are NOT covered here — simulating a real git repo
// + commit safely through this harness is a bigger lift than this pass
// warrants; personality.rs's own Rust unit tests already cover the pure
// increment/bucket logic those paths share.
//
// Run with: node e2e/verify-personality-tracking.mjs

import { Builder } from 'selenium-webdriver'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const appPath = path.join(repoRoot, 'src-tauri', 'target', 'release', 'croco.exe')
const settingsPath = path.join(process.env.APPDATA, 'xyz.skuller.croco', 'settings.json')
const DRIVER_PORT = 4444

function log(msg) { console.log(`[e2e] ${msg}`) }

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`)
  log(`ok: ${msg}`)
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
  if (!result.ok) throw new Error(`window.api.${dotted}(${args.map(a => JSON.stringify(a)).join(', ')}) rejected: ${result.error}`)
  return result.value
}

async function waitForApiReady(driver, timeoutMs = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try { if (await driver.executeScript('return !!window.api')) return } catch { /* keep polling */ }
    await new Promise(r => setTimeout(r, 200))
  }
  throw new Error('Timed out waiting for window.api to be ready')
}

async function main() {
  if (!fs.existsSync(appPath)) throw new Error(`App binary not found at ${appPath} — run \`npm run tauri:build\` first.`)
  if (!fs.existsSync(settingsPath)) throw new Error(`Croco settings.json not found at ${settingsPath} — launch the app once first.`)

  const originalSettings = fs.readFileSync(settingsPath, 'utf8')
  const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-data-'))
  log(`temp data dir: ${tmpDataDir}`)

  // See SKILL.md: for SQLite-backed installs the override must be written
  // BEFORE the app boots, since the SQLite connection is a process-lifetime
  // static that's never reopened.
  const originalParsed = JSON.parse(originalSettings)
  const isolatedSettings = { ...originalParsed, app: { ...originalParsed.app, dataPath: tmpDataDir } }
  fs.writeFileSync(settingsPath, JSON.stringify(isolatedSettings, null, 2))
  log('wrote isolated settings.json (temp dataPath) before launching the app')

  const driverProc = spawn('tauri-driver', ['--port', String(DRIVER_PORT)], { stdio: ['ignore', 'pipe', 'pipe'] })
  await new Promise((resolve, reject) => {
    const onErr = e => reject(e)
    driverProc.once('error', onErr)
    setTimeout(() => { driverProc.off('error', onErr); resolve() }, 1500)
  })

  let driver
  try {
    driver = await new Builder()
      .usingServer(`http://localhost:${DRIVER_PORT}`)
      .withCapabilities({ 'tauri:options': { application: appPath }, browserName: 'wry' })
      .build()

    await waitForApiReady(driver)
    assert(true, 'app launched and window.api is available')

    const startProfile = await callApi(driver, 'personality.getProfile')
    assert(startProfile.totalCommits === 0, 'isolated profile starts with 0 commits')
    assert(startProfile.notesCreated === 0, 'isolated profile starts with 0 notes')
    assert(startProfile.todosCreated === 0, 'isolated profile starts with 0 todos')
    assert(Array.isArray(startProfile.commitsByHour) && startProfile.commitsByHour.length === 24, 'commitsByHour has 24 buckets')
    assert(Array.isArray(startProfile.commitsByWeekday) && startProfile.commitsByWeekday.length === 7, 'commitsByWeekday has 7 buckets')

    // ── Notes tracking ──────────────────────────────────────────────────
    await callApi(driver, 'notes.create', { title: 'Habit test note', content: 'hi' })
    await callApi(driver, 'notes.create', { title: 'Second note', content: 'hi again' })
    const afterNotes = await callApi(driver, 'personality.getProfile')
    assert(afterNotes.notesCreated === 2, `notesCreated incremented to 2 (got ${afterNotes.notesCreated})`)
    assert(afterNotes.notesByWeekday.reduce((a, b) => a + b, 0) === 2, 'notesByWeekday sums to 2')

    // ── Todos tracking ──────────────────────────────────────────────────
    const todo1 = await callApi(driver, 'todos.create', { title: 'Habit test todo 1' })
    await callApi(driver, 'todos.create', { title: 'Habit test todo 2' })
    const afterTodoCreate = await callApi(driver, 'personality.getProfile')
    assert(afterTodoCreate.todosCreated === 2, `todosCreated incremented to 2 (got ${afterTodoCreate.todosCreated})`)
    assert(afterTodoCreate.todosCompleted === 0, 'todosCompleted still 0 before any completion')

    await callApi(driver, 'todos.toggle', todo1.id) // complete
    const afterComplete = await callApi(driver, 'personality.getProfile')
    assert(afterComplete.todosCompleted === 1, `todosCompleted incremented to 1 after toggle (got ${afterComplete.todosCompleted})`)

    await callApi(driver, 'todos.toggle', todo1.id) // revert — should NOT decrement (accumulator, not a live count)
    const afterRevert = await callApi(driver, 'personality.getProfile')
    assert(afterRevert.todosCompleted === 1, 'todosCompleted does not decrement on revert (durable counter, not a live gauge)')

    // ── Backfill idempotency ─────────────────────────────────────────────
    const beforeBackfill = await callApi(driver, 'personality.getProfile')
    const backfillResult = await callApi(driver, 'personality.backfillFromActivity')
    assert(backfillResult.notesCreated === beforeBackfill.notesCreated, 'backfill is a no-op once already seeded (notesCreated unchanged)')
    assert(backfillResult.todosCreated === beforeBackfill.todosCreated, 'backfill is a no-op once already seeded (todosCreated unchanged)')

    log('ALL CHECKS PASSED')
  } finally {
    log('restoring original settings.json and shutting down...')
    try { if (driver) await driver.quit() } catch (e) { log(`driver.quit() error (non-fatal): ${e.message}`) }
    driverProc.kill()
    fs.writeFileSync(settingsPath, originalSettings)
    fs.rmSync(tmpDataDir, { recursive: true, force: true })
  }
}

main().catch(err => {
  console.error(`[e2e] FAILED: ${err.message}`)
  process.exitCode = 1
})
