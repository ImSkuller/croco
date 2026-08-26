// Verifies three v2.0 milestone changes end-to-end against the real,
// compiled Croco app via tauri-driver + Microsoft Edge WebDriver — the same
// window.api.* bridge the React UI calls, hitting real Rust commands and
// real filesystem/git state, not mocks.
//
// 1. Favourites persistent ordering (favouriteRank field via projects.edit)
// 2. OS-aware keyboard shortcut display (no literal "Mod" token, "Ctrl" on Windows)
// 3. Selective git staging (git_stage_files/git_unstage_files + git_commit
//    only auto-staging everything when nothing is explicitly staged)
//
// Safety: settings.json is backed up before the run and restored byte-for-byte
// in the `finally` block. All test data lives under temporary directories.
//
// Run with: node e2e/verify-v2-milestones.mjs
// Requires a fresh `npm run tauri:build` and tauri-driver + msedgedriver on
// PATH (see .claude/skills/run-croco-e2e/SKILL.md).

import { Builder } from 'selenium-webdriver'
import { spawn, execSync } from 'node:child_process'
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

async function waitFor(fn, { timeoutMs = 6000, intervalMs = 150, label = 'condition' } = {}) {
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
  if (!result.ok) throw new Error(`window.api.${dotted}(${args.map(a => JSON.stringify(a)).join(', ')}) rejected: ${result.error}`)
  return result.value
}

async function waitForApiReady(driver) {
  let lastErr = null
  await waitFor(async () => {
    try { return await driver.executeScript('return !!window.api') } catch (e) { lastErr = e; return false }
  }, { timeoutMs: 20000, label: 'window.api to be ready' }).catch(e => {
    console.error('[e2e] last executeScript error:', lastErr?.message || lastErr)
    throw e
  })
}

function git(cwd, args) {
  return execSync(`git ${args}`, { cwd, encoding: 'utf8' }).trim()
}

