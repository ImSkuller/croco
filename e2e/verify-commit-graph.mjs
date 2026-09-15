// Drives the real, compiled Croco app to verify the new visual git commit
// graph (Git tab -> "Graph" toggle): builds a real repo on disk with an
// actual branch + merge (not a mock), imports it, and checks both the raw
// backend data (git_get_graph_log) and that the UI actually renders a
// graph (SVG nodes/edges) once "Graph" is clicked.
//
// Run with: node e2e/verify-commit-graph.mjs
// Requires tauri-driver + a matching msedgedriver on PATH, and a fresh
// `npm run tauri:build` (see .claude/skills/run-croco-e2e/SKILL.md).

import { Builder } from 'selenium-webdriver'
import { spawn, execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const appPath = path.join(repoRoot, 'src-tauri', 'target', 'release', 'croco.exe')
const DRIVER_PORT = 4448

function log(msg) { console.log(`[e2e] ${msg}`) }
function assert(cond, msg) { if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`); log(`ok: ${msg}`) }
function git(cwd, args) { return execSync(`git ${args}`, { cwd, encoding: 'utf8' }).trim() }

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

// Builds: main (2 commits) -> branch off commit 1 (1 commit) -> merged back
// into main as a real merge commit (--no-ff, so it's guaranteed to have 2
// parents even though this is a trivial non-conflicting merge).
function buildTestRepo(dir) {
  fs.mkdirSync(dir, { recursive: true })
  git(dir, 'init -q -b main')
  git(dir, 'config user.email e2e@example.com')
  git(dir, 'config user.name "E2E Test"')
  fs.writeFileSync(path.join(dir, 'a.txt'), 'one\n')
  git(dir, 'add a.txt')
  git(dir, 'commit -q -m "first commit"')
  fs.writeFileSync(path.join(dir, 'a.txt'), 'two\n')
  git(dir, 'add a.txt')
  git(dir, 'commit -q -m "second commit"')
  git(dir, 'checkout -q -b feature')
  fs.writeFileSync(path.join(dir, 'b.txt'), 'feature\n')
  git(dir, 'add b.txt')
  git(dir, 'commit -q -m "feature commit"')
  git(dir, 'checkout -q main')
  const mergeHash = (() => {
    git(dir, 'merge --no-ff -q -m "merge feature" feature')
    return git(dir, 'rev-parse HEAD')
  })()
  return { mergeHash }
}

async function main() {
  if (!fs.existsSync(appPath)) throw new Error(`App binary not found at ${appPath} — run \`npm run tauri:build\` first.`)

  const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-graph-data-'))
  const tmpRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-graph-repo-'))
  log(`temp data dir: ${tmpDataDir}`)
  log(`temp repo dir: ${tmpRepoDir}`)

  const { mergeHash } = buildTestRepo(tmpRepoDir)
  log(`built test repo with a real merge commit ${mergeHash.slice(0, 7)}`)

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

    const project = await callApi(driver, 'projects.import', tmpRepoDir, {})
    assert(!!project?.id, 'project imported')

    // ── Backend: git_get_graph_log returns real parent hashes + a merge ──
    const graph = await callApi(driver, 'git.getGraphLog', project.id, 50)
    assert(Array.isArray(graph) && graph.length === 4, `graph log has all 4 commits (got ${graph?.length})`)
    const merge = graph.find(c => c.hash === mergeHash.slice(0, 7))
    assert(!!merge, 'merge commit is present in the graph log')
    assert(merge.parents.length === 2, `merge commit reports 2 parents (got ${merge.parents.length})`)
    const featureCommit = graph.find(c => c.message === 'feature commit')
    assert(!!featureCommit, 'feature-branch commit is present (confirms --all, not just current branch)')
    assert(merge.parents.includes(featureCommit.hash), 'merge commit’s parents include the feature-branch commit')

    // ── UI: open the project, Git tab, switch to Graph view ──────────────
    await driver.executeScript((id) => { location.hash = '#/projects/' + id }, project.id)
    await waitFor(async () => driver.executeScript(`return Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'Git')`),
      { label: 'project page tab bar renders with a Git tab' })
    await driver.executeScript(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Git').click()`)
    await waitFor(async () => driver.executeScript(`return Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'Graph')`),
      { label: 'Commit History List/Graph toggle renders' })
    await driver.executeScript(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Graph').click()`)

    // Scoped to the graph's own SVG (data-commit-graph) — a bare 'svg
    // circle'/'svg path' selector also matches unrelated icon SVGs
    // elsewhere on the page (avatars, status dots, etc.).
    await waitFor(async () => driver.executeScript(`return document.querySelectorAll('svg[data-commit-graph] circle').length`),
      { timeoutMs: 5000, label: 'graph SVG renders commit nodes' })
    const circleCount = await driver.executeScript(`return document.querySelectorAll('svg[data-commit-graph] circle').length`)
    assert(circleCount === 4, `graph renders one circle per commit (got ${circleCount})`)
    const pathCount = await driver.executeScript(`return document.querySelectorAll('svg[data-commit-graph] path').length`)
    assert(pathCount >= 1, `graph renders at least one curved (cross-lane) edge for the merge (got ${pathCount} path elements)`)

    // Clicking a commit row shows its diff.
    await driver.executeScript(`
      const row = Array.from(document.querySelectorAll('div')).find(d => d.textContent.includes('merge feature') && d.style.cursor === 'pointer')
      row.click()
    `)
    await waitFor(async () => driver.executeScript(`return document.body.textContent.includes('feature.txt') || document.body.textContent.includes('b.txt')`),
      { timeoutMs: 5000, label: 'clicking the merge commit shows a diff mentioning the changed file' })
    assert(true, 'commit click loads a real diff')

    log('ALL CHECKS PASSED')
  } finally {
    log('shutting down...')
    try { if (driver) await driver.quit() } catch (e) { log(`driver.quit() error (non-fatal): ${e.message}`) }
    driverProc.kill()
    await new Promise(r => setTimeout(r, 1500))
    fs.rmSync(tmpDataDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 400 })
    fs.rmSync(tmpRepoDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 400 })
  }
}

main().catch(err => {
  console.error(`[e2e] FAILED: ${err.message}`)
  process.exitCode = 1
})
