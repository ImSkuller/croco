// Drives the real, compiled Croco app to verify the JARVIS-style Suggestions
// card renders correctly on the Dashboard and that per-item dismiss/snooze
// actually persists. Unlike verify-obsidian-sync.mjs / verify-personality-
// tracking.mjs (which only hit window.api directly), this one also reads
// rendered page text, since Suggestions is a pure UI-rendering feature —
// there's no dedicated Rust command to call instead. See
// .claude/skills/run-croco-e2e/SKILL.md for the shared setup/gotchas.
//
// Run with: node e2e/verify-suggestions.mjs

import { Builder, By } from 'selenium-webdriver'
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

function isoDaysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString()
}
function localDateStrDaysAgo(n) {
  const d = new Date(Date.now() - n * 86400000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function main() {
  if (!fs.existsSync(appPath)) throw new Error(`App binary not found at ${appPath} — run \`npm run tauri:build\` first.`)
  if (!fs.existsSync(settingsPath)) throw new Error(`Croco settings.json not found at ${settingsPath} — launch the app once first.`)

  const originalSettings = fs.readFileSync(settingsPath, 'utf8')
  const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-data-'))
  log(`temp data dir: ${tmpDataDir}`)

  const originalParsed = JSON.parse(originalSettings)
  const isolatedSettings = { ...originalParsed, app: { ...originalParsed.app, dataPath: tmpDataDir } }
  fs.writeFileSync(settingsPath, JSON.stringify(isolatedSettings, null, 2))
  log('wrote isolated settings.json (temp dataPath) before launching the app')

  // Seed habits.json directly (bypassing the API) so the app boots with a
  // 2-day commit streak that's NOT current today (streak-risk heuristic)
  // and one neglected project (quiet for 20 days). Real activity can't be
  // backdated through the live API, so this is the only practical way to
  // exercise these two heuristics without waiting real days.
  const habits = {
    formatVersion: 1,
    firstTrackedAt: isoDaysAgo(30),
    lastUpdatedAt: isoDaysAgo(2),
    commitsByHour: Array(24).fill(0),
    commitsByWeekday: Array(7).fill(0),
    commitDates: [localDateStrDaysAgo(2), localDateStrDaysAgo(1)],
    totalCommits: 2,
    notesCreated: 0,
    notesByWeekday: Array(7).fill(0),
    todosCreated: 0,
    todosCompleted: 0,
    projectStats: {
      'fake-neglected-project': { opens: 1, commits: 1, todos: 0, lastActivityAt: isoDaysAgo(20) },
    },
  }
  fs.mkdirSync(tmpDataDir, { recursive: true })
  fs.writeFileSync(path.join(tmpDataDir, 'habits.json'), JSON.stringify(habits, null, 2))
  log('seeded habits.json with a streak-at-risk + a neglected project')

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

    // Seed the remaining two heuristics via the real API: an overdue todo,
    // and 4 open high-priority todos (backlog threshold is >3).
    await callApi(driver, 'todos.create', { title: 'Overdue thing', dueDate: isoDaysAgo(1) })
    await callApi(driver, 'todos.create', { title: 'P1 a', priority: 'high' })
    await callApi(driver, 'todos.create', { title: 'P1 b', priority: 'high' })
    await callApi(driver, 'todos.create', { title: 'P1 c', priority: 'high' })
    await callApi(driver, 'todos.create', { title: 'P1 d', priority: 'high' })
    // Same cross-page invalidation event the app itself dispatches after
    // mutations (CLAUDE.md) — makes the store refetch and Dashboard re-render.
    await driver.executeScript("window.dispatchEvent(new CustomEvent('croco:data-changed'))")

    // SectionHeader applies text-transform: uppercase in CSS, and
    // document.body.innerText reflects the rendered (uppercased) text, not
    // the original "Suggestions" string passed as a prop — hence /i here.
    const text = await waitForBodyText(driver, t => /suggestions/i.test(t), 'Suggestions section to render')
    assert(/suggestions/i.test(text), 'Suggestions section heading is present')
    assert(/commit streak ends today/i.test(text), 'streak-at-risk suggestion rendered')
    assert(/overdue/i.test(text), 'overdue-todo suggestion rendered')
    assert(/has been quiet/i.test(text), 'neglected-project suggestion rendered')
    assert(/high-priority todos open/i.test(text), 'priority-backlog suggestion rendered')

    // ── Dismiss/snooze persistence ───────────────────────────────────────
    const remindButtons = await driver.findElements(By.xpath("//button[text()='Remind later']"))
    assert(remindButtons.length >= 4, `found a "Remind later" button per suggestion (got ${remindButtons.length})`)
    await remindButtons[0].click()

    const stored = await driver.executeScript("return localStorage.getItem('croco:dismissed-suggestions')")
    const parsed = JSON.parse(stored || '{}')
    assert(Object.keys(parsed).length === 1, `exactly one suggestion snoozed in localStorage (got ${Object.keys(parsed).length})`)

    const afterDismissCount = (await driver.findElements(By.xpath("//button[text()='Remind later']"))).length
    assert(afterDismissCount === remindButtons.length - 1, `one fewer suggestion rendered after dismiss (${afterDismissCount} vs ${remindButtons.length})`)

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
