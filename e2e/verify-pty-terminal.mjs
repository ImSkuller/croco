// Drives the real, compiled Croco app to verify the new interactive PTY
// terminal end to end: opens a project's Terminal tab, switches to Shell
// mode, and types a real command as real keyboard events into the real
// xterm.js-rendered terminal — confirming the real output comes back from
// a real spawned shell, not a mock of any part of the stack.
//
// Run with: node e2e/verify-pty-terminal.mjs
// Requires tauri-driver + a matching msedgedriver on PATH, and a fresh
// `npm run tauri:build` (see .claude/skills/run-croco-e2e/SKILL.md).

import { Builder, Key, By } from 'selenium-webdriver'
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

    // ── Real UI round-trip: open Shell mode, type a real command, see real
    // output — not window.api.pty called in isolation. That was tried
    // first and doesn't actually work: Windows' cmd.exe queries the
    // terminal for its cursor position (ESC [ 6 n) before doing anything
    // else, and blocks until it gets an answer. A real terminal emulator
    // (xterm.js, wired up exactly as InteractiveTerminal.jsx does via
    // term.onData -> pty.write) answers that automatically; calling
    // pty.spawn/pty.write directly with no xterm.js instance attached has
    // nothing to answer it, so the shell hangs forever — a real bug in
    // this test's original approach, not in the app. Driving the actual
    // UI exercises the real, correctly-paired code path instead.
    //
    // Collect pty:output events into a window-level buffer (no sessionId
    // filter — there's exactly one PTY session in this isolated e2e
    // profile, the one Shell mode itself spawns).
    await driver.executeScript(`
      window.__ptyBuf = ''
      window.api.pty.onOutput((p) => { window.__ptyBuf += p.data })
    `)

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

    // Interact with xterm's own hidden input element directly, via a real
    // WebDriver click + sendKeys (not a JS-dispatched .click(), which
    // doesn't reliably trigger xterm's internal focus-delegation to this
    // textarea the way a genuine mouse event does) — this is the exact
    // real DOM element a human typing into the terminal would be typing
    // into, and includes xterm.js's automatic handling of the shell's
    // cursor-position query that broke the earlier (bypassed-the-UI)
    // approach above.
    const input = await driver.findElement(By.css('.xterm-helper-textarea'))
    await input.click()
    const marker = `CROCO_E2E_${Date.now()}`
    await input.sendKeys(`echo ${marker}`, Key.ENTER)

    await waitFor(async () => driver.executeScript(`return window.__ptyBuf.includes(arguments[0])`, marker),
      { timeoutMs: 10000, label: 'a real command typed into the real terminal UI produces real output' }
    ).catch(async (err) => {
      const buf = await driver.executeScript(`return window.__ptyBuf`)
      console.error('[e2e] DIAGNOSTIC — full __ptyBuf captured so far:')
      console.error(JSON.stringify(buf))
      throw err
    })
    assert(true, 'typing a real command into the UI terminal round-tripped through a real shell')

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
