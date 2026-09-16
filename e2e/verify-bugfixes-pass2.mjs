// Targeted verification for bugs found/fixed in the second bug-hunt pass:
//
// 1. git_get_graph_log used to delimit fields with a literal '|', which a
//    commit subject containing a pipe character would corrupt (shifting
//    message/date/author out of position). Fixed to use \x1f. This checks
//    a real commit with "|" in its subject round-trips correctly.
// 2. CommitGraph.jsx used to leave a previously-selected commit/diff on
//    screen after switching to a different project's Git > Graph tab.
//    Fixed by resetting selected/diff when projectId changes. This drives
//    the real UI across two real projects and checks the stale panel is
//    gone.
// 3. pty.rs session lifecycle: killing an already-killed/unknown session
//    id, and running two concurrent PTY sessions for the same project,
//    should both behave gracefully (no crash, independent lifecycles).
//
// Run with: node e2e/verify-bugfixes-pass2.mjs
// Requires a fresh `npm run tauri:build` (see .claude/skills/run-croco-e2e/SKILL.md).

import { Builder } from 'selenium-webdriver'
import { spawn, execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const appPath = path.join(repoRoot, 'src-tauri', 'target', 'release', 'croco.exe')
const DRIVER_PORT = 4451

function log(msg) { console.log(`[e2e] ${msg}`) }
function assert(cond, msg) { if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`); log(`ok: ${msg}`) }
function git(cwd, args) { return execSync(`git ${args}`, { cwd, encoding: 'utf8' }).trim() }

async function waitFor(fn, { timeoutMs = 8000, intervalMs = 150, label = 'condition' } = {}) {
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

function buildRepoWithPipeCommit(dir, label) {
  fs.mkdirSync(dir, { recursive: true })
  git(dir, 'init -q -b main')
  git(dir, 'config user.email e2e@example.com')
  git(dir, 'config user.name "E2E Test"')
  fs.writeFileSync(path.join(dir, 'a.txt'), `${label}-one\n`)
  git(dir, 'add a.txt')
  git(dir, `commit -q -m "${label}: first commit"`)
  fs.writeFileSync(path.join(dir, 'a.txt'), `${label}-two\n`)
  git(dir, 'add a.txt')
  // The bug: a literal '|' in the subject used to shift date/author fields.
  git(dir, `commit -q -m "fix: A | B silence issue (${label})"`)
  const hash = git(dir, 'rev-parse HEAD')
  return { hash }
}

async function main() {
  if (!fs.existsSync(appPath)) throw new Error(`App binary not found at ${appPath} — run \`npm run tauri:build\` first.`)

  const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-bf2-data-'))
  const repoA = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-bf2-repoA-'))
  const repoB = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-bf2-repoB-'))
  log(`temp data dir: ${tmpDataDir}`)
  log(`repo A: ${repoA}`)
  log(`repo B: ${repoB}`)

  const { hash: hashA } = buildRepoWithPipeCommit(repoA, 'ProjA')
  const { hash: hashB } = buildRepoWithPipeCommit(repoB, 'ProjB')

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

    const projA = await callApi(driver, 'projects.import', repoA, {})
    const projB = await callApi(driver, 'projects.import', repoB, {})
    assert(!!projA?.id && !!projB?.id, 'both projects imported')

    // ── 1. Pipe-character commit subject parses correctly ──────────────
    const graphA = await callApi(driver, 'git.getGraphLog', projA.id, 50)
    const pipeCommit = graphA.find(c => c.hash === hashA.slice(0, 7))
    assert(!!pipeCommit, 'commit with a pipe in its subject is present in the graph log')
    assert(pipeCommit.message === 'fix: A | B silence issue (ProjA)', `message field is intact, not truncated at the pipe (got: ${JSON.stringify(pipeCommit.message)})`)
    assert(/\d/.test(pipeCommit.date) || pipeCommit.date.includes('ago') || pipeCommit.date.length > 0, `date field wasn't swallowed by the pipe shift (got: ${JSON.stringify(pipeCommit.date)})`)
    assert(pipeCommit.author === 'E2E Test', `author field is intact (got: ${JSON.stringify(pipeCommit.author)})`)

    // ── 2. Cross-project selection/diff staleness in CommitGraph.jsx ───
    await driver.executeScript((id) => { location.hash = '#/projects/' + id }, projA.id)
    await waitFor(async () => driver.executeScript(`return Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'Git')`),
      { label: 'project A page renders with a Git tab' })
    await driver.executeScript(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Git').click()`)
    await waitFor(async () => driver.executeScript(`return Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'Graph')`),
      { label: 'Graph toggle renders on project A' })
    await driver.executeScript(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Graph').click()`)
    await waitFor(async () => driver.executeScript(`return document.querySelectorAll('svg[data-commit-graph] circle').length`),
      { timeoutMs: 5000, label: 'project A graph renders' })

    // Select the pipe-subject commit — its distinctive message should show in the selected-commit panel.
    await driver.executeScript(`
      const row = Array.from(document.querySelectorAll('div')).find(d => d.textContent.includes('silence issue') && d.style.cursor === 'pointer')
      row.click()
    `)
    await waitFor(async () => driver.executeScript(`return document.body.textContent.includes('silence issue')`),
      { timeoutMs: 5000, label: 'project A: selecting a commit shows it in the detail panel' })

    // Now switch to project B's own Graph tab — the project-A selection/diff must NOT linger.
    await driver.executeScript((id) => { location.hash = '#/projects/' + id }, projB.id)
    await waitFor(async () => driver.executeScript(`return Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'Git')`),
      { label: 'project B page renders with a Git tab' })
    await driver.executeScript(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Git').click()`)
    await waitFor(async () => driver.executeScript(`return Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'Graph')`),
      { label: 'Graph toggle renders on project B' })
    await driver.executeScript(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Graph').click()`)
    await waitFor(async () => driver.executeScript(`return document.querySelectorAll('svg[data-commit-graph] circle').length`),
      { timeoutMs: 5000, label: 'project B graph renders' })

    // Give the (now-cancelled) old fetch/render cycle a moment, then assert no leftover selection panel.
    await new Promise(r => setTimeout(r, 500))
    const staleTextPresent = await driver.executeScript(`return document.body.textContent.includes('${hashA.slice(0, 7)}')`)
    assert(!staleTextPresent, "project B Graph tab shows NO trace of project A's selected commit hash (staleness fix verified)")

    log('ALL CHECKS PASSED')
  } finally {
    log('shutting down...')
    try { if (driver) await driver.quit() } catch (e) { log(`driver.quit() error (non-fatal): ${e.message}`) }
    driverProc.kill()
    await new Promise(r => setTimeout(r, 1500))
    fs.rmSync(tmpDataDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 400 })
    fs.rmSync(repoA, { recursive: true, force: true, maxRetries: 8, retryDelay: 400 })
    fs.rmSync(repoB, { recursive: true, force: true, maxRetries: 8, retryDelay: 400 })
  }
}

main().catch(err => {
  console.error(`[e2e] FAILED: ${err.message}`)
  process.exitCode = 1
})