async function main() {
  if (!fs.existsSync(appPath)) throw new Error(`App binary not found at ${appPath} — run \`npm run tauri:build\` first.`)
  if (!fs.existsSync(settingsPath)) throw new Error(`Croco settings.json not found at ${settingsPath} — launch the app once first.`)

  const originalSettings = fs.readFileSync(settingsPath, 'utf8')
  const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-data-'))
  const tmpProj1Dir = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-proj1-'))
  const tmpProj2Dir = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-proj2-'))
  const tmpGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-git-'))
  log(`temp data dir: ${tmpDataDir}`)

  const originalParsed = JSON.parse(originalSettings)
  const isolatedSettings = {
    ...originalParsed,
    app: { ...originalParsed.app, dataPath: tmpDataDir, storageBackend: 'json' },
  }
  fs.writeFileSync(settingsPath, JSON.stringify(isolatedSettings, null, 2))
  log('wrote isolated settings.json (temp dataPath, json backend) before launching the app')

  log('starting tauri-driver...')
  const driverLog = []
  const driverProc = spawn('tauri-driver', ['--port', String(DRIVER_PORT)], { stdio: ['ignore', 'pipe', 'pipe'] })
  driverProc.stdout.on('data', d => { driverLog.push(String(d)); if (process.env.E2E_VERBOSE) process.stdout.write(`[tauri-driver] ${d}`) })
  driverProc.stderr.on('data', d => { driverLog.push(String(d)); if (process.env.E2E_VERBOSE) process.stderr.write(`[tauri-driver] ${d}`) })
  await new Promise((resolve, reject) => {
    const onErr = e => reject(e)
    driverProc.once('error', onErr)
    setTimeout(() => { driverProc.off('error', onErr); resolve() }, 1500)
  })

  const results = { favourites: null, shortcuts: null, gitStaging: null }
  let driver
  try {
    log('opening WebDriver session (this launches the app)...')
    driver = await new Builder()
      .usingServer(`http://localhost:${DRIVER_PORT}`)
      .withCapabilities({ 'tauri:options': { application: appPath }, browserName: 'wry' })
      .build()

    await waitForApiReady(driver)
    assert(true, 'app launched and window.api is available')

    // ══════════════════════════════════════════════════════════════════════
    // 1. Favourites persistent ordering
    // ══════════════════════════════════════════════════════════════════════
    try {
      const p1 = await callApi(driver, 'projects.create', { name: 'E2E Fav A', path: tmpProj1Dir })
      const p2 = await callApi(driver, 'projects.create', { name: 'E2E Fav B', path: tmpProj2Dir })
      await callApi(driver, 'projects.toggleFavorite', p1.id)
      await callApi(driver, 'projects.toggleFavorite', p2.id)

      // Mirrors exactly what Favourites.jsx's persistOrder() does on drop:
      // write favouriteRank per project via the generic edit() command.
      await callApi(driver, 'projects.edit', p2.id, { favouriteRank: 0 })
      await callApi(driver, 'projects.edit', p1.id, { favouriteRank: 1 })

      const afterEdit = await callApi(driver, 'projects.getAll')
      const a1 = afterEdit.find(p => p.id === p1.id)
      const a2 = afterEdit.find(p => p.id === p2.id)
      assert(a2.favouriteRank === 0 && a1.favouriteRank === 1, 'favouriteRank fields round-trip through projects.getAll')

      // Independent proof: read the on-disk JSON file directly, bypassing
      // any in-memory PROJECTS_CACHE, to confirm it's actually persisted.
      const diskP1 = JSON.parse(fs.readFileSync(path.join(tmpDataDir, 'project-details', `${p1.id}.json`), 'utf8'))
      const diskP2 = JSON.parse(fs.readFileSync(path.join(tmpDataDir, 'project-details', `${p2.id}.json`), 'utf8'))
      assert(diskP1.favouriteRank === 1 && diskP2.favouriteRank === 0, 'favouriteRank written to disk (project-details/<id>.json), not just in-memory')

      // Full page reload (fresh React mount + fresh cache fetch) — proves
      // the ordering isn't component-local state, which was the original bug.
      await driver.navigate().refresh()
      await waitForApiReady(driver)
      const afterReload = await callApi(driver, 'projects.getAll')
      const r1 = afterReload.find(p => p.id === p1.id)
      const r2 = afterReload.find(p => p.id === p2.id)
      assert(r2.favouriteRank === 0 && r1.favouriteRank === 1, 'favouriteRank survives a full page reload')

      const sortedIds = [r1, r2].filter(p => p.favourite)
        .sort((a, b) => (a.favouriteRank ?? Infinity) - (b.favouriteRank ?? Infinity))
        .map(p => p.id)
      assert(sortedIds[0] === p2.id && sortedIds[1] === p1.id, 'sorting by favouriteRank reproduces the Favourites.jsx sort order (B before A)')

      results.favourites = { status: 'PASS' }
    } catch (e) {
      results.favourites = { status: 'FAIL', detail: e.message }
    }

    // ══════════════════════════════════════════════════════════════════════
    // 2. OS-aware keyboard shortcut display
    // ══════════════════════════════════════════════════════════════════════
    try {
      const platform = await driver.executeScript('return navigator.platform || navigator.userAgent')
      log(`webview reports platform: ${platform}`)

      const sidebarHint = await driver.executeScript(`
        const spans = Array.from(document.querySelectorAll('span'))
        const hit = spans.find(s => /^(Ctrl\\+K|⌘K)$/.test(s.textContent.trim()))
        return hit ? hit.textContent.trim() : null
      `)
      assert(sidebarHint === 'Ctrl+K', `sidebar search hint shows "Ctrl+K" on this Windows machine (got: ${JSON.stringify(sidebarHint)})`)

      // Open the shortcuts modal the same way the app does: a '?' keydown
      // dispatched on window (matches AppShell's global listener + guard).
      await driver.executeScript(`window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))`)
      await waitFor(async () => {
        const title = await driver.executeScript(`
          return Array.from(document.querySelectorAll('span')).some(s => s.textContent.trim() === 'Keyboard Shortcuts')
        `)
        return title || null
      }, { label: 'Keyboard Shortcuts modal to open' })

      const kbdTexts = await driver.executeScript(`return Array.from(document.querySelectorAll('kbd')).map(k => k.textContent.trim())`)
      log(`kbd tokens in modal: ${JSON.stringify(kbdTexts)}`)
      assert(!kbdTexts.includes('Mod'), 'no literal "Mod" token leaked into the rendered shortcuts modal')
      assert(kbdTexts.includes('Ctrl'), 'modal renders "Ctrl" tokens on Windows')

      // Close the modal (Escape) so it doesn't interfere with later steps.
      await driver.executeScript(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)

      results.shortcuts = { status: 'PASS', platform, sidebarHint, kbdTexts }
    } catch (e) {
      results.shortcuts = { status: 'FAIL', detail: e.message }
    }

    // ══════════════════════════════════════════════════════════════════════
    // 3. Selective git staging
    // ══════════════════════════════════════════════════════════════════════
    try {
      const gp = await callApi(driver, 'projects.create', { name: 'E2E Git Test', path: tmpGitDir })
      await callApi(driver, 'git.initRepo', gp.id)
      assert(fs.existsSync(path.join(tmpGitDir, '.git')), 'git repo initialized on disk')

      fs.writeFileSync(path.join(tmpGitDir, 'file1.txt'), 'hello from file1\n')
      fs.writeFileSync(path.join(tmpGitDir, 'file2.txt'), 'hello from file2\n')

      const s1 = await callApi(driver, 'git.status', gp.id)
      assert(s1.untracked.includes('file1.txt') && s1.untracked.includes('file2.txt'), 'both new files show as untracked')
      assert(s1.staged.length === 0, 'nothing staged yet')

      await callApi(driver, 'git.stageFiles', gp.id, ['file1.txt'])
      const s2 = await callApi(driver, 'git.status', gp.id)
      assert(s2.staged.includes('file1.txt') && !s2.staged.includes('file2.txt'), 'staging file1.txt only stages file1.txt')
      assert(s2.untracked.includes('file2.txt'), 'file2.txt remains untracked after staging only file1.txt')

      await callApi(driver, 'git.unstageFiles', gp.id, ['file1.txt'])
      const s3 = await callApi(driver, 'git.status', gp.id)
      assert(s3.staged.length === 0, 'unstageFiles moves file1.txt back out of staged')
      assert(s3.untracked.includes('file1.txt') && s3.untracked.includes('file2.txt'), 'both files untracked again after unstage')

      // Re-stage file1 only, then commit — the real test of selective commit.
      await callApi(driver, 'git.stageFiles', gp.id, ['file1.txt'])
      const commitR1 = await callApi(driver, 'git.commit', gp.id, 'Add file1 only')
      assert(commitR1.ok === true, 'commit with file1 staged succeeds')

      const filesInCommit1 = git(tmpGitDir, 'diff-tree --no-commit-id --name-only -r --root HEAD').split('\n').filter(Boolean)
      assert(filesInCommit1.length === 1 && filesInCommit1[0] === 'file1.txt', `commit contains ONLY file1.txt, not file2.txt (independently verified via real git, got: ${JSON.stringify(filesInCommit1)})`)

      const s4status = git(tmpGitDir, 'status --short')
      assert(s4status.includes('file2.txt') && !s4status.includes('file1.txt'), 'after commit, file2.txt is still untracked and file1.txt is clean (verified via real git status)')

      // Now test the fallback: committing with NOTHING staged should still
      // stage-and-commit everything (git_commit's `git add .` fallback path).
      const commitR2 = await callApi(driver, 'git.commit', gp.id, 'Add file2 via fallback')
      assert(commitR2.ok === true, 'commit with nothing staged succeeds via fallback')
      const filesInCommit2 = git(tmpGitDir, 'diff-tree --no-commit-id --name-only -r --root HEAD').split('\n').filter(Boolean)
      assert(filesInCommit2.includes('file2.txt'), `fallback commit (nothing pre-staged) picked up file2.txt via git add . (got: ${JSON.stringify(filesInCommit2)})`)

      // Multi-file stage in one call (what the "stage all" button does).
      fs.writeFileSync(path.join(tmpGitDir, 'file3.txt'), 'three\n')
      fs.writeFileSync(path.join(tmpGitDir, 'file4.txt'), 'four\n')
      await callApi(driver, 'git.stageFiles', gp.id, ['file3.txt', 'file4.txt'])
      const s5 = await callApi(driver, 'git.status', gp.id)
      assert(s5.staged.includes('file3.txt') && s5.staged.includes('file4.txt'), 'multi-file stageFiles (stage-all path) stages both files in one call')

      results.gitStaging = { status: 'PASS' }
    } catch (e) {
      results.gitStaging = { status: 'FAIL', detail: e.message }
    }

    log('DONE — see summary below')
  } finally {
    log('restoring original settings.json and shutting down...')
    try { if (driver) await driver.quit() } catch (e) { log(`driver.quit() error (non-fatal): ${e.message}`) }
    driverProc.kill()
    fs.writeFileSync(settingsPath, originalSettings)
    for (const d of [tmpDataDir, tmpProj1Dir, tmpProj2Dir, tmpGitDir]) {
      fs.rmSync(d, { recursive: true, force: true })
    }
  }

  console.log('\n===== SUMMARY =====')
  for (const [name, r] of Object.entries(results)) {
    console.log(`${name}: ${r?.status ?? 'NOT RUN'}${r?.detail ? ` — ${r.detail}` : ''}`)
  }
  const anyFail = Object.values(results).some(r => r?.status !== 'PASS')
  if (anyFail) process.exitCode = 1
}

main().catch(err => {
  console.error(`[e2e] FAILED: ${err.message}`)
  process.exitCode = 1
})
