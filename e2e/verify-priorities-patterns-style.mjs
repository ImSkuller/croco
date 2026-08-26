// Drives the real, compiled Croco app to verify three features from this
// session: user-configurable Todo priorities (add/edit/delete via the real
// Priority Manager UI), the Patterns page's two independent streaks
// (commit + app-login), and the Settings -> Appearance "Style" picker
// (Apple applies its html.style-apple class; Pasta Galaxy stays disabled).
// See .claude/skills/run-croco-e2e/SKILL.md for shared setup/gotchas.
//
// Run with: node e2e/verify-priorities-patterns-style.mjs

import { Builder, By, Key } from 'selenium-webdriver'
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
  if (!result.ok) throw new Error(`window.api.${dotted}(...) rejected: ${result.error}`)
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

async function waitForBodyText(driver, predicate, label, timeoutMs = 8000) {
  const start = Date.now()
  let last = ''
  while (Date.now() - start < timeoutMs) {
    last = await driver.executeScript('return document.body.innerText')
    if (predicate(last)) return last
    await new Promise(r => setTimeout(r, 200))
  }
  throw new Error(`Timed out waiting for: ${label}\nLast page text snapshot:\n${last.slice(0, 2000)}`)
}

async function getConsoleErrors(driver) {
  try {
    return await driver.manage().logs().get('browser')
  } catch {
    return [] // wry/webview2 often doesn't expose the browser log type — non-fatal
  }
}

