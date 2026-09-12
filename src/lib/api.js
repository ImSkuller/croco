// @ts-check
/**
 * Window.api compatibility shim for Tauri v2.
 * Mirrors the Electron preload interface so all React components
 * can call window.api.* without any changes.
 *
 * Dialog + opener operations are handled by Tauri frontend plugins.
 * Everything else is routed through invoke() to Rust commands.
 *
 * Type-checking note (Phase 5 item 6): this file is checked by `tsc` via
 * the leading `// @ts-check` pragma above (see tsconfig.json — checkJs is
 * off project-wide, files opt in individually). Parameters are typed from
 * the actual Rust command signatures in src-tauri/src/*.rs; return types
 * are deliberately left as `Promise<any>` rather than guessed at, since
 * modeling every command's exact JSON shape would need a full pass over
 * the Rust side to be accurate — `any` is honest about what hasn't been
 * done yet, not a placeholder pretending to be complete. Run
 * `npm run typecheck` to check this file (and any other that adds its own
 * `// @ts-check`) without a full TypeScript migration.
 */

import { invoke }    from '@tauri-apps/api/core'
import { listen }    from '@tauri-apps/api/event'
import { open, save } from '@tauri-apps/plugin-dialog'
import { isEnabled as isAutostartEnabled, enable as enableAutostart, disable as disableAutostart } from '@tauri-apps/plugin-autostart'
import { TEMPLATES } from './templates.js'

// ── Listen helper ─────────────────────────────────────────────────────────────
// Returns a sync cleanup function matching the Electron pattern.
//
// listen() is async, but React (StrictMode especially) can call the returned
// cleanup function before that promise resolves — mount, cleanup, mount again,
// all synchronously, before any microtask runs. Without the `cancelled` guard,
// the first cleanup call finds `unlisten` still null (a no-op), the real
// listener registration completes moments later and is never removed, and the
// second effect run adds a second, independent listener — so every emitted
// event (run:output, etc.) fires twice, duplicating streamed content. Once
// cancelled, resolve straight through to the real unlisten instead of storing it.
/**
 * @param {string} event
 * @param {(payload: any) => void} cb
 * @returns {() => void}
 */
function sub(event, cb) {
  /** @type {(() => void) | null} */
  let unlisten = null
  let cancelled = false
  listen(event, (e) => cb(e.payload)).then((fn) => {
    if (cancelled) fn()
    else unlisten = fn
  })
  return () => {
    cancelled = true
    unlisten?.()
  }
}

