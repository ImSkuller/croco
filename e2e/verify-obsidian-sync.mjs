// Drives the real, compiled Croco app (via tauri-driver + Microsoft Edge
// WebDriver) to verify one-way Obsidian vault sync end-to-end: the same
// window.api.* bridge the React UI calls, hitting the real Rust commands and
// real filesystem writes — not a mock.
//
// Safety: settings.json is backed up before the run and restored byte-for-byte
// in the `finally` block, regardless of pass/fail. Notes created during the
// test live under a temporary settings.app.dataPath, never the user's real
// notes folder. The already-installed Croco instance is untouched — this
// spawns its own throwaway process via tauri-driver.
//
// Run with: node e2e/verify-obsidian-sync.mjs
// Requires tauri-driver + a matching msedgedriver on PATH (see
// .claude/skills/run-croco-e2e/SKILL.md for the one-time setup).

import { Builder } from 'selenium-webdriver'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
// A release build is required, not a debug one: Tauri debug builds try to
// load the frontend from `devUrl` (the vite dev server), so launching a
// debug exe standalone (no dev server running) fails with a chrome-error
// "connection refused" page and window.api never gets set. Release builds
// always load the bundled `frontendDist` assets, so they run standalone.
const appPath = path.join(repoRoot, 'src-tauri', 'target', 'release', 'croco.exe')
const settingsPath = path.join(process.env.APPDATA, 'xyz.skuller.croco', 'settings.json')
const DRIVER_PORT = 4444

