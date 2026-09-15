// Drives the real, compiled Croco app to verify the new interactive PTY
// terminal end to end: spawns a real shell via window.api.pty.spawn,
// writes a real command into it, and confirms the real output comes back
// over pty:output — not a mock. Also checks the Shell mode actually mounts
// in the UI (xterm.js renders) without crashing.
//
// Run with: node e2e/verify-pty-terminal.mjs
// Requires tauri-driver + a matching msedgedriver on PATH, and a fresh
// `npm run tauri:build` (see .claude/skills/run-croco-e2e/SKILL.md).

import { Builder } from 'selenium-webdriver'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const appPath = path.join(repoRoot, 'src-tauri', 'target', 'release', 'croco.exe')
const DRIVER_PORT = 4449

function log(msg) { console.log(`[e2e] ${msg}`) }
function assert(cond, msg) { if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`); log(`ok: ${msg}`) }

async function waitFor(fn, { timeoutMs = 8000, intervalMs = 200, label = 'condition' } = {}) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const v = await fn()
    if (v) return v
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error(`Timed out waiting for: ${label}`)
}

async function callApi(driver, dotted, ...args) {
  const result = await driver.executeAsyncScript(
    function (dotted, args, callback) {
      const fn = dotted.split('.').reduce((o, k) => o[k], window.api)
      fn(...args).then(value => callback({ ok: true, value })).catch(err => callback({ ok: false, error: err?.message || String(err) }))
    },
    dotted, args
  )
  if (!result.ok) throw new Error(`window.api.${dotted}(...) rejected: ${result.error}`)
  return result.value
}

async function main() {
  if (!fs.existsSync(appPath)) throw new Error(`App binary not found at ${appPath} — run \`npm run tauri:build\` first.`)

  const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-pty-data-'))
  const tmpProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-pty-proj-'))
  fs.writeFileSync(path.join(tmpProjectDir, 'readme.txt'), 'hello\n')
  log(`temp data dir:    ${tmpDataDir}`)
  log(`temp project dir: ${tmpProjectDir}`)

  fs.writeFileSync(path.join(tmpDataDir, 'settings.json'), JSON.stringify({ app: { onboarded: true, dataPath: tmpDataDir } }, null, 2))

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

    await waitFor(async () => { try { return await driver.executeScript('return !!window.api') } catch { return false } },
      { timeoutMs: 20000, label: 'window.api to be ready' })
    assert(true, 'app launched and window.api is available')

    const project = await callApi(driver, 'projects.import', tmpProjectDir, {})
    assert(!!project?.id, 'project imported')

    // ── Backend round-trip: real shell, real command, real output ────────
    // Collect pty:output events into a window-level buffer via a listener
    // registered from inside the webview, since events arrive
    // asynchronously and executeAsyncScript can only await one round-trip.
    await driver.executeScript(`
      window.__ptyBuf = ''
      window.__ptyUnlisten = null
      window.api.pty.onOutput((p) => { if (p.sessionId === window.__ptySessionId) window.__ptyBuf += p.data })
    `)
    const sessionId = await callApi(driver, 'pty.spawn', project.id, 80, 24)
    assert(!!sessionId, `pty session spawned (id: ${sessionId})`)
    await driver.executeScript((sid) => { window.__ptySessionId = sid }, sessionId)

    // A distinctive marker so this exact echo can't be confused with shell
    // startup banner/prompt noise.
    const marker = `CROCO_E2E_${Date.now()}`
    await callApi(driver, 'pty.write', sessionId, `echo ${marker}\r`)

    await waitFor(async () => driver.executeScript(`return window.__ptyBuf.includes(arguments[0])`, marker),
      { timeoutMs: 8000, label: 'typed command’s real output arrives over pty:output' })
    assert(true, 'a real command typed into the PTY produced real output')

    await callApi(driver, 'pty.kill', sessionId)
    log('killed pty session')

    // ── UI: Shell mode actually mounts xterm.js without crashing ─────────
    await driver.executeScript((id) => { location.hash = '#/projects/' + id }, project.id)
    await waitFor(async () => driver.executeScript(`return Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'Terminal')`),
      { label: 'project page tab bar renders with a Terminal tab' })
    await driver.executeScript(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Terminal').click()`)
    await waitFor(async () => driver.executeScript(`return Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'Shell')`),
      { label: 'Scripts/Shell toggle renders' })
    await driver.executeScript(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Shell').click()`)

    await waitFor(async () => driver.executeScript(`return !!document.querySelector('.xterm')`),
      { timeoutMs: 8000, label: 'xterm.js mounts a real terminal viewport in Shell mode' })
    assert(true, 'Shell mode mounted xterm.js successfully')

    const statusText = await waitFor(async () => {
      const t = await driver.executeScript(`
        const el = Array.from(document.querySelectorAll('span')).find(s => s.textContent.includes('shell running') || s.textContent.includes('could not start'))
        return el ? el.textContent : null
      `)
      return t
    }, { timeoutMs: 8000, label: 'terminal status line reports running or a clear error' })
    assert(statusText.includes('shell running'), `UI-mounted terminal actually started a real shell (status: "${statusText}")`)

    log('ALL CHECKS PASSED')
  } finally {
    log('shutting down...')
    try { if (driver) await driver.quit() } catch (e) { log(`driver.quit() error (non-fatal): ${e.message}`) }
    driverProc.kill()
    await new Promise(r => setTimeout(r, 1500))
    fs.rmSync(tmpDataDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 400 })
    fs.rmSync(tmpProjectDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 400 })
  }
}

main().catch(err => {
  console.error(`[e2e] FAILED: ${err.message}`)
  process.exitCode = 1
})
