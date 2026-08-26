// Drives the real, compiled Croco app (via tauri-driver + Microsoft Edge
// WebDriver) to verify the Schedules & Deadlines feature end-to-end: the
// same window.api.* bridge the React UI calls, hitting the real Rust
// commands and real filesystem writes — not a mock.
//
// Safety: settings.json is backed up before the run and restored byte-for-byte
// in the `finally` block. All data created during the test lives under a
// temporary settings.app.dataPath, never the user's real data folder.
//
// Run with: node e2e/verify-schedules.mjs
// Requires tauri-driver + a matching msedgedriver on PATH (see
// .claude/skills/run-croco-e2e/SKILL.md for the one-time setup) and a
// release build: npm run tauri:build

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
const DRIVER_PORT = 4445

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

async function main() {
  if (!fs.existsSync(appPath)) throw new Error(`App binary not found at ${appPath} — run \`npm run tauri:build\` first.`)
  if (!fs.existsSync(settingsPath)) throw new Error(`Croco settings.json not found at ${settingsPath} — launch the app once first.`)

  const originalSettings = fs.readFileSync(settingsPath, 'utf8')
  const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-schedules-'))
  log(`temp data dir: ${tmpDataDir}`)

  const originalParsed = JSON.parse(originalSettings)
  const isolatedSettings = { ...originalParsed, app: { ...originalParsed.app, dataPath: tmpDataDir } }
  fs.writeFileSync(settingsPath, JSON.stringify(isolatedSettings, null, 2))
  log('wrote isolated settings.json (temp dataPath) before launching the app')

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

    let lastErr = null
    await waitFor(async () => {
      try { return await driver.executeScript('return !!window.api') } catch (e) { lastErr = e; return false }
    }, { timeoutMs: 20000, label: 'window.api to be ready' }).catch(e => {
      console.error('[e2e] tauri-driver output so far:\n' + driverLog.join(''))
      console.error('[e2e] last executeScript error:', lastErr?.message || lastErr)
      throw e
    })
    assert(true, 'app launched and window.api is available')

    const preExisting = await callApi(driver, 'schedules.getAll', null)
    assert(preExisting.length === 0, `isolated store starts empty (found ${preExisting.length} schedules)`)

    // ── 1. Create a note to attach ───────────────────────────────────────
    const note = await callApi(driver, 'notes.create', { title: 'Tax docs', content: 'checklist' })

    // ── 2. Create a schedule with description, priority, due date/time, note ──
    const created = await callApi(driver, 'schedules.create', {
      title: 'Submit tax filing',
      description: 'Gather W-2s and file before the deadline.',
      priority: 'high',
      dueDate: '2030-04-15',
      dueTime: '17:00',
      noteIds: [note.id],
    })
    assert(created.title === 'Submit tax filing', 'schedule created with correct title')
    assert(created.description.includes('W-2'), 'description persisted')
    assert(created.priority === 'high', 'priority persisted')
    assert(created.dueDate === '2030-04-15' && created.dueTime === '17:00', 'due date+time persisted')
    assert(Array.isArray(created.noteIds) && created.noteIds.includes(note.id), 'attached note persisted')
    assert(created.completed === false, 'starts incomplete')

    // ── 3. Read back via getAll / getById ────────────────────────────────
    const all = await callApi(driver, 'schedules.getAll', null)
    assert(all.length === 1 && all[0].id === created.id, 'getAll returns the created schedule')
    const byId = await callApi(driver, 'schedules.getById', created.id)
    assert(byId && byId.id === created.id, 'getById returns the same schedule')

    // ── 4. Update ─────────────────────────────────────────────────────────
    const updated = await callApi(driver, 'schedules.update', created.id, { priority: 'low', description: 'Filed early this year.' })
    assert(updated.priority === 'low', 'priority updated')
    assert(updated.description === 'Filed early this year.', 'description updated')

    // ── 5. Toggle complete / revert ──────────────────────────────────────
    const completed = await callApi(driver, 'schedules.toggle', created.id)
    assert(completed.completed === true, 'toggle marks complete')
    assert(!!completed.completedAt, 'completedAt set on completion')
    const reverted = await callApi(driver, 'schedules.toggle', created.id)
    assert(reverted.completed === false, 'toggle again reverts to incomplete')
    assert(reverted.completedAt === null, 'completedAt cleared on revert')

    // ── 6. Delete ─────────────────────────────────────────────────────────
    await callApi(driver, 'schedules.delete', created.id)
    const afterDelete = await callApi(driver, 'schedules.getAll', null)
    assert(afterDelete.length === 0, 'schedule removed after delete')

    // ── 7. Clean up the attached note ────────────────────────────────────
    await callApi(driver, 'notes.delete', note.id)

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
