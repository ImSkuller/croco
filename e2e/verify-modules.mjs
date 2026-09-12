// Drives the real, compiled Croco app to verify the new Modules feature
// (docs/modules-plan.md): Settings → Modules toggles persisting, the
// Discord module's Rich Presence + webhook commands, the IDE module's
// path-guarded file read/write, and the AI module's Storage Brain
// (memory/encyclopedia CRUD, search, project summary, chat gating).
//
// Same pattern as e2e/verify-obsidian-sync.mjs: real window.api.* calls
// against a throwaway, isolated settings.app.dataPath — see that file's
// header comment and .claude/skills/run-croco-e2e/SKILL.md for the
// one-time machine setup and the "why a release build" / "why isolate
// settings.json before launch" gotchas this script relies on.
//
// Run with: node e2e/verify-modules.mjs

import { Builder } from 'selenium-webdriver'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const appPath = path.join(repoRoot, 'src-tauri', 'target', 'release', 'croco.exe')
const DRIVER_PORT = 4739 // distinct from verify-obsidian-sync.mjs's port in case both ever run close together

function log(msg) { console.log(`[e2e] ${msg}`) }
function assert(cond, msg) { if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`); log(`ok: ${msg}`) }

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
  return result
}
async function callApiOk(driver, dotted, ...args) {
  const r = await callApi(driver, dotted, ...args)
  if (!r.ok) throw new Error(`window.api.${dotted}(${args.map(a => JSON.stringify(a)).join(', ')}) rejected: ${r.error}`)
  return r.value
}

async function main() {
  if (!fs.existsSync(appPath)) throw new Error(`App binary not found at ${appPath} — run \`npm run tauri:build\` first.`)

  const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-modules-data-'))
  const tmpProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'croco-e2e-modules-proj-'))
  log(`temp data dir: ${tmpDataDir}`)
  log(`temp project dir: ${tmpProjectDir}`)

  const originalParsed = { app: { onboarded: true } } // fresh isolated profile — the real settings.json is never read or written (CROCO_DATA_DIR)
  const isolatedSettings = { ...originalParsed, app: { ...originalParsed.app, dataPath: tmpDataDir } }
  fs.writeFileSync(path.join(tmpDataDir, 'settings.json'), JSON.stringify(isolatedSettings, null, 2))
  log('wrote isolated settings.json (temp dataPath) before launching the app')

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

    await waitFor(async () => {
      try { return await driver.executeScript('return !!window.api') } catch { return false }
    }, { timeoutMs: 20000, label: 'window.api to be ready' })
    assert(true, 'app launched and window.api is available')

    // ── Module toggles persist ───────────────────────────────────────────
    await callApiOk(driver, 'settings.update', {
      modules: {
        discord: { enabled: true, richPresence: { enabled: true }, webhook: { enabled: true } },
        ide: { enabled: true, editor: { fontSize: 16, tabSize: 4, wordWrap: 'on' } },
        ai: { enabled: true, provider: 'anthropic', ollama: { host: 'http://localhost:11434', model: 'llama3.1' } },
        docker: { enabled: true },
        envManager: { enabled: true },
        slack: { enabled: true, webhook: { enabled: true } },
        focusTimer: { enabled: true, workMinutes: 30, breakMinutes: 10 },
      },
    })
    const settingsAfter = await callApiOk(driver, 'settings.get')
    assert(settingsAfter.modules.discord.enabled === true, 'discord module enabled persisted')
    assert(settingsAfter.modules.discord.richPresence.enabled === true, 'discord richPresence persisted')
    assert(settingsAfter.modules.discord.webhook.enabled === true, 'discord webhook sub-toggle persisted')
    assert(settingsAfter.modules.ide.enabled === true, 'ide module enabled persisted')
    assert(settingsAfter.modules.ide.editor.fontSize === 16, 'ide editor fontSize persisted')
    assert(settingsAfter.modules.ide.editor.tabSize === 4, 'ide editor tabSize persisted')
    assert(settingsAfter.modules.ai.enabled === true, 'ai module enabled persisted')
    assert(settingsAfter.modules.ai.provider === 'anthropic', 'ai module provider persisted')
    assert(settingsAfter.modules.ai.ollama.model === 'llama3.1', 'ai ollama model persisted')
    assert(settingsAfter.modules.docker.enabled === true, 'docker module enabled persisted')
    assert(settingsAfter.modules.envManager.enabled === true, 'envManager module enabled persisted')
    assert(settingsAfter.modules.slack.enabled === true, 'slack module enabled persisted')
    assert(settingsAfter.modules.slack.webhook.enabled === true, 'slack webhook sub-toggle persisted')
    assert(settingsAfter.modules.focusTimer.enabled === true, 'focusTimer module enabled persisted')
    assert(settingsAfter.modules.focusTimer.workMinutes === 30, 'focusTimer workMinutes persisted')

    // ── Discord: rich presence is a silent no-op with no Discord running ──
    const setPresence = await callApi(driver, 'discord.setPresence', 'Editing E2E Test Project', 'Overview')
    assert(setPresence.ok, `discord_set_presence resolves without throwing even with no Discord client running (got: ${setPresence.error})`)
    const clearActivity = await callApi(driver, 'discord.clearActivity')
    assert(clearActivity.ok, `discord_clear_activity resolves without throwing (got: ${clearActivity.error})`)

    // ── Discord: webhook test fails clearly with no URL set ──────────────
    // The webhook URL lives in the OS keyring, not settings.json, so it
    // survives across e2e runs on this machine unless explicitly cleared —
    // start from a known-clean state rather than assuming none is set.
    await callApiOk(driver, 'settings.setDiscordWebhook', '')
    const webhookNoUrl = await callApi(driver, 'discord.webhookTest')
    assert(webhookNoUrl.ok === false, 'discord_webhook_test rejects when no webhook URL is stored')
    assert(/no discord webhook url/i.test(webhookNoUrl.error), `error message is descriptive (got "${webhookNoUrl.error}")`)

    // ── Discord: webhook URL stores in keyring, not settings.json ────────
    await callApiOk(driver, 'settings.setDiscordWebhook', 'https://discord.com/api/webhooks/000000000000000000/fake-token-for-e2e')
    const settingsAfterWebhook = await callApiOk(driver, 'settings.get')
    assert(settingsAfterWebhook.modules.discord.webhook.urlStored === true, 'webhook urlStored flag flips true after saving')
    assert(JSON.stringify(settingsAfterWebhook).includes('fake-token-for-e2e') === false, 'raw webhook URL never comes back through settings_get')
    const rawSettingsFile = fs.readFileSync(path.join(tmpDataDir, 'settings.json'), 'utf8')
    assert(!rawSettingsFile.includes('fake-token-for-e2e'), 'raw webhook URL never persisted to settings.json on disk')

    // ── IDE: file tree + read/write with path-traversal guard ────────────
    fs.writeFileSync(path.join(tmpProjectDir, 'hello.txt'), 'original content\n')
    fs.mkdirSync(path.join(tmpProjectDir, 'secret-outside-sibling')) // just a normal subfolder, not actually outside root — real escape tested via '../' below
    const project = await callApiOk(driver, 'projects.create', { name: 'E2E IDE Test', path: tmpProjectDir, templateId: 'empty' })
    assert(!!project.id, 'test project created for IDE module')

    const tree = await callApiOk(driver, 'projects.getFileTree', project.id)
    const helloNode = tree.find(n => n.name === 'hello.txt')
    assert(!!helloNode, 'file tree includes hello.txt')

    const content = await callApiOk(driver, 'ide.readFile', project.id, helloNode.rel)
    assert(content === 'original content\n', `ide_read_file returns real file content (got ${JSON.stringify(content)})`)

    await callApiOk(driver, 'ide.writeFile', project.id, helloNode.rel, 'edited by e2e\n')
    const onDisk = fs.readFileSync(path.join(tmpProjectDir, 'hello.txt'), 'utf8')
    assert(onDisk === 'edited by e2e\n', 'ide_write_file actually wrote to disk')
    const rereadViaApi = await callApiOk(driver, 'ide.readFile', project.id, helloNode.rel)
    assert(rereadViaApi === 'edited by e2e\n', 'ide_read_file reflects the write')

    const escapeAttempt = await callApi(driver, 'ide.readFile', project.id, '../../../../../../windows/win.ini')
    assert(escapeAttempt.ok === false, 'ide_read_file rejects a path-traversal attempt outside the project root')

    // ── Docker: no compose file in this project ───────────────────────────
    const dockerAvailable = await callApiOk(driver, 'docker.available', project.id)
    assert(dockerAvailable === false, 'docker_compose_available is false for a project with no compose file')
    const servicesNoCompose = await callApi(driver, 'docker.services', project.id)
    assert(servicesNoCompose.ok === false, 'docker_compose_services rejects cleanly with no compose file')

    // ── Env Manager: real .env file round-trip ────────────────────────────
    const envEmpty = await callApiOk(driver, 'envManager.read', project.id)
    assert(Array.isArray(envEmpty) && envEmpty.length === 0, 'env_read returns empty for a project with no .env file yet')
    await callApiOk(driver, 'envManager.write', project.id, [{ key: 'API_KEY', value: 'e2e-secret-value' }, { key: 'PORT', value: '3000' }])
    const envFileContent = fs.readFileSync(path.join(tmpProjectDir, '.env'), 'utf8')
    assert(envFileContent.includes('API_KEY=e2e-secret-value'), 'env_write wrote a real .env file to disk')
    const envReread = await callApiOk(driver, 'envManager.read', project.id)
    assert(envReread.length === 2 && envReread.some(e => e.key === 'PORT' && e.value === '3000'), 'env_read reflects the write')

    // ── Slack: webhook test fails clearly with no URL set ─────────────────
    await callApiOk(driver, 'settings.setSlackWebhook', '')
    const slackNoUrl = await callApi(driver, 'slack.webhookTest')
    assert(slackNoUrl.ok === false, 'slack_webhook_test rejects when no webhook URL is stored')
    assert(/no slack webhook url/i.test(slackNoUrl.error), `error message is descriptive (got "${slackNoUrl.error}")`)

    // ── Ollama: lists models or fails cleanly, never hangs ────────────────
    const ollamaModels = await callApi(driver, 'ai.ollamaListModels', 'http://localhost:11434')
    if (ollamaModels.ok) {
      assert(Array.isArray(ollamaModels.value), 'ollama_list_models returns an array when Ollama is reachable')
    } else {
      assert(/could not reach ollama/i.test(ollamaModels.error), `ollama_list_models fails with a descriptive error when unreachable (got "${ollamaModels.error}")`)
    }

    // ── Focus Timer: session start/end + daily stats round-trip ──────────
    const focusSession = await callApiOk(driver, 'focus.start', project.id, 'work')
    assert(!!focusSession.id && focusSession.endedAt === null, 'focus_session_start returns an active session')
    const activeFocus = await callApiOk(driver, 'focus.getActive')
    assert(activeFocus?.id === focusSession.id, 'focus_session_get_active reflects the started session')
    const endedFocus = await callApiOk(driver, 'focus.end', focusSession.id)
    assert(endedFocus.endedAt !== null, 'focus_session_end sets endedAt')
    const noActiveFocus = await callApiOk(driver, 'focus.getActive')
    assert(noActiveFocus === null, 'no active session after ending it')
    const focusStats = await callApiOk(driver, 'focus.getTodayStats')
    assert(focusStats.sessionsCompleted >= 1, `today's focus stats count the completed session (got ${focusStats.sessionsCompleted})`)

    // ── AI Storage Brain: memories are real .md files ────────────────────
    const brainDir = path.join(tmpDataDir, 'brain')
    const memory = await callApiOk(driver, 'ai.brain.memoryCreate', 'E2E Test Memory', 'This is the body of an e2e test memory.', null, ['e2e', 'test'], 4)
    assert(!!memory.id, 'brain_memory_create returns an entry with an id')
    const memoryFile = path.join(brainDir, 'memories', `${memory.id}.md`)
    assert(fs.existsSync(memoryFile), `memory saved as a real .md file at ${memoryFile}`)
    const memoryFileContent = fs.readFileSync(memoryFile, 'utf8')
    assert(memoryFileContent.startsWith('---\n'), 'memory .md file has YAML frontmatter')
    assert(memoryFileContent.includes('This is the body of an e2e test memory.'), 'memory .md file body is human-readable markdown')

    const memoryList = await callApiOk(driver, 'ai.brain.memoryList')
    assert(memoryList.some(m => m.id === memory.id), 'the new memory shows up in brain_memory_list')

    const searchResults = await callApiOk(driver, 'ai.brain.search', 'e2e test memory')
    assert(searchResults.some(r => r.id === memory.id), 'brain_search finds the memory by keyword')

    await callApiOk(driver, 'ai.brain.memoryUpdate', memory.id, { importance: 5 })
    const updated = await callApiOk(driver, 'ai.brain.memoryGet', memory.id)
    assert(updated.importance === 5, 'brain_memory_update persists a change')

    await callApiOk(driver, 'ai.brain.memoryDelete', memory.id)
    assert(!fs.existsSync(memoryFile), 'brain_memory_delete removes the .md file from disk')

    // ── AI Storage Brain: encyclopedia CRUD (same shape, separate dir) ───
    const enc = await callApiOk(driver, 'ai.brain.encyclopediaCreate', 'E2E Encyclopedia Entry', 'Encyclopedia body.', ['e2e'], 3)
    const encFile = path.join(brainDir, 'encyclopedia', `${enc.id}.md`)
    assert(fs.existsSync(encFile), 'encyclopedia entry saved as a separate .md file')
    await callApiOk(driver, 'ai.brain.encyclopediaDelete', enc.id)
    assert(!fs.existsSync(encFile), 'encyclopedia entry deleted from disk')

    // ── AI Storage Brain: deterministic per-project summary ──────────────
    const summary = await callApiOk(driver, 'ai.brain.projectSummaryGenerate', project.id)
    assert(summary.body.includes('E2E IDE Test'), 'generated project summary mentions the project name')
    const summaryFile = path.join(brainDir, 'projects', `${project.id}.md`)
    assert(fs.existsSync(summaryFile), 'project summary saved to brain/projects/<id>.md')
    const fetchedSummary = await callApiOk(driver, 'ai.brain.projectSummaryGet', project.id)
    assert(fetchedSummary.body.includes('E2E IDE Test'), 'brain_project_summary_get returns the saved summary')

    // ── AI chat: gated on a stored provider key ───────────────────────────
    // This machine may already have a real Anthropic key stored from
    // earlier AI-commit-message use (settings.json is isolated for this
    // run, but the OS keyring is real and shared — never safe to clear a
    // key we can't read back and restore). Only assert the "no key" error
    // path when there's actually no key to find; the "module disabled"
    // check right below exercises the gating logic either way.
    if (!settingsAfter.ai?.keysStored?.anthropic) {
      const chatNoKey = await callApi(driver, 'ai.chat', 'chat', 'anthropic', null, 'e2e-conversation', 'hello')
      assert(chatNoKey.ok === false, 'ai_chat rejects when no API key is stored for the selected provider')
      assert(/no api key/i.test(chatNoKey.error), `error message is descriptive (got "${chatNoKey.error}")`)
    } else {
      log('skipping "no API key" assertion — a real Anthropic key is already stored on this machine')
    }

    // ── AI chat: ollama provider never requires a keyring key ─────────────
    // Same "accept either real outcome" shape as the ollama_list_models
    // check above — this machine may or may not have Ollama running.
    await callApiOk(driver, 'settings.update', { modules: { ai: { enabled: true } } })
    const chatOllama = await callApi(driver, 'ai.chat', 'chat', 'ollama', null, 'e2e-ollama-conversation', 'hello')
    if (!chatOllama.ok) {
      assert(/could not reach ollama|ollama error/i.test(chatOllama.error), `ai_chat with ollama fails cleanly (not a keyring/module error) when Ollama is unreachable (got "${chatOllama.error}")`)
    } else {
      assert(typeof chatOllama.value === 'string' && chatOllama.value.length > 0, 'ai_chat with ollama returns a reply when Ollama is reachable')
    }

    // ── AI chat: gated on the module being enabled ────────────────────────
    await callApiOk(driver, 'settings.update', { modules: { ai: { enabled: false } } })
    const chatModuleOff = await callApi(driver, 'ai.chat', 'chat', 'anthropic', null, 'e2e-conversation', 'hello')
    assert(chatModuleOff.ok === false, 'ai_chat rejects when the AI module itself is off')
    assert(/ai module is off/i.test(chatModuleOff.error), `error message is descriptive (got "${chatModuleOff.error}")`)

    log('ALL CHECKS PASSED')
  } finally {
    log('clearing test keyring secrets and restoring original settings.json...')
    // The webhook URL (and AI keys, if a test ever sets one) live in the OS
    // keyring, not settings.json — restoring settings.json alone would
    // leave a fake test value behind for the *next* run to trip over.
    try { if (driver) await callApi(driver, 'settings.setDiscordWebhook', '') } catch { /* best-effort */ }
    try { if (driver) await callApi(driver, 'settings.setSlackWebhook', '') } catch { /* best-effort */ }
    try { if (driver) await driver.quit() } catch (e) { log(`driver.quit() error (non-fatal): ${e.message}`) }
    driverProc.kill()
    fs.rmSync(tmpDataDir, { recursive: true, force: true })
    fs.rmSync(tmpProjectDir, { recursive: true, force: true })
  }
}

main().catch(err => {
  console.error(`[e2e] FAILED: ${err.message}`)
  process.exitCode = 1
})
