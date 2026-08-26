// Drives the real, compiled Croco app to verify three changes from this
// session end-to-end:
//
// 1. Launch-on-startup toggle (tauri-plugin-autostart wiring) — isEnabled/
//    enable/disable round-trip through the real OS-level mechanism.
// 2. "Last commit" now reflects the real git log for a project, not just
//    commits made through Croco's own commit UI (git_sync_all_last_commit_dates).
// 3. Completed todos become read-only (checkbox stops responding) once
//    completed more than 6 days ago — verified via a real button click in
//    both the main Todo page and ProjectDetail's per-project Todos tab.
//
// See .claude/skills/run-croco-e2e/SKILL.md for the shared setup/gotchas.
// Run with: node e2e/verify-startup-lastcommit-todolock.mjs

import { Builder, By } from 'selenium-webdriver'
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
function git(cwd, args) { return execSync(`git ${args}`, { cwd, encoding: 'utf8' }).trim() }

async function waitFor(fn, { timeoutMs = 8000, intervalMs = 150, label = 'condition' } = {}) {
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
  await waitFor(async () => {
    try { return await driver.executeScript('return !!window.api') } catch { return false }
  }, { timeoutMs: 20000, label: 'window.api to be ready' })
}

async function main() {
  if (!fs.existsSync(appPath)) throw new Error(`App binary not found at ${appPath} — run \`npm run tauri:build\` first.`)
  if (!fs.existsSync(settingsPath)) throw new Error(`Croco settings.json not found at ${settingsPath} — launch the app once first.`)

  const originalSettings = fs.readFileSync(settingsPath, 'utf8')
  const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-data-'))
  const tmpGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-git-'))
  log(`temp data dir: ${tmpDataDir}`)

  const originalParsed = JSON.parse(originalSettings)
  const isolatedSettings = { ...originalParsed, app: { ...originalParsed.app, dataPath: tmpDataDir, storageBackend: 'json' } }
  fs.writeFileSync(settingsPath, JSON.stringify(isolatedSettings, null, 2))
  log('wrote isolated settings.json (temp dataPath, json backend) before launching the app')

  const driverProc = spawn('tauri-driver', ['--port', String(DRIVER_PORT)], { stdio: ['ignore', 'pipe', 'pipe'] })
  driverProc.stdout.on('data', d => { if (process.env.E2E_VERBOSE) process.stdout.write(`[tauri-driver] ${d}`) })
  driverProc.stderr.on('data', d => { if (process.env.E2E_VERBOSE) process.stderr.write(`[tauri-driver] ${d}`) })
  await new Promise((resolve, reject) => {
    const onErr = e => reject(e)
    driverProc.once('error', onErr)
    setTimeout(() => { driverProc.off('error', onErr); resolve() }, 1500)
  })

  const results = { autostart: null, lastCommit: null, todoLockMainPage: null, todoLockProjectDetail: null }
  let driver
  let autostartWasEnabledBeforeTest = null
  try {
    driver = await new Builder()
      .usingServer(`http://localhost:${DRIVER_PORT}`)
      .withCapabilities({ 'tauri:options': { application: appPath }, browserName: 'wry' })
      .build()

    await waitForApiReady(driver)
    assert(true, 'app launched and window.api is available')

    // ══════════════════════════════════════════════════════════════════════
    // 1. Launch-on-startup round-trip
    // ══════════════════════════════════════════════════════════════════════
    try {
      autostartWasEnabledBeforeTest = await callApi(driver, 'app.autostart.isEnabled')
      log(`autostart state before test: ${autostartWasEnabledBeforeTest}`)

      await callApi(driver, 'app.autostart.enable')
      const afterEnable = await callApi(driver, 'app.autostart.isEnabled')
      assert(afterEnable === true, 'isEnabled() reports true after enable()')

      await callApi(driver, 'app.autostart.disable')
      const afterDisable = await callApi(driver, 'app.autostart.isEnabled')
      assert(afterDisable === false, 'isEnabled() reports false after disable()')

      results.autostart = { status: 'PASS' }
    } catch (e) {
      results.autostart = { status: 'FAIL', detail: e.message }
    } finally {
      // Restore whatever the real state was before this test touched it.
      if (autostartWasEnabledBeforeTest === true) await callApi(driver, 'app.autostart.enable').catch(() => {})
      else await callApi(driver, 'app.autostart.disable').catch(() => {})
    }

    // ══════════════════════════════════════════════════════════════════════
    // 2. "Last commit" reflects real git log, not just Croco commits
    // ══════════════════════════════════════════════════════════════════════
    try {
      const gp = await callApi(driver, 'projects.create', { name: 'E2E LastCommit Test', path: tmpGitDir })
      await callApi(driver, 'git.initRepo', gp.id)
      git(tmpGitDir, 'config user.email "e2e@test.local"')
      git(tmpGitDir, 'config user.name "E2E Test"')

      // Commit directly via real git (the terminal, NOT Croco's commit UI) —
      // this is exactly the scenario the fix targets.
      fs.writeFileSync(path.join(tmpGitDir, 'file1.txt'), 'hello\n')
      git(tmpGitDir, 'add .')
      git(tmpGitDir, 'commit -m "commit made outside Croco"')
      const realCommitIso = git(tmpGitDir, 'log -1 --format=%cI')

      const beforeSync = await callApi(driver, 'projects.getById', gp.id)
      assert(!beforeSync.meta?.lastCommitAt, 'lastCommitAt is unset before any sync (project was only imported, never committed via Croco)')

      const syncResult = await callApi(driver, 'git.syncAllLastCommitDates')
      assert(syncResult.synced >= 1, `git_sync_all_last_commit_dates reports at least 1 project synced (got ${syncResult.synced})`)

      const afterSync = await callApi(driver, 'projects.getById', gp.id)
      assert(afterSync.meta?.lastCommitAt === realCommitIso, `lastCommitAt now matches the real git log timestamp (expected ${realCommitIso}, got ${afterSync.meta?.lastCommitAt})`)
      assert(afterSync.lastCommit && afterSync.lastCommit !== 'never', `UI-facing lastCommit field is now populated (got "${afterSync.lastCommit}")`)

      results.lastCommit = { status: 'PASS' }
    } catch (e) {
      results.lastCommit = { status: 'FAIL', detail: e.message }
    }

    // ══════════════════════════════════════════════════════════════════════
    // 3a. Completed-todo lock — main Todo page
    // ══════════════════════════════════════════════════════════════════════
    try {
      const todo = await callApi(driver, 'todos.create', { title: 'E2E Locked Todo (main page)', priority: 'med' })
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
      await callApi(driver, 'todos.update', todo.id, { completed: true, completedAt: eightDaysAgo })

      await driver.executeScript("location.hash = '#/todos'")
      await driver.executeScript("window.dispatchEvent(new CustomEvent('croco:data-changed'))")
      await waitFor(async () => {
        const t = await driver.executeScript('return document.body.innerText')
        return /completed/i.test(t)
      }, { label: 'Todo page to render with a Completed group' })

      // The "Completed" group starts collapsed (TodoGroup.jsx: useState(done)) —
      // expand it, same as a real user would, before the row is even mounted.
      await driver.findElement(By.xpath(
        "//button[.//span[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'completed')]]"
      )).click()

      let lastText = ''
      try {
        await waitFor(async () => {
          lastText = await driver.executeScript('return document.body.innerText')
          return lastText.includes('E2E Locked Todo')
        }, { label: 'locked todo to render on the Todo page' })
      } catch (e) {
        console.log('[e2e] DEBUG page text on failure:\n' + lastText.slice(0, 3000))
        throw e
      }

      const checkbox = await driver.findElement(By.xpath("//*[contains(text(), 'E2E Locked Todo (main page)')]/ancestor::div[contains(@title, 'cannot be reversed') or .//button[contains(@title, 'cannot be reversed')]]//button[contains(@title, 'cannot be reversed')]"))
        .catch(() => null)
      const lockedBtn = checkbox || await driver.findElement(By.xpath("//button[contains(@title, 'cannot be reversed')]"))
      await lockedBtn.click()

      const afterClick = await callApi(driver, 'todos.getAll')
      const stillCompleted = afterClick.find(t => t.id === todo.id)?.completed
      assert(stillCompleted === true, 'clicking the locked checkbox on the main Todo page did NOT un-complete it')

      results.todoLockMainPage = { status: 'PASS' }
    } catch (e) {
      results.todoLockMainPage = { status: 'FAIL', detail: e.message }
    }

    // ══════════════════════════════════════════════════════════════════════
    // 3b. Completed-todo lock — ProjectDetail's per-project Todos tab
    // ══════════════════════════════════════════════════════════════════════
    try {
      const tmpProjDir = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-pdtodo-'))
      const p = await callApi(driver, 'projects.create', { name: 'E2E ProjectDetail Todo', path: tmpProjDir })
      const todo = await callApi(driver, 'todos.create', { title: 'E2E Locked Todo (project tab)', projectId: p.id, priority: 'med' })
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
      await callApi(driver, 'todos.update', todo.id, { completed: true, completedAt: eightDaysAgo })

      await driver.executeScript(`location.hash = '#/projects/${p.id}'`)
      await waitFor(async () => {
        const t = await driver.executeScript('return document.body.innerText')
        return t.includes('Todos')
      }, { label: 'ProjectDetail page to render' })

      await driver.findElement(By.xpath("//button[contains(., 'Todos')]")).click()
      await waitFor(async () => {
        const t = await driver.executeScript('return document.body.innerText')
        return t.includes('E2E Locked Todo (project tab)')
      }, { label: 'locked todo to render in ProjectDetail Todos tab' })

      const lockedBtn = await driver.findElement(By.xpath("//button[contains(@title, 'cannot be reversed')]"))
      await lockedBtn.click()

      const afterClick = await callApi(driver, 'todos.getAll')
      const stillCompleted = afterClick.find(t => t.id === todo.id)?.completed
      assert(stillCompleted === true, 'clicking the locked checkbox in ProjectDetail Todos tab did NOT un-complete it (regression check for the reported bug)')

      results.todoLockProjectDetail = { status: 'PASS' }
      fs.rmSync(tmpProjDir, { recursive: true, force: true })
    } catch (e) {
      results.todoLockProjectDetail = { status: 'FAIL', detail: e.message }
    }

    log('DONE — see summary below')
  } finally {
    log('restoring original settings.json and shutting down...')
    try { if (driver) await driver.quit() } catch (e) { log(`driver.quit() error (non-fatal): ${e.message}`) }
    driverProc.kill()
    fs.writeFileSync(settingsPath, originalSettings)
    for (const d of [tmpDataDir, tmpGitDir]) fs.rmSync(d, { recursive: true, force: true })
  }

  console.log('\n[e2e] ── Summary ──')
  for (const [k, v] of Object.entries(results)) console.log(`  ${k}: ${v?.status || 'SKIPPED'}${v?.detail ? ` — ${v.detail}` : ''}`)
  if (Object.values(results).some(r => r?.status === 'FAIL')) process.exitCode = 1
}

main().catch(err => {
  console.error(`[e2e] FAILED: ${err.message}`)
  process.exitCode = 1
})