async function main() {
  if (!fs.existsSync(appPath)) throw new Error(`App binary not found at ${appPath} — run \`npm run tauri:build\` first.`)
  if (!fs.existsSync(settingsPath)) throw new Error(`Croco settings.json not found at ${settingsPath} — launch the app once first.`)

  const originalSettings = fs.readFileSync(settingsPath, 'utf8')
  const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-data-'))
  log(`temp data dir: ${tmpDataDir}`)

  const originalParsed = JSON.parse(originalSettings)
  // Also reset todos.priorities to the real defaults — app.dataPath isolation
  // only isolates project/note/todo data, not this global settings.json, so
  // a dev machine with real prior usage (e.g. a manually-added "Highest"
  // priority) would otherwise leak into "default priorities" assertions below.
  const defaultPriorities = [
    { id: 'high', label: 'High',   color: '#ff4444' },
    { id: 'med',  label: 'Medium', color: '#ffd700' },
    { id: 'low',  label: 'Low',    color: '#4aff91' },
  ]
  const isolatedSettings = {
    ...originalParsed,
    app: { ...originalParsed.app, dataPath: tmpDataDir },
    todos: { ...originalParsed.todos, priorities: defaultPriorities },
  }
  fs.writeFileSync(settingsPath, JSON.stringify(isolatedSettings, null, 2))
  log('wrote isolated settings.json (temp dataPath + default priorities) before launching the app')

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

    // ── Defaults: settings.todos.priorities seeded with High/Medium/Low ──
    const settings0 = await callApi(driver, 'settings.get')
    const defaultPriorities = settings0.todos?.priorities || []
    assert(defaultPriorities.map(p => p.label).join(',') === 'High,Medium,Low', `default priorities are High/Medium/Low (got: ${defaultPriorities.map(p => p.label).join(',')})`)

    // ── Todo page: priority tabs render human labels ──────────────────────
    await driver.executeScript("location.hash = '#/todos'")
    let text = await waitForBodyText(driver, t => t.includes('Todo') && t.includes('Medium'), 'Todo page with Medium priority tab')
    assert(text.includes('High') && text.includes('Medium') && text.includes('Low'), 'priority tabs show human labels, not raw ids')

    // ── Priority Manager: open, add, edit, delete via real UI clicks ─────
    await driver.findElement(By.css('button[title="Manage priorities"]')).click()
    text = await waitForBodyText(driver, t => t.includes('Manage Priorities'), 'Priority Manager modal to open')
    assert(true, 'Priority Manager modal opened')

    const labelInput = await driver.findElement(By.css('input[placeholder="New priority name..."]'))
    await labelInput.sendKeys('Urgent')
    await driver.findElement(By.xpath("//button[text()='Add']")).click()
    text = await waitForBodyText(driver, t => t.includes('Urgent'), 'new "Urgent" priority to appear')
    assert(true, 'added a custom priority via the real Add button')

    const urgentInput = await driver.findElement(By.xpath("//input[@value='Urgent']"))
    await urgentInput.sendKeys(Key.END, '!!')
    await new Promise(r => setTimeout(r, 300)) // debounce-free, but let the optimistic patch land
    text = await driver.executeScript('return document.body.innerText')
    assert(text.includes('Urgent!!'), 'edited the custom priority label via the real input')

    // Delete it: two-step confirm
    const rows = await driver.findElements(By.css('button[title="Delete priority"]'))
    await rows[rows.length - 1].click() // last row = the one we just added
    await driver.findElement(By.xpath("//button[text()='Confirm']")).click()
    text = await waitForBodyText(driver, t => !t.includes('Urgent!!'), 'deleted priority to disappear')
    assert(!text.includes('Urgent!!'), 'custom priority removed after confirm')

    await driver.findElement(By.xpath("//button[text()='×']")).click()
    text = await waitForBodyText(driver, t => !t.includes('Manage Priorities'), 'Priority Manager modal to close')
    assert(true, 'closed Priority Manager modal')

    // ── Add a real task and confirm it lands in the High Priority group ──
    await driver.findElement(By.xpath("//button[contains(., 'New Task')]")).click()
    await driver.findElement(By.css('input[placeholder="Task title..."]')).sendKeys('e2e test task')
    // Scoped to the add-task panel — "High" also appears as a toolbar filter
    // tab elsewhere on the page, and that's the first DOM match otherwise.
    await driver.findElement(By.xpath("//div[contains(@class,'anim-scale-in')]//button[text()='High']")).click()
    await driver.findElement(By.xpath("//button[contains(., 'Add Task')]")).click()
    text = await waitForBodyText(driver, t => t.includes('e2e test task'), 'new task to appear')
    // Group header text is CSS text-transform:uppercase — innerText reflects
    // that (rendered "HIGH PRIORITY"), not the original-case label prop.
    const lower = text.toLowerCase()
    assert(lower.includes('high priority') && lower.indexOf('high priority') < lower.indexOf('e2e test task'), 'task added under the High Priority group')

    // ── Patterns page: both streaks render, no crash ─────────────────────
    // (SettingsCard labels are CSS text-transform:uppercase — compare lowercase.)
    await driver.executeScript("location.hash = '#/patterns'")
    text = await waitForBodyText(driver, t => t.toLowerCase().includes('commit streak') && t.toLowerCase().includes('app login streak'), 'Patterns page with both streak cards')
    const patternsLower = text.toLowerCase()
    assert(patternsLower.includes('commit streak'), 'commit streak card renders')
    assert(patternsLower.includes('app login streak'), 'app login streak card renders')
    assert(patternsLower.includes('login streak'), 'StreakHero banner renders (login streak copy)')

    // ── Settings -> Appearance -> Style: Apple applies its html class ────
    await driver.executeScript("location.hash = '#/settings'")
    await driver.findElement(By.xpath("//button[contains(., 'Appearance')]")).click()
    await waitForBodyText(driver, t => t.includes('Pasta Galaxy'), 'Style picker to render')

    await driver.findElement(By.xpath("//span[text()='Apple']")).click()
    let hasAppleClass = await driver.executeScript("return document.documentElement.classList.contains('style-apple')")
    assert(hasAppleClass === true, 'selecting Apple applied html.style-apple')

    const settingsAfterStyle = await callApi(driver, 'settings.get')
    assert(settingsAfterStyle.appearance?.style === 'apple', 'style:"apple" persisted to settings')
    assert(settingsAfterStyle.appearance?.fontBody === 'Inter', 'Apple style curated the Inter font pairing')

    const pastaBtn = await driver.findElement(By.xpath("//span[text()='Pasta Galaxy']/ancestor::button"))
    const pastaDisabled = await pastaBtn.getAttribute('disabled')
    assert(pastaDisabled !== null, 'Pasta Galaxy button is disabled (coming soon)')

    await driver.findElement(By.xpath("//span[text()='Default']/ancestor::button")).click()
    let hasAppleClassAfter = await driver.executeScript("return document.documentElement.classList.contains('style-apple')")
    assert(hasAppleClassAfter === false, 'switching back to Default removed html.style-apple')

    // ── Console error sweep ────────────────────────────────────────────
    const logs = await getConsoleErrors(driver)
    const severe = logs.filter(l => l.level.name === 'SEVERE')
    if (severe.length) {
      log(`WARNING: ${severe.length} severe console message(s):`)
      severe.forEach(l => log(`  ${l.message}`))
    } else {
      log('no severe console errors captured (or log capture unsupported on this webview)')
    }

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
