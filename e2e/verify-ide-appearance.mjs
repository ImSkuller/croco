// Drives the real, compiled Croco app to verify the v2.0 IDE-redesign +
// appearance changes: Smooth Animations toggle mechanics, the Sidebar
// Position swap (and the IDE explorer-side setting that follows it), the
// Catppuccin Mocha Monaco theme actually rendering, and Ctrl+P quick-open.
//
// Run with: node e2e/verify-ide-appearance.mjs
// Requires tauri-driver + a matching msedgedriver on PATH, and a fresh
// `npm run tauri:build` (see .claude/skills/run-croco-e2e/SKILL.md).

import { Builder, Key } from 'selenium-webdriver'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const appPath = path.join(repoRoot, 'src-tauri', 'target', 'release', 'croco.exe')
const DRIVER_PORT = 4447 // avoid 4445 (reserved — see project memory); pick something unlikely to collide with another e2e run

function log(msg) { console.log(`[e2e] ${msg}`) }
function assert(cond, msg) { if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`); log(`ok: ${msg}`) }

async function waitFor(fn, { timeoutMs = 6000, intervalMs = 150, label = 'condition' } = {}) {
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

  const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-ideapp-'))
  const tmpProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-proj-'))
  fs.writeFileSync(path.join(tmpProjectDir, 'index.js'), "const greeting = 'hello'\nfunction shout() {\n  return greeting.toUpperCase()\n}\nmodule.exports = { shout }\n")
  fs.writeFileSync(path.join(tmpProjectDir, 'styles.css'), 'body { color: red; }\n')
  log(`temp data dir:    ${tmpDataDir}`)
  log(`temp project dir: ${tmpProjectDir}`)

  const isolatedSettings = {
    app: { onboarded: true, dataPath: tmpDataDir },
    modules: { ide: { enabled: true } },
  }
  fs.writeFileSync(path.join(tmpDataDir, 'settings.json'), JSON.stringify(isolatedSettings, null, 2))

  log('starting tauri-driver...')
  const driverLog = []
  const driverProc = spawn('tauri-driver', ['--port', String(DRIVER_PORT)], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CROCO_DATA_DIR: tmpDataDir } })
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

    await waitFor(async () => { try { return await driver.executeScript('return !!window.api') } catch { return false } },
      { timeoutMs: 20000, label: 'window.api to be ready' })
    assert(true, 'app launched and window.api is available')

    // ── Settings page: toggle/select controls and text fields must persist
    // with NO "Save Changes" button anywhere on the page (it was removed —
    // this is what actually broke before: several controls only updated
    // local React state and relied on a global save button that most
    // toggles never needed in the first place) ────────────────────────────
    await driver.executeScript(`location.hash = '#/settings'`)
    await waitFor(async () => driver.executeScript(`return !!document.querySelector('button')`), { label: 'Settings page renders' })
    assert(
      await driver.executeScript(`return !Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Save Changes'))`),
      'no "Save Changes" button exists anywhere on the Settings page'
    )
    // Click a preset Tag chip (User section, the default active section) —
    // a pure click/select control with no text input at all.
    await driver.executeScript(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Designer')
      btn.click()
    `)
    await waitFor(async () => (await callApi(driver, 'settings.get')).user.tag === 'Designer',
      { timeoutMs: 3000, label: 'clicking a Tag chip persists user.tag with no save button' })
    assert(true, 'Tag chip click persisted immediately')
    // Type into the free-text Display Name field and blur it (no button) —
    // should persist on blur, not require any explicit save action.
    await driver.executeScript(`
      const input = document.querySelector('input[placeholder="Your name"]')
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(input, 'E2E Tester')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      // React's synthetic onBlur is wired to the native 'focusout' event
      // (which bubbles), not 'blur' (which doesn't) — dispatching 'blur'
      // directly is invisible to React's delegated listener.
      input.dispatchEvent(new Event('focusout', { bubbles: true }))
    `)
    await waitFor(async () => (await callApi(driver, 'settings.get')).user.name === 'E2E Tester',
      { timeoutMs: 3000, label: 'blurring the Display Name field persists it with no save button' })
    assert(true, 'Display Name field persisted on blur')

    // ── Settings persistence: smoothAnimations ─────────────────────────────
    const s0 = await callApi(driver, 'settings.get')
    assert(s0.appearance.smoothAnimations === true, `smoothAnimations defaults true (got ${s0.appearance.smoothAnimations})`)
    assert((s0.modules?.ide?.layout?.explorerSide || 'left') === 'left', `modules.ide.layout.explorerSide defaults 'left' (got ${s0.modules?.ide?.layout?.explorerSide})`)

    await callApi(driver, 'settings.update', { appearance: { smoothAnimations: false } })
    const s1 = await callApi(driver, 'settings.get')
    assert(s1.appearance.smoothAnimations === false, 'smoothAnimations=false persists')
    await callApi(driver, 'settings.update', { appearance: { smoothAnimations: true } })

    // ── motion-reduced CSS mechanism (independent of the React wiring —
    // proves the stylesheet rule itself actually collapses durations) ─────
    await driver.executeScript(`document.documentElement.classList.add('motion-reduced')`)
    const dur = await driver.executeScript(`
      const el = document.querySelector('aside') || document.body
      return getComputedStyle(el).transitionDuration
    `)
    assert(/^0(\.\d+)?(ms|s)$|0\.001ms/.test(dur) || parseFloat(dur) < 0.01, `html.motion-reduced collapses transition-duration (got "${dur}")`)
    await driver.executeScript(`document.documentElement.classList.remove('motion-reduced')`)

    // ── The app sidebar must NOT move outside the IDE, even if the IDE's
    // own explorerSide is set to 'right' — it's a page-scoped follow, not a
    // general app-wide preference. We're on the default route (Dashboard)
    // here, before ever visiting /ide.
    await callApi(driver, 'settings.update', { modules: { ide: { layout: { explorerSide: 'right' } } } })
    await driver.executeScript(`window.dispatchEvent(new CustomEvent('croco:data-changed'))`)
    await new Promise(r => setTimeout(r, 400)) // give a reactive (but wrongly-firing) move a moment to happen if the bug regressed
    const asideRectOutsideIde = await driver.executeScript(`const a = document.querySelector('aside'); return a ? JSON.stringify(a.getBoundingClientRect()) : null`)
    assert(JSON.parse(asideRectOutsideIde).left <= 8, 'sidebar stays on the left outside the IDE even with explorerSide=right')
    await callApi(driver, 'settings.update', { modules: { ide: { layout: { explorerSide: 'left' } } } })
    await driver.executeScript(`window.dispatchEvent(new CustomEvent('croco:data-changed'))`)

    // ── IDE: import a real project, open it, verify file tree + Monaco ────
    const project = await callApi(driver, 'projects.import', tmpProjectDir, {})
    assert(!!project?.id, 'project imported')

    const tree = await callApi(driver, 'projects.getFileTree', project.id)
    assert(Array.isArray(tree) && tree.some(n => n.name === 'index.js'), `file tree includes index.js (got ${JSON.stringify(tree?.map(n => n.name))})`)

    const content = await callApi(driver, 'ide.readFile', project.id, 'index.js')
    assert(content.includes('shout'), 'ide.readFile returns real file content')

    // Navigate the real HashRouter to /ide and select the imported project
    // through the actual <select> element (not a raw store write) so the
    // full CodeEditor mount path — tree load, Monaco mount, theme apply —
    // runs for real.
    await driver.executeScript(`window.dispatchEvent(new CustomEvent('croco:data-changed')); location.hash = '#/ide'`)
    await waitFor(async () => driver.executeScript(`return !!document.querySelector('select')`), { label: 'IDE page select renders' })
    await driver.executeScript((id) => {
      const sel = document.querySelector('select')
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
      setter.call(sel, id)
      sel.dispatchEvent(new Event('change', { bubbles: true }))
    }, project.id)

    await waitFor(async () => driver.executeScript(`return !!document.querySelector('.monaco-editor')`) , { timeoutMs: 4000, label: 'explorer renders (file tree row for index.js)' }).catch(() => {})
    // Click the index.js row in the explorer (first file row containing the text)
    await waitFor(async () => {
      return driver.executeScript(`
        const rows = Array.from(document.querySelectorAll('div'))
        const row = rows.find(r => r.textContent.includes('index.js') && r.style.cursor === 'pointer' && r.children.length <= 4)
        if (row) { row.click(); return true }
        return false
      `)
    }, { timeoutMs: 6000, label: 'index.js explorer row clicked' })

    await waitFor(async () => driver.executeScript(`return !!document.querySelector('.monaco-editor')`), { timeoutMs: 6000, label: 'Monaco editor mounts' })
    assert(true, 'Monaco editor mounted for index.js')

    const bg = await waitFor(async () => {
      const v = await driver.executeScript(`
        const el = document.querySelector('.monaco-editor .monaco-editor-background') || document.querySelector('.monaco-editor')
        return el ? getComputedStyle(el).backgroundColor : null
      `)
      return v
    }, { label: 'Monaco background color readable' })
    // Catppuccin Mocha base = #1e1e2e = rgb(30, 30, 46)
    assert(bg.includes('30, 30, 46') || bg.includes('30,30,46'), `Monaco background is Catppuccin Mocha base #1e1e2e (got ${bg})`)

    // ── Ctrl+P quick-open ───────────────────────────────────────────────
    await driver.executeScript(`document.querySelector('.monaco-editor').focus?.()`)
    await driver.actions().keyDown(Key.CONTROL).sendKeys('p').keyUp(Key.CONTROL).perform()
    await waitFor(async () => driver.executeScript(`return !!Array.from(document.querySelectorAll('input')).find(i => i.placeholder === 'Go to file…')`),
      { timeoutMs: 3000, label: 'Ctrl+P opens the quick-open palette' })
    assert(true, 'quick-open palette opened via Ctrl+P')
    await driver.actions().sendKeys(Key.ESCAPE).perform()

    // ── IDE explorer side follows the layout setting ───────────────────
    // Note: this checks the explorer panel's right edge against its OWN
    // immediate flex-row container (CodeEditor's shellRef), not the full
    // window — the app sidebar also moves to the right while on /ide (see
    // below), which shifts that whole content area leftward within the
    // window, so window.innerWidth is the wrong reference frame here.
    await callApi(driver, 'settings.update', { modules: { ide: { layout: { explorerSide: 'right' } } } })
    await driver.executeScript(`window.dispatchEvent(new CustomEvent('croco:data-changed'))`)
    await waitFor(async () => {
      const v = await driver.executeScript(`
        const span = document.evaluate("//span[text()='Explorer']", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
        if (!span) return null
        let panel = span
        for (let i = 0; i < 6 && panel; i++) { if (panel.getBoundingClientRect().width > 150) break; panel = panel.parentElement }
        const flexRow = panel?.parentElement
        if (!panel || !flexRow) return null
        return JSON.stringify({ panelRight: panel.getBoundingClientRect().right, containerRight: flexRow.getBoundingClientRect().right })
      `)
      if (!v) return false
      const { panelRight, containerRight } = JSON.parse(v)
      return Math.abs(panelRight - containerRight) <= 4
    }, { timeoutMs: 5000, label: 'IDE explorer panel moves flush against the right edge of its own content area' })
    assert(true, 'IDE explorer moved to the right side')

    // ── The app sidebar DOES follow while actually on /ide with
    // explorerSide=right (set two blocks up and still in effect) ──────────
    await waitFor(async () => {
      const rect = await driver.executeScript(`const a = document.querySelector('aside'); return a ? JSON.stringify(a.getBoundingClientRect()) : null`)
      if (!rect) return false
      const r = JSON.parse(rect)
      const winWidth = await driver.executeScript('return window.innerWidth')
      return r.right >= winWidth - 8
    }, { timeoutMs: 5000, label: 'sidebar follows the IDE explorer to the right edge while on /ide' })
    assert(true, 'sidebar followed the IDE explorer to the right edge')

    // ── The quick-flip button inside the explorer panel itself (not the
    // Settings page) flips explorerSide back to 'left' and both panels
    // move immediately ──────────────────────────────────────────────────
    await driver.executeScript(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.title === 'Move explorer to the left')
      btn.click()
    `)
    await waitFor(async () => {
      const s = await callApi(driver, 'settings.get')
      return s.modules?.ide?.layout?.explorerSide === 'left'
    }, { timeoutMs: 3000, label: 'in-panel flip button persists explorerSide=left' })
    await waitFor(async () => {
      const rect = await driver.executeScript(`const a = document.querySelector('aside'); return a ? JSON.stringify(a.getBoundingClientRect()) : null`)
      if (!rect) return false
      return JSON.parse(rect).left <= 8
    }, { timeoutMs: 5000, label: 'sidebar follows the in-panel flip back to the left edge' })
    assert(true, 'in-panel quick-flip button works and sidebar follows it')
    // Leave explorerSide=right again for the next check (leaving-the-IDE)
    await callApi(driver, 'settings.update', { modules: { ide: { layout: { explorerSide: 'right' } } } })
    await driver.executeScript(`window.dispatchEvent(new CustomEvent('croco:data-changed'))`)
    await waitFor(async () => {
      const rect = await driver.executeScript(`const a = document.querySelector('aside'); return a ? JSON.stringify(a.getBoundingClientRect()) : null`)
      if (!rect) return false
      const r = JSON.parse(rect)
      const winWidth = await driver.executeScript('return window.innerWidth')
      return r.right >= winWidth - 8
    }, { timeoutMs: 5000, label: 're-set explorerSide=right before the leave-IDE check' })

    // ── ...and returns to the left the moment you leave /ide, even though
    // explorerSide is still 'right' in settings ─────────────────────────
    await driver.executeScript(`location.hash = '#/'`)
    await waitFor(async () => {
      const rect = await driver.executeScript(`const a = document.querySelector('aside'); return a ? JSON.stringify(a.getBoundingClientRect()) : null`)
      if (!rect) return false
      return JSON.parse(rect).left <= 8
    }, { timeoutMs: 5000, label: 'sidebar returns to the left edge after leaving /ide' })
    assert(true, 'sidebar returned to the left edge after leaving the IDE')

    log('ALL CHECKS PASSED')
  } finally {
    log('shutting down...')
    try { if (driver) await driver.quit() } catch (e) { log(`driver.quit() error (non-fatal): ${e.message}`) }
    driverProc.kill()
    // The app process (and Windows' own handle to the folder it just had
    // open/watched) needs a moment to actually let go after being killed —
    // retries alone weren't enough; give it a beat before even trying.
    await new Promise(r => setTimeout(r, 1500))
    fs.rmSync(tmpDataDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 400 })
    fs.rmSync(tmpProjectDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 400 })
  }
}

main().catch(err => {
  console.error(`[e2e] FAILED: ${err.message}`)
  process.exitCode = 1
})