// ── API object ────────────────────────────────────────────────────────────────
export const api = {

  // ── Settings ────────────────────────────────────────────────────────────────
  settings: {
    /** @returns {Promise<any>} */
    get:         ()                        => invoke('settings_get'),
    /** @param {string} key @param {any} val @returns {Promise<any>} */
    set:         (key, val)                => invoke('settings_set',    { key, value: val }),
    /** @param {object} changes @returns {Promise<any>} */
    update:      (changes)                 => invoke('settings_update', { changes }),
    /** @returns {Promise<any>} */
    reset:       ()                        => invoke('settings_reset'),
    /** @param {string} token @returns {Promise<any>} */
    testGithub:  (token)                   => invoke('settings_test_github',  { token }),
    /** @param {string} filePath @returns {Promise<string>} data URI */
    saveAvatar:  (filePath)                => invoke('settings_save_avatar',  { filePath }),
    // Stored in the OS keyring, never in settings.json — pass '' to clear.
    /** @param {string} token @returns {Promise<void>} */
    setGithubToken: (token)                => invoke('settings_set_github_token', { token }),
    // Also keyring-backed — pass '' to clear. provider is 'anthropic' | 'openai' | 'gemini'.
    /** @param {string} provider @param {string} key @returns {Promise<void>} */
    setAiKey:    (provider, key)           => invoke('settings_set_ai_key', { provider, key }),
    // Also keyring-backed — pass '' to clear.
    /** @param {string} url @returns {Promise<void>} */
    setDiscordWebhook: (url)               => invoke('settings_set_discord_webhook', { url }),
    // Also keyring-backed — pass '' to clear.
    /** @param {string} url @returns {Promise<void>} */
    setSlackWebhook: (url)                 => invoke('settings_set_slack_webhook', { url }),
  },

  // ── Projects ─────────────────────────────────────────────────────────────────
  projects: {
    /** @returns {Promise<any[]>} */
    getAll:    ()    => invoke('projects_get_all'),
    /** @param {string} id @returns {Promise<any>} */
    getById:   (id)  => invoke('projects_get_by_id',  { id }),

    /** @param {any} data @returns {Promise<any>} */
    create: async (data) => {
      // Generate template files in JS before handing to Rust
      let templateFiles = data.templateFiles || null
      if (data.templateId && data.templateId !== 'empty' && !templateFiles) {
        const tmpl = TEMPLATES.find(t => t.id === data.templateId)
        if (tmpl && typeof tmpl.files === 'function') {
          templateFiles = tmpl.files(data.name)
        }
      }
      return invoke('projects_create', { data: { ...data, templateFiles } })
    },

    /** @param {string} path @param {any} [opts] @returns {Promise<any>} */
    import:               (path, opts)    => invoke('projects_import',               { folderPath: path, opts }),
    /** @param {string} id @param {any} changes @returns {Promise<any>} */
    edit:                 (id, changes)   => invoke('projects_edit',                 { id, changes }),
    /** @param {string} id @returns {Promise<any>} moves to trash (recoverable) */
    delete:               (id)            => invoke('projects_delete',               { id }),
    /** @param {string} id @returns {Promise<any>} */
    restore:              (id)            => invoke('projects_restore',              { id }),
    /** @param {string} id @returns {Promise<any>} permanent — bypasses trash */
    deletePermanently:    (id)            => invoke('projects_delete_permanently',   { id }),
    /** @param {string} id @returns {Promise<any>} */
    openInIDE:            (id)            => invoke('projects_open_in_ide',          { id }),
    /** @param {string} id @returns {Promise<any>} */
    openFolder:           (id)            => invoke('projects_open_folder',          { id }),
    /** @param {string} id @returns {Promise<any>} */
    toggleFavorite:       (id)            => invoke('projects_toggle_favorite',      { id }),
    /** @param {number} [limit] @returns {Promise<any[]>} */
    getRecents:           (limit)         => invoke('projects_get_recents',          { limit }),
    /** @param {string} id @returns {Promise<string[]>} */
    detectLanguages:      (id)            => invoke('projects_detect_languages',     { id }),
    /** @param {string} root @returns {Promise<any>} */
    autoDetectCommands:   (root)          => invoke('projects_auto_detect_commands', { root }),
    /** @param {string} id @returns {Promise<any>} */
    removeLocalFiles:     (id)            => invoke('projects_remove_local_files',   { id }),
    /** @param {string} id @returns {Promise<any>} */
    deleteGithubRepo:     (id)            => invoke('projects_delete_github_repo',   { id }),
    /** @param {string} id @returns {Promise<any>} */
    getDependencies:      (id)            => invoke('projects_get_dependencies',     { id }),
    /** @param {string} id @returns {Promise<any>} */
    installDependencies:  (id)            => invoke('projects_install_dependencies', { id }),
    /** @param {string} id @returns {Promise<any>} */
    updateDependencies:   (id)            => invoke('projects_update_dependencies',  { id }),
    /** @param {string} id @param {string} name @param {boolean} [dev] @returns {Promise<any>} */
    addDependency:        (id, name, dev) => invoke('projects_add_dependency',       { id, name, dev: dev ?? false }),
    /** @param {string} id @param {string} name @returns {Promise<any>} */
    removeDependency:     (id, name)      => invoke('projects_remove_dependency',    { id, name }),
    /** @param {string} id @returns {Promise<any>} */
    getFileTree:          (id)            => invoke('projects_get_file_tree',        { id }),
    /** @param {string} id @returns {Promise<any>} */
    getScripts:           (id)            => invoke('projects_get_scripts',          { id }),
    /** @param {string} id @param {string} newName @returns {Promise<any>} */
    rename:               (id, newName)   => invoke('projects_rename',               { id, newName }),
    /** @param {string} id @param {boolean} archived @returns {Promise<any>} */
    setArchived:          (id, archived)  => invoke('projects_set_archived',         { id, archived }),
    /** @param {string} id @param {string} repoName @param {string} description @param {boolean} priv @returns {Promise<any>} */
    publishToGithub:      (id, repoName, description, priv) => invoke('projects_publish_to_github', { id, repoName, description, private: priv }),

    // Community templates (Phase 6 item 12) — local-first export/import,
    // no hosted marketplace. Export returns the template JSON for the
    // frontend to write wherever the user picks (system.showSavePicker +
    // system.writeBytes); import is just projects.create with the parsed
    // file's `files` passed straight through as templateFiles.
    /** @param {string} id @param {string} name @param {string} [description] @returns {Promise<any>} */
    exportAsTemplate: (id, name, description) => invoke('projects_export_as_template', { id, name, description: description || '' }),
  },

  // ── Templates ────────────────────────────────────────────────────────────────
  templates: {
    /** @returns {Promise<any[]>} */
    list: () => invoke('templates_list'),
  },

  // ── Activity ─────────────────────────────────────────────────────────────────
  activity: {
    /** @param {number} [limit] @returns {Promise<any[]>} */
    getAll: (limit) => invoke('activity_get_all', { limit }),
    /** @returns {Promise<void>} */
    clear:  ()      => invoke('activity_clear'),
  },

  // ── Run ──────────────────────────────────────────────────────────────────────
  run: {
    /** @param {string} projectId @param {string} commandType @param {object} [env] @param {boolean} [confirmed] @returns {Promise<any>} */
    start:      (projectId, commandType, env, confirmed) => invoke('run_start', { projectId, commandType, env: env || {}, confirmed: confirmed || false }),
    /** @param {string} projectId @returns {Promise<any>} */
    stop:       (projectId)                   => invoke('run_stop',       { projectId }),
    /** @returns {Promise<string[]>} */
    getRunning: ()                            => invoke('run_get_running'),
    /** @param {string} projectId @returns {Promise<boolean>} */
    isRunning:  (projectId)                   => invoke('run_is_running', { projectId }),

    /** @param {(payload: any) => void} cb @returns {() => void} */
    onOutput:   (cb) => sub('run:output',   cb),
    /** @param {(payload: any) => void} cb @returns {() => void} */
    onStarted:  (cb) => sub('run:started',  cb),
    /** @param {(payload: any) => void} cb @returns {() => void} */
    onFinished: (cb) => sub('run:finished', cb),
  },

  // ── Git ──────────────────────────────────────────────────────────────────────
  git: {
    /** @param {number} [limit] @returns {Promise<any[]>} */
    getAllRecentCommits: (limit)  => invoke('git_get_all_recent_commits', { limit }),
    /** @returns {Promise<any>} */
    syncAllLastCommitDates: ()    => invoke('git_sync_all_last_commit_dates'),
    /** @param {string} id @returns {Promise<any>} */
    status:         (id)         => invoke('git_status',           { id }),
    /** @param {string} id @param {string} msg @returns {Promise<any>} */
    commit:         (id, msg)    => invoke('git_commit',           { id, msg }),
    /** @param {string} id @param {number} [limit] @returns {Promise<any[]>} */
    getLog:         (id, limit)  => invoke('git_get_log',          { id, limit }),
    /** @param {string} root @returns {Promise<boolean>} */
    isRepo:         (root)       => invoke('git_is_repo',          { root }),
    /** @param {string} id @returns {Promise<any[]>} */
    getBranches:    (id)         => invoke('git_get_branches',     { id }),
    /** @param {string} id @param {string} branch @returns {Promise<any>} */
    switchBranch:   (id, branch) => invoke('git_switch_branch',    { id, branch }),
    /** @param {string} id @param {string} branch @returns {Promise<any>} */
    createBranch:   (id, branch) => invoke('git_create_branch',    { id, branch }),
    /** @param {string} id @returns {Promise<any>} */
    push:           (id)         => invoke('git_push',             { id }),
    /** @param {string} id @returns {Promise<any>} */
    getReadme:      (id)         => invoke('git_get_readme',       { id }),
    /** @param {string} id @returns {Promise<any>} */
    pull:           (id)         => invoke('git_pull',             { id }),
    /** @param {string} id @returns {Promise<any>} */
    getAheadBehind: (id)         => invoke('git_get_ahead_behind', { id }),
    /** @param {string} id @returns {Promise<any>} */
    initRepo:       (id)         => invoke('git_init_repo',        { id }),
    /** @param {string} id @param {string} entry @returns {Promise<any>} */
    addToGitignore: (id, entry)  => invoke('git_add_to_gitignore', { id, entry }),
    /** @param {string} id @param {string[]} paths @returns {Promise<any>} */
    stageFiles:     (id, paths)  => invoke('git_stage_files',      { id, paths }),
    /** @param {string} id @param {string[]} paths @returns {Promise<any>} */
    unstageFiles:   (id, paths)  => invoke('git_unstage_files',    { id, paths }),
    /** @param {string} id @param {string} path @param {string} kind @returns {Promise<any>} */
    diffFile:       (id, path, kind) => invoke('git_diff_file',    { id, path, kind }),

    // Tags & version-diffing — GitHub page (Releases, Changelog, Insights tabs)
    /** @param {string} id @returns {Promise<any[]>} */
    listTags:          (id)               => invoke('git_list_tags',           { id }),
    /** @param {string} id @param {string} tagName @param {string} [message] @returns {Promise<any>} */
    createTag:         (id, tagName, message) => invoke('git_create_tag',      { id, tagName, message }),
    /** @param {string} id @param {string} fromRef @param {string} toRef @returns {Promise<any[]>} */
    getCommitsBetween: (id, fromRef, toRef)   => invoke('git_get_commits_between', { id, fromRef, toRef }),
    /** @param {string} id @param {string} fromRef @param {string} toRef @returns {Promise<any>} */
    diffBetweenRefs:   (id, fromRef, toRef)   => invoke('git_diff_between_refs',   { id, fromRef, toRef }),
    /** @param {string} id @param {number} [limit] @returns {Promise<any[]>} */
    getCommitDates:    (id, limit)         => invoke('git_get_commit_dates',    { id, limit }),

    // AI-generated commit message (Phase 6 item 6) — opt-in, see Settings → AI.
    /** @param {string} id @returns {Promise<string>} */
    generateCommitMessage: (id) => invoke('ai_generate_commit_message', { id }),
  },

  // ── Local HTTP API (Phase 6 item 7) — opt-in, see Settings → Local API ─────────
  localApi: {
    /** Re-applies settings.api.{enabled,port}: stops/starts the loopback server as needed.
     * @returns {Promise<{running: boolean, port?: number, tokenJustGenerated?: string|null}>} */
    apply: () => invoke('local_api_apply'),
    /** @returns {Promise<string>} the new token (shown once — not retrievable afterward) */
    regenerateToken: () => invoke('local_api_regenerate_token'),
  },

  // ── System ───────────────────────────────────────────────────────────────────
  system: {
    /** @param {string} p @returns {Promise<any>} */
    openPath:     (p)   => invoke('system_open_path',     { p }),
    /** @param {string} url @returns {Promise<void>} */
    openExternal: (url) => invoke('system_open_external', { url }),
    /** @param {string} label @param {string} url @param {string} title @returns {Promise<void>} */
    openInAppBrowser: (label, url, title) => invoke('system_open_in_app_browser', { label, url, title }),

    /** @param {string} [defaultPath] @returns {Promise<string | null>} */
    showFolderPicker: async (defaultPath) => {
      const result = await open({ directory: true, defaultPath: defaultPath || undefined })
      return result ?? null
    },
    /** @param {string} [defaultPath] @param {any[]} [filters] @returns {Promise<string | null>} */
    showFilePicker: async (defaultPath, filters) => {
      const result = await open({ multiple: false, defaultPath: defaultPath || undefined, filters: filters || [] })
      return result ?? null
    },
    /** @param {string} [defaultPath] @param {any[]} [filters] @returns {Promise<string | null>} */
    showSavePicker: async (defaultPath, filters) => {
      const result = await save({ defaultPath: defaultPath || undefined, filters: filters || [] })
      return result ?? null
    },

    /** @param {string} path @param {number[]} data @returns {Promise<any>} */
    writeBytes:             (path, data) => invoke('system_write_bytes',            { path, data }),
    /** @param {string} path @returns {Promise<string>} */
    readTextFile:           (path)       => invoke('system_read_text_file',         { path }),
    /** @param {string} p @returns {Promise<boolean>} */
    pathExists:             (p)        => invoke('system_path_exists',              { p }),
    /** @returns {Promise<string>} */
    homedir:                ()         => invoke('system_homedir'),
    /** @returns {Promise<string>} */
    platform:               ()         => invoke('system_platform'),
    /** @returns {Promise<string>} */
    userData:               ()         => invoke('system_user_data'),
    /** @param {string} username @returns {Promise<any>} */
    lookupCommunityUser:    (username) => invoke('system_lookup_community_user',    { githubUsername: username }),
    /** @param {string} username @returns {Promise<any>} */
    validateGithubUsername: (username) => invoke('system_validate_github_username', { username }),

    // croco:// deep links (Phase 6 item 11) — fires with a router path
    // (e.g. "/projects/<id>") whenever this launch was triggered by, or
    // later receives, a registered deep link. Rust-side only; no
    // @tauri-apps/plugin-deep-link needed on this side.
    /** @param {(path: string) => void} cb @returns {() => void} */
    onDeepLink: (cb) => sub('deep-link:navigate', cb),
  },

  // ── Notes ────────────────────────────────────────────────────────────────────
  notes: {
    /** @param {string} [projectId] @returns {Promise<any[]>} */
    getAll:  (projectId)   => invoke('notes_get_all',  { projectId }),
    /** @param {string} id @returns {Promise<any>} */
    getById: (id)          => invoke('notes_get_by_id', { id }),
    /** @param {any} data @returns {Promise<any>} */
    create:  (data)        => invoke('notes_create',   { data }),
    /** @param {string} id @param {any} changes @returns {Promise<any>} */
    update:  (id, changes) => invoke('notes_update',   { id, changes }),
    /** @param {string} id @returns {Promise<any>} moves to trash (recoverable) */
    delete:  (id)          => invoke('notes_delete',   { id }),
    /** @param {string} id @returns {Promise<any>} */
    restore: (id)          => invoke('notes_restore',  { id }),
    /** @param {string} id @returns {Promise<any>} permanent — bypasses trash */
    deletePermanently: (id) => invoke('notes_delete_permanently', { id }),
  },

  // ── Obsidian vault sync ─────────────────────────────────────────────────────
  obsidian: {
    /** @returns {Promise<any>} */
    syncAll:       ()     => invoke('obsidian_sync_all'),
    /** @param {string} path @returns {Promise<any>} */
    testVaultPath: (path) => invoke('obsidian_test_vault_path', { path }),
  },

  // ── AI module (beta) — Storage Brain + chat ──────────────────────────────────
  ai: {
    /** @param {string} mode 'chat'|'research'|'plan'|'code' @param {string} provider @param {string|null} projectId @param {string} conversationId @param {string} message @returns {Promise<string>} */
    chat: (mode, provider, projectId, conversationId, message) =>
      invoke('ai_chat', { mode, provider, projectId, conversationId, message }),
    /** @param {string} host @returns {Promise<string[]>} */
    ollamaListModels: (host) => invoke('ollama_list_models', { host }),
    brain: {
      /** @returns {Promise<any[]>} */
      rebuildIndex: () => invoke('brain_rebuild_index'),
      /** @param {string} query @returns {Promise<any[]>} */
      search:       (query) => invoke('brain_search', { query }),

      /** @param {string} title @param {string} body @param {string|null} project @param {string[]} tags @param {number} importance @returns {Promise<any>} */
      memoryCreate: (title, body, project, tags, importance) => invoke('brain_memory_create', { title, body, project, tags, importance }),
      /** @returns {Promise<any>} */
      memoryUpdate: (id, changes) => invoke('brain_memory_update', { id, ...changes }),
      /** @returns {Promise<void>} */
      memoryDelete: (id) => invoke('brain_memory_delete', { id }),
      /** @returns {Promise<any>} */
      memoryGet:    (id) => invoke('brain_memory_get', { id }),
      /** @returns {Promise<any[]>} */
      memoryList:   () => invoke('brain_memory_list'),

      /** @returns {Promise<any>} */
      encyclopediaCreate: (title, body, tags, importance) => invoke('brain_encyclopedia_create', { title, body, tags, importance }),
      /** @returns {Promise<any>} */
      encyclopediaUpdate: (id, changes) => invoke('brain_encyclopedia_update', { id, ...changes }),
      /** @returns {Promise<void>} */
      encyclopediaDelete: (id) => invoke('brain_encyclopedia_delete', { id }),
      /** @returns {Promise<any>} */
      encyclopediaGet:    (id) => invoke('brain_encyclopedia_get', { id }),
      /** @returns {Promise<any[]>} */
      encyclopediaList:   () => invoke('brain_encyclopedia_list'),

      /** @returns {Promise<any>} */
      projectSummaryGenerate: (projectId) => invoke('brain_project_summary_generate', { projectId }),
      /** @returns {Promise<any|null>} */
      projectSummaryGet:      (projectId) => invoke('brain_project_summary_get', { projectId }),

      /** @returns {Promise<any[]>} */
      conversationGet:    (id) => invoke('brain_conversation_get', { id }),
      /** @returns {Promise<void>} */
      conversationDelete: (id) => invoke('brain_conversation_delete', { id }),
    },
  },

  // ── Slack module (beta) ──────────────────────────────────────────────────────
  slack: {
    /** @returns {Promise<void>} throws with a message on failure */
    webhookTest: () => invoke('slack_webhook_test'),
  },

  // ── Docker module (beta) ─────────────────────────────────────────────────────
  docker: {
    /** @param {string} projectId @returns {Promise<boolean>} */
    available:      (projectId)          => invoke('docker_compose_available', { projectId }),
    /** @param {string} projectId @returns {Promise<{name:string, status:string}[]>} */
    services:       (projectId)          => invoke('docker_compose_services',  { projectId }),
    /** @param {string} projectId @param {string|null} service @returns {Promise<void>} */
    up:             (projectId, service) => invoke('docker_compose_up',    { projectId, service }),
    /** @param {string} projectId @param {string|null} service @returns {Promise<void>} */
    stop:           (projectId, service) => invoke('docker_compose_stop',  { projectId, service }),
    /** @param {string} projectId @returns {Promise<void>} */
    down:           (projectId)          => invoke('docker_compose_down',  { projectId }),
    /** @param {string} projectId @param {string|null} service @returns {Promise<string>} */
    logs:           (projectId, service) => invoke('docker_compose_logs',  { projectId, service }),
  },

  // ── Env Manager module (beta) ────────────────────────────────────────────────
  envManager: {
    /** @param {string} projectId @returns {Promise<{key:string, value:string}[]>} */
    read:  (projectId)          => invoke('env_read',  { projectId }),
    /** @param {string} projectId @param {{key:string, value:string}[]} entries @returns {Promise<void>} */
    write: (projectId, entries) => invoke('env_write', { projectId, entries }),
  },

  // ── Focus Timer module (beta) ────────────────────────────────────────────────
  focus: {
    /** @param {string|null} projectId @param {'work'|'break'} kind @returns {Promise<any>} */
    start:          (projectId, kind) => invoke('focus_session_start', { projectId, kind }),
    /** @param {string} id @returns {Promise<any>} */
    end:            (id)              => invoke('focus_session_end', { id }),
    /** @returns {Promise<any|null>} */
    getActive:      ()                => invoke('focus_session_get_active'),
    /** @param {number} [limit] @returns {Promise<any[]>} */
    getHistory:     (limit)           => invoke('focus_session_get_history', { limit }),
    /** @returns {Promise<{workMinutes:number, sessionsCompleted:number}>} */
    getTodayStats:  ()                => invoke('focus_session_get_today_stats'),
  },

  // ── IDE module (beta) ────────────────────────────────────────────────────────
  ide: {
    /** @param {string} projectId @param {string} relPath @returns {Promise<string>} */
    readFile:  (projectId, relPath)          => invoke('ide_read_file',  { projectId, relPath }),
    /** @param {string} projectId @param {string} relPath @param {string} content @returns {Promise<void>} */
    writeFile: (projectId, relPath, content) => invoke('ide_write_file', { projectId, relPath, content }),
  },

  // ── Discord module (beta) ────────────────────────────────────────────────────
  discord: {
    /** Silent no-op unless modules.discord.richPresence is on. @param {string} projectName @returns {Promise<void>} */
    setActivity:   (projectName) => invoke('discord_set_activity', { projectName }),
    /** @returns {Promise<void>} */
    clearActivity: ()            => invoke('discord_clear_activity'),
    /** @returns {Promise<void>} throws with a message on failure */
    webhookTest:   ()            => invoke('discord_webhook_test'),
  },

  // ── Personality / work-habits tracking ───────────────────────────────────────
  personality: {
    /** @returns {Promise<any>} */
    getProfile:          () => invoke('personality_get_profile'),
    /** @returns {Promise<any>} */
    backfillFromActivity: () => invoke('personality_backfill_from_activity'),
    /** @returns {Promise<any>} */
    scanCommits:          () => invoke('personality_scan_commits'),
    /** @returns {Promise<void>} */
    trackAppOpen:         () => invoke('personality_track_app_open'),
  },

  // ── Todos ─────────────────────────────────────────────────────────────────────
  todos: {
    /** @param {string} [projectId] @returns {Promise<any[]>} */
    getAll:  (projectId)   => invoke('todos_get_all',  { projectId }),
    /** @param {any} data @returns {Promise<any>} */
    create:  (data)        => invoke('todos_create',   { data }),
    /** @param {string} id @returns {Promise<any>} */
    toggle:  (id)          => invoke('todos_toggle',   { id }),
    /** @param {string} id @param {any} changes @returns {Promise<any>} */
    update:  (id, changes) => invoke('todos_update',   { id, changes }),
    /** @param {string} id @returns {Promise<any>} moves to trash (recoverable) */
    delete:  (id)          => invoke('todos_delete',   { id }),
    /** @param {string} id @returns {Promise<any>} */
    restore: (id)          => invoke('todos_restore',  { id }),
    /** @param {string} id @returns {Promise<any>} permanent — bypasses trash */
    deletePermanently: (id) => invoke('todos_delete_permanently', { id }),
  },

  // ── Schedules & deadlines (distinct from todos — dated, with a
  // description and attachable notes) ─────────────────────────────────────────
  schedules: {
    /** @param {string} [projectId] @returns {Promise<any[]>} */
    getAll:  (projectId)   => invoke('schedules_get_all',  { projectId }),
    /** @param {string} id @returns {Promise<any>} */
    getById: (id)          => invoke('schedules_get_by_id', { id }),
    /** @param {any} data @returns {Promise<any>} */
    create:  (data)        => invoke('schedules_create',   { data }),
    /** @param {string} id @returns {Promise<any>} */
    toggle:  (id)          => invoke('schedules_toggle',   { id }),
    /** @param {string} id @param {any} changes @returns {Promise<any>} */
    update:  (id, changes) => invoke('schedules_update',   { id, changes }),
    /** @param {string} id @returns {Promise<any>} */
    delete:  (id)          => invoke('schedules_delete',   { id }),
  },

  // ── API (REST server removed in v1.1.0 — stub to avoid errors) ───────────────
  api: {
    /** @returns {Promise<void>} */
    sync: () => Promise.resolve(),
  },

  // ── Notifications ─────────────────────────────────────────────────────────────
  notify: {
    /** @param {string} title @param {string} body @returns {Promise<void>} */
    send:    (title, body) => invoke('notify_send', { title, body }),
    /** @param {(payload: any) => void} cb @returns {() => void} */
    onToast: (cb)          => sub('notify:toast', cb),

    // Real OS-level desktop notifications (Windows Action Center / macOS
    // Notification Center / Linux notify-daemon), separate from the in-app
    // toast above. Infrastructure only for now — nothing calls sendDesktop()
    // automatically yet; a future feature (e.g. schedule/deadline reminders)
    // wires it up.
    /** @returns {Promise<boolean>} */
    isDesktopPermissionGranted: () => invoke('notify_desktop_permission_granted'),
    /** @returns {Promise<boolean>} */
    requestDesktopPermission:   () => invoke('notify_request_desktop_permission'),
    /** @param {string} title @param {string} body @returns {Promise<void>} */
    sendDesktop:                (title, body) => invoke('notify_send_desktop', { title, body }),
  },

  // ── Updates ──────────────────────────────────────────────────────────────────
  // Signature-verified via tauri-plugin-updater (see src-tauri/src/updates.rs).
  // install() always installs whatever check() most recently found — there is
  // no way to point it at an arbitrary URL from the frontend.
  updates: {
    /** @returns {Promise<any>} */
    check:   ()  => invoke('updates_check'),
    /** @returns {Promise<void>} */
    install: ()  => invoke('updates_install'),
  },

  // ── App lifecycle ─────────────────────────────────────────────────────────────
  app: {
    /** @returns {Promise<void>} */
    exit:    () => invoke('app_exit'),
    /** @returns {Promise<void>} */
    restart: () => invoke('app_restart'),

    // Launch-on-startup — backed by the OS (registry run key / LaunchAgent /
    // autostart .desktop entry), not a settings.json flag, so isEnabled() is
    // always the source of truth.
    autostart: {
      isEnabled: () => isAutostartEnabled(),
      enable:    () => enableAutostart(),
      disable:   () => disableAutostart(),
    },
  },

  github: {
    /** @returns {Promise<boolean>} */
    oauthConfigured: ()           => invoke('github_oauth_configured'),
    /** @returns {Promise<any>} */
    oauthStart:      ()           => invoke('github_oauth_start'),
    /** @param {string} deviceCode @returns {Promise<any>} */
    oauthPoll:       (deviceCode) => invoke('github_oauth_poll', { deviceCode }),

    // Repo metadata & releases — GitHub page (Overview, Releases tabs)
    /** @param {string} id @returns {Promise<any>} */
    getRepoInfo:   (id) => invoke('github_get_repo_info', { id }),
    /** @param {string} id @returns {Promise<any[]>} */
    listReleases:  (id) => invoke('github_list_releases',  { id }),
    /**
     * @param {string} id
     * @param {{ tagName: string, target?: string, name?: string, body?: string, draft?: boolean, prerelease?: boolean }} opts
     * @returns {Promise<any>}
     */
    createRelease: (id, { tagName, target, name, body, draft, prerelease }) =>
      invoke('github_create_release', { id, tagName, target, name, body, draft, prerelease }),

    // Issues & PRs — GitHub page (Issues & PRs tab)
    /** @param {string} id @param {string} [state] 'open'|'closed'|'all' @returns {Promise<any[]>} */
    listIssues:       (id, state) => invoke('github_list_issues',        { id, state }),
    /** @param {string} id @param {string} [state] 'open'|'closed'|'all' @returns {Promise<any[]>} */
    listPullRequests: (id, state) => invoke('github_list_pull_requests', { id, state }),
    /** @param {string} id @param {string} title @param {string} body @returns {Promise<any>} */
    createIssue:      (id, title, body) => invoke('github_create_issue', { id, title, body }),
  },

  // ── Storage ──────────────────────────────────────────────────────────────────
  storage: {
    /** @returns {Promise<any>} */
    migrateToSqlite:   ()        => invoke('migrate_to_sqlite'),
    /** @param {string} backend @returns {Promise<any>} */
    switchBackend:     (backend) => invoke('switch_storage_backend', { backend }),
  },

  // ── Data backup / restore ────────────────────────────────────────────────────
  data: {
    /** @param {string} destPath @returns {Promise<any>} */
    exportAll: (destPath) => invoke('data_export_all', { destPath }),
    /** @param {string} srcPath @returns {Promise<any>} */
    importAll: (srcPath)  => invoke('data_import_all', { srcPath }),
    // Scheduled/manual automatic backup — writes to a rotating set of
    // files in the app data dir (settings.app.autoBackup), distinct from
    // exportAll's user-chosen destination.
    /** @returns {Promise<any>} */
    backupNow: () => invoke('backup_run_now'),
  },

  // ── Entitlements ─────────────────────────────────────────────────────────────
  // Server-verified only — see src-tauri/src/entitlements.rs. No client-side
  // key/flag can grant a capability; both calls degrade to an empty
  // capability list (free tier) rather than throwing, since "no premium"
  // must never look like an error to the rest of the app.
  entitlements: {
    /** @returns {Promise<any>} hits the network; call on launch + periodically */
    refresh: () => invoke('entitlements_refresh'),
    /** @returns {Promise<any>} local-only cache read, safe on every render */
    get:     () => invoke('entitlements_get'),
  },

  // ── Ping (legacy stub) ───────────────────────────────────────────────────────
  /** @returns {Promise<string>} */
  ping: () => Promise.resolve('pong'),
}
