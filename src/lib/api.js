/**
 * Window.api compatibility shim for Tauri v2.
 * Mirrors the Electron preload interface so all React components
 * can call window.api.* without any changes.
 *
 * Dialog + opener operations are handled by Tauri frontend plugins.
 * Everything else is routed through invoke() to Rust commands.
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
function sub(event, cb) {
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
    get:         ()         => invoke('settings_get'),
    set:         (key, val) => invoke('settings_set',    { key, value: val }),
    update:      (changes)  => invoke('settings_update', { changes }),
    reset:       ()         => invoke('settings_reset'),
    testGithub:  (token)    => invoke('settings_test_github',  { token }),
    saveAvatar:  (filePath) => invoke('settings_save_avatar',  { filePath }),
  },

  // ── Projects ─────────────────────────────────────────────────────────────────
  projects: {
    getAll:    ()    => invoke('projects_get_all'),
    getById:   (id)  => invoke('projects_get_by_id',  { id }),

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

    import:               (path, opts)    => invoke('projects_import',               { folderPath: path, opts }),
    edit:                 (id, changes)   => invoke('projects_edit',                 { id, changes }),
    delete:               (id)            => invoke('projects_delete',               { id }),
    openInIDE:            (id)            => invoke('projects_open_in_ide',          { id }),
    openFolder:           (id)            => invoke('projects_open_folder',          { id }),
    toggleFavorite:       (id)            => invoke('projects_toggle_favorite',      { id }),
    getRecents:           (limit)         => invoke('projects_get_recents',          { limit }),
    detectLanguages:      (id)            => invoke('projects_detect_languages',     { id }),
    autoDetectCommands:   (root)          => invoke('projects_auto_detect_commands', { root }),
    removeLocalFiles:     (id)            => invoke('projects_remove_local_files',   { id }),
    deleteGithubRepo:     (id)            => invoke('projects_delete_github_repo',   { id }),
    getDependencies:      (id)            => invoke('projects_get_dependencies',     { id }),
    installDependencies:  (id)            => invoke('projects_install_dependencies', { id }),
    updateDependencies:   (id)            => invoke('projects_update_dependencies',  { id }),
    addDependency:        (id, name, dev) => invoke('projects_add_dependency',       { id, name, dev: dev ?? false }),
    removeDependency:     (id, name)      => invoke('projects_remove_dependency',    { id, name }),
    getFileTree:          (id)            => invoke('projects_get_file_tree',        { id }),
    getScripts:           (id)            => invoke('projects_get_scripts',          { id }),
    rename:               (id, newName)   => invoke('projects_rename',               { id, newName }),
    setArchived:          (id, archived)  => invoke('projects_set_archived',         { id, archived }),
    publishToGithub:      (id, repoName, description, priv) => invoke('projects_publish_to_github', { id, repoName, description, private: priv }),
  },

  // ── Templates ────────────────────────────────────────────────────────────────
  templates: {
    list: () => invoke('templates_list'),
  },

  // ── Activity ─────────────────────────────────────────────────────────────────
  activity: {
    getAll: (limit) => invoke('activity_get_all', { limit }),
    clear:  ()      => invoke('activity_clear'),
  },

  // ── Run ──────────────────────────────────────────────────────────────────────
  run: {
    start:      (projectId, commandType, env) => invoke('run_start', { projectId, commandType, env: env || {} }),
    stop:       (projectId)                   => invoke('run_stop',       { projectId }),
    getRunning: ()                            => invoke('run_get_running'),
    isRunning:  (projectId)                   => invoke('run_is_running', { projectId }),

    onOutput:   (cb) => sub('run:output',   cb),
    onStarted:  (cb) => sub('run:started',  cb),
    onFinished: (cb) => sub('run:finished', cb),
  },

  // ── Git ──────────────────────────────────────────────────────────────────────
  git: {
    getAllRecentCommits: (limit)  => invoke('git_get_all_recent_commits', { limit }),
    syncAllLastCommitDates: ()    => invoke('git_sync_all_last_commit_dates'),
    status:         (id)         => invoke('git_status',           { id }),
    commit:         (id, msg)    => invoke('git_commit',           { id, msg }),
    getLog:         (id, limit)  => invoke('git_get_log',          { id, limit }),
    isRepo:         (root)       => invoke('git_is_repo',          { root }),
    getBranches:    (id)         => invoke('git_get_branches',     { id }),
    switchBranch:   (id, branch) => invoke('git_switch_branch',    { id, branch }),
    createBranch:   (id, branch) => invoke('git_create_branch',    { id, branch }),
    push:           (id)         => invoke('git_push',             { id }),
    getReadme:      (id)         => invoke('git_get_readme',       { id }),
    pull:           (id)         => invoke('git_pull',             { id }),
    getAheadBehind: (id)         => invoke('git_get_ahead_behind', { id }),
    initRepo:       (id)         => invoke('git_init_repo',        { id }),
    addToGitignore: (id, entry)  => invoke('git_add_to_gitignore', { id, entry }),
    stageFiles:     (id, paths)  => invoke('git_stage_files',      { id, paths }),
    unstageFiles:   (id, paths)  => invoke('git_unstage_files',    { id, paths }),
    diffFile:       (id, path, kind) => invoke('git_diff_file',    { id, path, kind }),

    // Tags & version-diffing — GitHub page (Releases, Changelog, Insights tabs)
    listTags:          (id)               => invoke('git_list_tags',           { id }),
    createTag:         (id, tagName, message) => invoke('git_create_tag',      { id, tagName, message }),
    getCommitsBetween: (id, fromRef, toRef)   => invoke('git_get_commits_between', { id, fromRef, toRef }),
    diffBetweenRefs:   (id, fromRef, toRef)   => invoke('git_diff_between_refs',   { id, fromRef, toRef }),
    getCommitDates:    (id, limit)         => invoke('git_get_commit_dates',    { id, limit }),
  },

  // ── System ───────────────────────────────────────────────────────────────────
  system: {
    openPath:     (p)   => invoke('system_open_path',     { p }),
    openExternal: (url) => invoke('system_open_external', { url }),
    openInAppBrowser: (label, url, title) => invoke('system_open_in_app_browser', { label, url, title }),

    showFolderPicker: async (defaultPath) => {
      const result = await open({ directory: true, defaultPath: defaultPath || undefined })
      return result ?? null
    },
    showFilePicker: async (defaultPath, filters) => {
      const result = await open({ multiple: false, defaultPath: defaultPath || undefined, filters: filters || [] })
      return result ?? null
    },
    showSavePicker: async (defaultPath, filters) => {
      const result = await save({ defaultPath: defaultPath || undefined, filters: filters || [] })
      return result ?? null
    },

    writeBytes:             (path, data) => invoke('system_write_bytes',            { path, data }),
    pathExists:             (p)        => invoke('system_path_exists',              { p }),
    homedir:                ()         => invoke('system_homedir'),
    platform:               ()         => invoke('system_platform'),
    userData:               ()         => invoke('system_user_data'),
    lookupCommunityUser:    (username) => invoke('system_lookup_community_user',    { githubUsername: username }),
    validateGithubUsername: (username) => invoke('system_validate_github_username', { username }),
  },

  // ── Notes ────────────────────────────────────────────────────────────────────
  notes: {
    getAll:  (projectId)   => invoke('notes_get_all',  { projectId }),
    getById: (id)          => invoke('notes_get_by_id', { id }),
    create:  (data)        => invoke('notes_create',   { data }),
    update:  (id, changes) => invoke('notes_update',   { id, changes }),
    delete:  (id)          => invoke('notes_delete',   { id }),
  },

  // ── Obsidian vault sync ─────────────────────────────────────────────────────
  obsidian: {
    syncAll:       ()     => invoke('obsidian_sync_all'),
    testVaultPath: (path) => invoke('obsidian_test_vault_path', { path }),
  },

  // ── Personality / work-habits tracking ───────────────────────────────────────
  personality: {
    getProfile:          () => invoke('personality_get_profile'),
    backfillFromActivity: () => invoke('personality_backfill_from_activity'),
    scanCommits:          () => invoke('personality_scan_commits'),
    trackAppOpen:         () => invoke('personality_track_app_open'),
  },

  // ── Todos ─────────────────────────────────────────────────────────────────────
  todos: {
    getAll:  (projectId)   => invoke('todos_get_all',  { projectId }),
    create:  (data)        => invoke('todos_create',   { data }),
    toggle:  (id)          => invoke('todos_toggle',   { id }),
    update:  (id, changes) => invoke('todos_update',   { id, changes }),
    delete:  (id)          => invoke('todos_delete',   { id }),
  },

  // ── Schedules & deadlines (distinct from todos — dated, with a
  // description and attachable notes) ─────────────────────────────────────────
  schedules: {
    getAll:  (projectId)   => invoke('schedules_get_all',  { projectId }),
    getById: (id)          => invoke('schedules_get_by_id', { id }),
    create:  (data)        => invoke('schedules_create',   { data }),
    toggle:  (id)          => invoke('schedules_toggle',   { id }),
    update:  (id, changes) => invoke('schedules_update',   { id, changes }),
    delete:  (id)          => invoke('schedules_delete',   { id }),
  },

  // ── API (REST server removed in v1.1.0 — stub to avoid errors) ───────────────
  api: {
    sync: () => Promise.resolve(),
  },

  // ── Notifications ─────────────────────────────────────────────────────────────
  notify: {
    send:    (title, body) => invoke('notify_send', { title, body }),
    onToast: (cb)          => sub('notify:toast', cb),

    // Real OS-level desktop notifications (Windows Action Center / macOS
    // Notification Center / Linux notify-daemon), separate from the in-app
    // toast above. Infrastructure only for now — nothing calls sendDesktop()
    // automatically yet; a future feature (e.g. schedule/deadline reminders)
    // wires it up.
    isDesktopPermissionGranted: () => invoke('notify_desktop_permission_granted'),
    requestDesktopPermission:   () => invoke('notify_request_desktop_permission'),
    sendDesktop:                (title, body) => invoke('notify_send_desktop', { title, body }),
  },

  // ── Updates ──────────────────────────────────────────────────────────────────
  updates: {
    check:               ()    => invoke('check_for_updates'),
    downloadAndInstall:  (url) => invoke('download_and_install_update', { url }),
  },

  // ── App lifecycle ─────────────────────────────────────────────────────────────
  app: {
    exit:    () => invoke('app_exit'),
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
    oauthConfigured: ()           => invoke('github_oauth_configured'),
    oauthStart:      ()           => invoke('github_oauth_start'),
    oauthPoll:       (deviceCode) => invoke('github_oauth_poll', { deviceCode }),

    // Repo metadata & releases — GitHub page (Overview, Releases tabs)
    getRepoInfo:   (id) => invoke('github_get_repo_info', { id }),
    listReleases:  (id) => invoke('github_list_releases',  { id }),
    createRelease: (id, { tagName, target, name, body, draft, prerelease }) =>
      invoke('github_create_release', { id, tagName, target, name, body, draft, prerelease }),
  },

  // ── Storage ──────────────────────────────────────────────────────────────────
  storage: {
    migrateToSqlite:   ()        => invoke('migrate_to_sqlite'),
    switchBackend:     (backend) => invoke('switch_storage_backend', { backend }),
  },

  // ── Data backup / restore ────────────────────────────────────────────────────
  data: {
    exportAll: (destPath) => invoke('data_export_all', { destPath }),
    importAll: (srcPath)  => invoke('data_import_all', { srcPath }),
  },

  // ── Premium ───────────────────────────────────────────────────────────────────
  premium: {
    validateKey: (key) => invoke('premium_validate_key', { key }),
  },

  // ── Ping (legacy stub) ───────────────────────────────────────────────────────
  ping: () => Promise.resolve('pong'),
}
