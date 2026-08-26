import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import os from 'os'

// Mirror Tauri v2's app_data_dir for the identifier "xyz.skuller.croco".
// Windows: %APPDATA%\xyz.skuller.croco
// macOS:   ~/Library/Application Support/xyz.skuller.croco
// Linux:   $XDG_DATA_HOME/xyz.skuller.croco (defaults to ~/.local/share)
function resolveAppDataDir() {
  const id = 'xyz.skuller.croco'
  switch (process.platform) {
    case 'win32':
      return join(process.env.APPDATA || os.homedir(), id)
    case 'darwin':
      return join(os.homedir(), 'Library', 'Application Support', id)
    default:
      return join(process.env.XDG_DATA_HOME || join(os.homedir(), '.local', 'share'), id)
  }
}

const APP_DATA_DIR = resolveAppDataDir()

export function readSettings() {
  try {
    const p = join(APP_DATA_DIR, 'settings.json')
    if (!existsSync(p)) return {}
    return JSON.parse(readFileSync(p, 'utf-8'))
  } catch { return {} }
}

// Projects live under the app data dir, unless the user set a custom
// data path in Settings → App (settings.app.dataPath).
function resolveDataDir() {
  const custom = readSettings()?.app?.dataPath
  return custom && String(custom).trim() ? custom : APP_DATA_DIR
}

export const DATA_DIR = resolveDataDir()

export function readProjects() {
  // Same per-file layout the desktop app uses: project-details/<id>.json
  const dir = join(DATA_DIR, 'project-details')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try { return JSON.parse(readFileSync(join(dir, f), 'utf-8')) }
      catch { return null }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.meta?.lastOpenedAt || 0) - new Date(a.meta?.lastOpenedAt || 0))
}

export function findProject(query) {
  const projects = readProjects()
  const q = query.toLowerCase()
  return (
    projects.find(p => p.id === query) ||
    projects.find(p => p.slug === q) ||
    projects.find(p => p.name.toLowerCase() === q) ||
    projects.find(p => p.name.toLowerCase().includes(q)) ||
    null
  )
}

// ── Shared directory/backend helpers for the full `croco` CLI ──────────────
// (cli/croco.js). These mirror src-tauri/src/main.rs's path helpers exactly
// — same directory names, same per-file JSON layout — so the CLI and the
// desktop app read/write the identical files.
//
// IMPORTANT limitation: this CLI only understands the JSON storage backend.
// If the user has switched to Settings → Storage → SQLite, none of these
// read/write functions will see or touch croco.db — see CLI_USE_TUTO.md.
export function storageBackend() {
  return readSettings()?.app?.storageBackend === 'sqlite' ? 'sqlite' : 'json'
}

export const PROJECT_DETAILS_DIR = join(DATA_DIR, 'project-details')
export const NOTES_DIR           = join(DATA_DIR, 'notes')
export const TODOS_DIR           = join(DATA_DIR, 'todos')
export const SCHEDULES_DIR       = join(DATA_DIR, 'schedules')
export const SETTINGS_PATH       = join(DATA_DIR, 'settings.json')

function readJsonDir(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try { return JSON.parse(readFileSync(join(dir, f), 'utf-8')) }
      catch { return null }
    })
    .filter(Boolean)
}

export function readNotes()     { return readJsonDir(NOTES_DIR) }
export function readTodos()     { return readJsonDir(TODOS_DIR) }
export function readSchedules() { return readJsonDir(SCHEDULES_DIR) }

export function nowIso() { return new Date().toISOString() }
