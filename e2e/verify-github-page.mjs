// Drives the real, compiled Croco app to verify the new GitHub page's backend
// commands end-to-end: real window.api.* calls hitting the real Rust
// git_ops.rs/github_ops.rs commands, a real local git repo, and one
// read-only network call to GitHub's public API — not mocks.
//
// Scope: this is IPC/backend-level verification (see
// .claude/skills/run-croco-e2e/SKILL.md's "Known limitations" — literal
// button-click UI testing isn't built for this repo yet). It does NOT push
// any tag/release to a real remote (the test repo has no `origin`, so
// git_create_tag's push step fails gracefully by design) and does NOT write
// to anyone's real GitHub account (github_create_release is only exercised
// against a project with no token configured, to verify its guard clause
// short-circuits before any network call). github_get_repo_info/
// github_list_releases are exercised read-only against octocat/Hello-World,
// GitHub's own long-standing public demo repo.
//
// Run with: node e2e/verify-github-page.mjs

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
  return result
}

async function callApiOk(driver, dotted, ...args) {
  const result = await callApi(driver, dotted, ...args)
  if (!result.ok) throw new Error(`window.api.${dotted}(${args.map(a => JSON.stringify(a)).join(', ')}) rejected: ${result.error}`)
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

async function main() {
  if (!fs.existsSync(appPath)) throw new Error(`App binary not found at ${appPath} — run \`npm run tauri:build\` first.`)
  if (!fs.existsSync(settingsPath)) throw new Error(`Croco settings.json not found at ${settingsPath} — launch the app once first.`)

  const originalSettings = fs.readFileSync(settingsPath, 'utf8')
  const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-data-'))
  const tmpProjectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-repo-'))
  log(`temp data dir: ${tmpDataDir}`)
  log(`temp project root: ${tmpProjectRoot}`)

  const originalParsed = JSON.parse(originalSettings)
  // Explicitly blank the GitHub token — spreading the real user's settings
  // would otherwise carry their real token through, and the "no token"
  // guard-clause test below would fire a REAL API call with REAL
  // credentials against whatever repo it's pointed at.
  const isolatedSettings = {
    ...originalParsed,
    app: { ...originalParsed.app, dataPath: tmpDataDir },
    user: { ...originalParsed.user, github: { ...originalParsed.user?.github, token: '' } },
  }
  fs.writeFileSync(settingsPath, JSON.stringify(isolatedSettings, null, 2))
  log('wrote isolated settings.json (temp dataPath, blanked github token) before launching the app')

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

    // ── Set up a real local git repo with real commits ───────────────────
    const project = await callApiOk(driver, 'projects.create', { name: 'E2E GitHub Test', path: tmpProjectRoot, templateId: 'empty' })
    const id = project.id
    assert(!!id, 'test project created')

    await callApiOk(driver, 'git.initRepo', id)
    fs.writeFileSync(path.join(tmpProjectRoot, 'README.md'), '# e2e test repo\n')
    const commit1 = await callApiOk(driver, 'git.commit', id, 'Initial commit')
    assert(commit1.ok === true, `first commit succeeded (pushed=${commit1.pushed}, expected false — no origin configured)`)
    assert(commit1.pushed === false, 'first commit push correctly failed gracefully (no origin remote)')

    // ── Tags (local git, no GitHub API) ───────────────────────────────────
    const tagsBefore = await callApiOk(driver, 'git.listTags', id)
    assert(Array.isArray(tagsBefore) && tagsBefore.length === 0, 'no tags before creating one')

    const tagResult = await callApiOk(driver, 'git.createTag', id, 'v1.0.0', 'first tag')
    assert(tagResult.ok === true, `tag created (pushed=${tagResult.pushed}, expected false — no origin remote)`)
    assert(tagResult.pushed === false, 'tag push correctly failed gracefully (no origin remote)')

    const tagsAfter = await callApiOk(driver, 'git.listTags', id)
    assert(tagsAfter.length === 1 && tagsAfter[0].name === 'v1.0.0', `git_list_tags returns the new tag (got ${JSON.stringify(tagsAfter)})`)

    // ── Changelog: commits + diff between two refs ────────────────────────
    fs.writeFileSync(path.join(tmpProjectRoot, 'CHANGES.md'), 'added after the tag\n')
    await callApiOk(driver, 'git.commit', id, 'Second commit')

    const commitsBetween = await callApiOk(driver, 'git.getCommitsBetween', id, 'v1.0.0', 'HEAD')
    assert(commitsBetween.length === 1 && commitsBetween[0].message === 'Second commit',
      `git_get_commits_between returns exactly the post-tag commit (got ${JSON.stringify(commitsBetween)})`)

    const diffResult = await callApiOk(driver, 'git.diffBetweenRefs', id, 'v1.0.0', 'HEAD')
    assert(diffResult.diff.includes('CHANGES.md') && diffResult.diff.includes('added after the tag'),
      'git_diff_between_refs returns a real unified diff containing the new file')

    const dates = await callApiOk(driver, 'git.getCommitDates', id, 10)
    assert(Array.isArray(dates) && dates.length === 2 && /^\d{4}-\d{2}-\d{2}$/.test(dates[0]),
      `git_get_commit_dates returns one YYYY-MM-DD entry per commit (got ${JSON.stringify(dates)})`)

    // ── Activity log picked up the tag creation ───────────────────────────
    const activity = await callApiOk(driver, 'activity.getAll', 50)
    assert(activity.some(a => a.type === 'git.tag_created' && a.projectId === id), 'git.tag_created activity entry was logged')

    // ── GitHub API: real read-only call against a stable public demo repo ─
    await callApiOk(driver, 'projects.edit', id, { github: 'octocat/Hello-World' })
    const repoInfo = await callApiOk(driver, 'github.getRepoInfo', id)
    assert(typeof repoInfo.stars === 'number', `stars is a number (got ${repoInfo.stars})`)
    assert(typeof repoInfo.forks === 'number', `forks is a number (got ${repoInfo.forks})`)
    assert(typeof repoInfo.defaultBranch === 'string' && repoInfo.defaultBranch.length > 0, `defaultBranch present (got ${repoInfo.defaultBranch})`)
    assert(typeof repoInfo.htmlUrl === 'string' && repoInfo.htmlUrl.includes('octocat/Hello-World'), `htmlUrl points at the right repo (got ${repoInfo.htmlUrl})`)
    assert(repoInfo.openPRs === -1 || repoInfo.openPRs >= 0, `openPRs is either -1 (unavailable) or a real count (got ${repoInfo.openPRs})`)

    const releases = await callApiOk(driver, 'github.listReleases', id)
    assert(Array.isArray(releases), `github_list_releases returns an array (got ${JSON.stringify(releases)})`)

    // ── Guard clauses fail cleanly, with no network call reaching GitHub ──
    const noTokenResult = await callApi(driver, 'github.createRelease', id, { tagName: 'v9.9.9', target: 'main', name: 'nope', body: '', draft: false, prerelease: false })
    assert(noTokenResult.ok === false, 'github_create_release rejects when no GitHub token is configured')
    assert(/token/i.test(noTokenResult.error), `error message mentions the missing token (got "${noTokenResult.error}")`)

    const unlinkedProject = await callApiOk(driver, 'projects.create', { name: 'E2E No GitHub Link', path: fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-nolink-')), templateId: 'empty' })
    const unlinkedResult = await callApi(driver, 'github.getRepoInfo', unlinkedProject.id)
    assert(unlinkedResult.ok === false, 'github_get_repo_info rejects for a project with no linked GitHub repo')
    assert(/no linked github/i.test(unlinkedResult.error), `error message is descriptive (got "${unlinkedResult.error}")`)

    log('ALL CHECKS PASSED')
  } finally {
    log('restoring original settings.json and shutting down...')
    try { if (driver) await driver.quit() } catch (e) { log(`driver.quit() error (non-fatal): ${e.message}`) }
    driverProc.kill()
    fs.writeFileSync(settingsPath, originalSettings)
    fs.rmSync(tmpDataDir, { recursive: true, force: true })
    fs.rmSync(tmpProjectRoot, { recursive: true, force: true })
  }
}

main().catch(err => {
  console.error(`[e2e] FAILED: ${err.message}`)
  process.exitCode = 1
})