function log(msg) { console.log(`[e2e] ${msg}`) }

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`)
  log(`ok: ${msg}`)
}

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

// Runs `window.api.<dotted.path>(...args)` inside the live webview and
// resolves/rejects with the real promise result — executeScript alone
// wouldn't wait for the invoke() promise, so this uses executeAsyncScript.
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

function findMdFile(dir, predicate) {
  if (!fs.existsSync(dir)) return null
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    const full = path.join(entry.parentPath ?? dir, entry.name)
    const content = fs.readFileSync(full, 'utf8')
    if (predicate(content, full)) return { path: full, content }
  }
  return null
}

async function main() {
  if (!fs.existsSync(appPath)) throw new Error(`App binary not found at ${appPath} — run \`npm run tauri:build\` first (a plain \`cargo build --release\` is not enough, see .claude/skills/run-croco-e2e/SKILL.md).`)
  if (!fs.existsSync(settingsPath)) throw new Error(`Croco settings.json not found at ${settingsPath} — launch the app once first.`)

  const originalSettings = fs.readFileSync(settingsPath, 'utf8')
  const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-data-'))
  const tmpVaultDir = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-vault-'))
  log(`temp data dir:  ${tmpDataDir}`)
  log(`temp vault dir: ${tmpVaultDir}`)

  // IMPORTANT: Croco caches its SQLite connection in a process-lifetime
  // static (main.rs `DB`) the first time any command opens it, and never
  // reopens it even if settings.app.dataPath changes afterwards (the app's
  // own Storage UI requires a full restart to switch backends/paths for
  // exactly this reason). So the dataPath/vault override must be written
  // into settings.json BEFORE the app process starts, not sent as a
  // settings.update() call after boot — otherwise, for SQLite-backed
  // installs, every note operation would silently keep hitting the real
  // database despite the override "succeeding".
  const originalParsed = JSON.parse(originalSettings)
  const isolatedSettings = {
    ...originalParsed,
    app: {
      ...originalParsed.app,
      dataPath: tmpDataDir,
      obsidian: { enabled: true, vaultPath: tmpVaultDir, lastSyncAt: null },
    },
  }
  fs.writeFileSync(settingsPath, JSON.stringify(isolatedSettings, null, 2))
  log('wrote isolated settings.json (temp dataPath + vault) before launching the app')

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

  let driver
  try {
    log('opening WebDriver session (this launches the app)...')
    driver = await new Builder()
      .usingServer(`http://localhost:${DRIVER_PORT}`)
      .withCapabilities({ 'tauri:options': { application: appPath }, browserName: 'wry' })
      .build()

    // Give the frontend a moment to finish mounting and set window.api.
    let lastErr = null
    await waitFor(async () => {
      try { return await driver.executeScript('return !!window.api') } catch (e) { lastErr = e; return false }
    }, { timeoutMs: 20000, label: 'window.api to be ready' }).catch(async e => {
      console.error('[e2e] tauri-driver output so far:\n' + driverLog.join(''))
      console.error('[e2e] last executeScript error:', lastErr?.message || lastErr)
      try {
        const diag = await driver.executeScript(`return {
          title: document.title, readyState: document.readyState,
          bodyLen: document.body ? document.body.innerHTML.length : -1,
          bodySnippet: document.body ? document.body.innerHTML.slice(0, 500) : null,
          hasTauriInternals: !!window.__TAURI_INTERNALS__,
          url: location.href,
        }`)
        console.error('[e2e] page diagnostic:', JSON.stringify(diag, null, 2))
      } catch (diagErr) {
        console.error('[e2e] could not even run diagnostic script:', diagErr.message)
      }
      throw e
    })
    assert(true, 'app launched and window.api is available')

    // Sanity check that isolation actually took effect for THIS backend
    // (json vs sqlite) before trusting any of the assertions below.
    const preExisting = await callApi(driver, 'notes.getAll', null)
    assert(preExisting.length === 0, `isolated store starts empty (found ${preExisting.length} notes — dataPath override did not take effect!)`)

    // ── 1. Create ────────────────────────────────────────────────────────
    const note = await callApi(driver, 'notes.create', { title: 'E2E Test Note', content: 'Hello world', tags: ['test'] })
    const globalDir = path.join(tmpVaultDir, '_global')
    const created = await waitFor(
      () => findMdFile(globalDir, c => c.includes(`croco_id: ${note.id}`)),
      { label: 'vault file for newly created note' }
    )
    assert(path.basename(created.path) === 'e2e-test-note.md', `filename slugified from title (got ${path.basename(created.path)})`)
    assert(created.content.includes('title: E2E Test Note'), 'frontmatter has correct title')
    assert(created.content.includes('formatVersion: 1'), 'frontmatter has formatVersion')
    assert(created.content.includes('Hello world'), 'body content present')

    // ── 2. Rename ────────────────────────────────────────────────────────
    await callApi(driver, 'notes.update', note.id, { title: 'Renamed Note' })
    const renamed = await waitFor(
      () => findMdFile(globalDir, c => c.includes(`croco_id: ${note.id}`) && c.includes('title: Renamed Note')),
      { label: 'vault file renamed after title edit' }
    )
    assert(path.basename(renamed.path) === 'renamed-note.md', `renamed file uses new slug (got ${path.basename(renamed.path)})`)
    assert(!fs.existsSync(created.path), 'old filename no longer exists (renamed in place, not duplicated)')
    const filesAfterRename = fs.readdirSync(globalDir).filter(f => f.endsWith('.md'))
    assert(filesAfterRename.length === 1, `exactly one file for this note after rename (found ${filesAfterRename.length})`)

    // ── 3. Archive / unarchive ───────────────────────────────────────────
    await callApi(driver, 'notes.update', note.id, { archived: true })
    await waitFor(async () => {
      const c = fs.readFileSync(renamed.path, 'utf8')
      return c.includes('archived: true') || null
    }, { label: 'frontmatter archived flips to true' })
    assert(fs.existsSync(renamed.path), 'file stays in place on archive (no move/delete)')

    await callApi(driver, 'notes.update', note.id, { archived: false })
    await waitFor(async () => {
      const c = fs.readFileSync(renamed.path, 'utf8')
      return c.includes('archived: false') || null
    }, { label: 'frontmatter archived flips back to false' })

    // ── 4. Delete ────────────────────────────────────────────────────────
    await callApi(driver, 'notes.delete', note.id)
    await waitFor(() => !fs.existsSync(renamed.path), { label: 'vault file removed after note deletion' })

    // ── 5. Bulk sync (Sync Now) ──────────────────────────────────────────
    const bulkNote = await callApi(driver, 'notes.create', { title: 'Bulk Sync Note', content: 'Backfill me' })
    const bulkFile = await waitFor(
      () => findMdFile(globalDir, c => c.includes(`croco_id: ${bulkNote.id}`)),
      { label: 'vault file for bulk-sync note' }
    )
    fs.rmSync(bulkFile.path) // simulate a vault missing this note (fresh vault / re-pointed folder)
    assert(!fs.existsSync(bulkFile.path), 'vault file removed to simulate an out-of-sync vault')

    const syncResult = await callApi(driver, 'obsidian.syncAll')
    assert(syncResult.synced >= 1, `obsidian_sync_all reports synced >= 1 (got ${syncResult.synced})`)
    assert(syncResult.failed === 0, `obsidian_sync_all reports 0 failures (got ${syncResult.failed})`)
    const backfilled = findMdFile(globalDir, c => c.includes(`croco_id: ${bulkNote.id}`))
    assert(!!backfilled, 'Sync Now backfilled the missing vault file')

    await callApi(driver, 'notes.delete', bulkNote.id)

    log('ALL CHECKS PASSED')
  } finally {
    log('restoring original settings.json and shutting down...')
    try { if (driver) await driver.quit() } catch (e) { log(`driver.quit() error (non-fatal): ${e.message}`) }
    driverProc.kill()
    fs.writeFileSync(settingsPath, originalSettings)
    fs.rmSync(tmpDataDir, { recursive: true, force: true })
    fs.rmSync(tmpVaultDir, { recursive: true, force: true })
  }
}

main().catch(err => {
  console.error(`[e2e] FAILED: ${err.message}`)
  process.exitCode = 1
})
