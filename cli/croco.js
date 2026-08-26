#!/usr/bin/env node
// The `croco` CLI — full read/write access to the same data Croco's desktop
// app manages (projects, notes, todos, schedules, settings), for scripting
// and terminal-first workflows. See /docs/CLI_USE_TUTO.md for the full
// reference and integration notes.
//
// Scope note (2026): this is the CLI *endpoint* — the command surface below
// covers full CRUD on the JSON storage backend, mirroring exactly what the
// desktop app's Rust commands do to the same files. It intentionally does
// NOT yet cover git/GitHub operations, run/stop process management, or the
// SQLite storage backend — those are follow-up work once this baseline is
// in use. See CLI_USE_TUTO.md's "Extending the CLI" section for how to add
// them following the same pattern.
import { program } from 'commander'
import { execSync, spawn } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import os from 'os'
import {
  DATA_DIR, PROJECT_DETAILS_DIR, NOTES_DIR, TODOS_DIR, SCHEDULES_DIR,
  readProjects, readNotes, readTodos, readSchedules, readSettings,
  findProject, storageBackend, nowIso,
} from './data.js'

// ── ANSI helpers (same palette as cli/index.js) ─────────────────────────────
const b  = s => `\x1b[1m${s}\x1b[0m`
const d  = s => `\x1b[2m${s}\x1b[0m`
const g  = s => `\x1b[32m${s}\x1b[0m`
const y  = s => `\x1b[33m${s}\x1b[0m`
const r  = s => `\x1b[31m${s}\x1b[0m`

function die(msg) { console.error(r(`✗ ${msg}`)); process.exit(1) }
function ok(msg)  { console.log(`${g('✓')} ${msg}`) }

function warnIfSqlite() {
  if (storageBackend() === 'sqlite') {
    console.error(y('⚠ Storage backend is set to SQLite — this CLI only reads/writes the JSON backend and will not see croco.db. See CLI_USE_TUTO.md.'))
  }
}

// Write commands (create/edit/delete/toggle) refuse to run against a
// SQLite-backed install instead of silently writing JSON files the app
// will never read — see CLI_USE_TUTO.md's "SQLite backend is NOT
// supported yet" section. Read-only commands (list/show, the bare
// dashboard summary) still work via warnIfSqlite()'s softer warning above,
// since they read real data either way once SQLite support lands, but
// writes would today create data that silently vanishes from the app.
function dieIfSqlite() {
  if (storageBackend() === 'sqlite') {
    die('Storage backend is set to SQLite — this CLI cannot write to croco.db yet. Switch to the JSON backend in Settings → Storage, or see CLI_USE_TUTO.md.')
  }
}

function ensureDir(dir) { mkdirSync(dir, { recursive: true }) }

function writeJson(path, obj) { writeFileSync(path, JSON.stringify(obj, null, 2)) }

function readJsonOr(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf-8')) } catch { return fallback }
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'item'
}

// Generic "apply --field value" flag parser used by edit commands below —
// turns commander opts into a JSON-patch object, skipping unset flags.
function optsToChanges(opts, mapping) {
  const changes = {}
  for (const [flag, field] of Object.entries(mapping)) {
    if (opts[flag] !== undefined) changes[field] = opts[flag]
  }
  return changes
}

// ── croco (no args) — quick view of everything, like opening the dashboard ──

program
  .name('croco')
  .description('Croco CLI — view and manage all your projects, notes, todos, and schedules from the terminal.')
  .version('1.0.0')
  .action(() => {
    warnIfSqlite()
    const projects  = readProjects()
    const todos     = readTodos()
    const schedules = readSchedules()
    const openTodos = todos.filter(t => !t.completed)
    const upcoming  = schedules
      .filter(s => !s.completed && s.dueDate)
      .sort((a, b2) => `${a.dueDate}T${a.dueTime || '00:00'}`.localeCompare(`${b2.dueDate}T${b2.dueTime || '00:00'}`))
      .slice(0, 5)

    console.log()
    console.log(`  ${b('Croco')} ${d(`— ${DATA_DIR}`)}`)
    console.log(`  ${d(`storage backend: ${storageBackend()}`)}`)
    console.log()
    console.log(`  ${b(String(projects.length))} projects   ${b(String(openTodos.length))} open todos   ${b(String(schedules.filter(s => !s.completed).length))} open schedules`)
    if (upcoming.length) {
      console.log()
      console.log(`  ${d('Upcoming schedules:')}`)
      for (const s of upcoming) console.log(`    ${y('🕐')} ${s.title} ${d(`— ${s.dueDate}${s.dueTime ? ' ' + s.dueTime : ''}`)}`)
    }
    console.log()
    console.log(d('  Run `croco --help` to see all commands (project, note, todo, schedule, settings).'))
    console.log()
  })

// ── croco project ────────────────────────────────────────────────────────────
const project = program.command('project').description('Manage projects')

project.command('list').alias('ls').description('List all projects').action(() => {
  warnIfSqlite()
  const projects = readProjects()
  if (!projects.length) return console.log(d('  No projects found. Run `croco project new <name>`.'))
  console.log()
  for (const p of projects) {
    console.log(`  ${p.favourite ? y('★') : ' '} ${p.emoji || '📁'} ${b(p.name)} ${d(`(${p.id})`)}`)
    console.log(`      ${d(p.paths?.projectRoot || '—')}`)
  }
  console.log()
})

project.command('show <id>').description('Show full details for one project').action((id) => {
  const p = findProject(id)
  if (!p) die(`Project not found: "${id}"`)
  console.log(JSON.stringify(p, null, 2))
})

project.command('new <name>')
  .description('Create a new project')
  .option('--ide <ide>', 'IDE (vscode, cursor, webstorm…)')
  .option('--desc <text>', 'Short description')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--path <path>', 'Override project root path')
  .option('--emoji <emoji>', 'Project emoji')
  .action((name, opts) => {
    dieIfSqlite()
    const settings = readSettings()
    const existing = new Set(readProjects().map(p => p.slug))
    let slug = slugify(name), i = 2
    while (existing.has(slug)) slug = `${slugify(name)}-${i++}`
    const root = opts.path || join(settings.paths?.publicProjects || join(os.homedir(), 'projects'), slug)
    const now = nowIso()
    const proj = {
      id: randomUUID(), name, slug,
      description: opts.desc || '',
      emoji: opts.emoji || '📁',
      tags: opts.tags ? opts.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      visibility: 'public',
      ide: opts.ide || settings.defaults?.ide || 'vscode',
      github: null,
      paths: { projectRoot: root, entryFile: '' },
      commands: { dev: '', build: '', start: '', test: '', custom: [] },
      favourite: false,
      meta: { createdAt: now, lastOpenedAt: now, lastCommitAt: null },
    }
    ensureDir(PROJECT_DETAILS_DIR)
    writeJson(join(PROJECT_DETAILS_DIR, `${proj.id}.json`), proj)
    if (!existsSync(root)) ensureDir(root)
    ok(`Created ${proj.emoji} ${b(name)} ${d(`(${proj.id})`)}`)
  })

project.command('edit <id>')
  .description('Edit a project')
  .option('--name <name>')
  .option('--desc <text>')
  .option('--emoji <emoji>')
  .option('--ide <ide>')
  .action((id, opts) => {
    dieIfSqlite()
    const p = findProject(id)
    if (!p) die(`Project not found: "${id}"`)
    const changes = optsToChanges(opts, { name: 'name', desc: 'description', emoji: 'emoji', ide: 'ide' })
    if (Object.keys(changes).length === 0) die('Nothing to change — pass at least one of --name/--desc/--emoji/--ide')
    const updated = { ...p, ...changes }
    writeJson(join(PROJECT_DETAILS_DIR, `${p.id}.json`), updated)
    ok(`Updated ${b(updated.name)}`)
  })

project.command('delete <id>')
  .description('Delete a project (metadata only — does not touch files on disk)')
  .action((id) => {
    dieIfSqlite()
    const p = findProject(id)
    if (!p) die(`Project not found: "${id}"`)
    unlinkSync(join(PROJECT_DETAILS_DIR, `${p.id}.json`))
    ok(`Deleted ${b(p.name)} ${d('(project files on disk were left untouched)')}`)
  })

project.command('open <id>')
  .description('Open a project in its configured IDE')
  .action((id) => {
    const p = findProject(id)
    if (!p) die(`Project not found: "${id}"`)
    const IDE_CMD = {
      vscode: pp => `code "${pp}"`, cursor: pp => `cursor "${pp}"`, webstorm: pp => `webstorm "${pp}"`,
      idea: pp => `idea "${pp}"`, zed: pp => `zed "${pp}"`, sublime: pp => `subl "${pp}"`,
      vim: pp => `vim "${pp}"`, neovim: pp => `nvim "${pp}"`, atom: pp => `atom "${pp}"`,
    }
    const cmd = (IDE_CMD[p.ide] || IDE_CMD.vscode)(p.paths.projectRoot)
    try { execSync(cmd, { stdio: 'ignore' }) } catch { /* IDE launchers commonly exit non-zero */ }
    ok(`Opened ${b(p.name)} in ${p.ide || 'vscode'}`)
  })

project.command('run <id> [type]')
  .description('Run a project command: dev (default), build, start, test, or a raw string')
  .action((id, type = 'dev') => {
    const p = findProject(id)
    if (!p) die(`Project not found: "${id}"`)
    const cmds = p.commands || {}
    const cmd = ['dev', 'build', 'start', 'test'].includes(type) ? cmds[type] : type
    if (!cmd) die(`No "${type}" command configured for ${p.name}`)
    const root = p.paths?.projectRoot
    if (!existsSync(root)) die(`Project root does not exist: ${root}`)
    console.log(`${d('▶')} ${b(p.name)} ${d(`— ${cmd}`)}`)
    const child = spawn(cmd, { cwd: root, shell: true, stdio: 'inherit' })
    child.on('exit', code => process.exit(code ?? 0))
  })

// ── croco note ────────────────────────────────────────────────────────────────
const note = program.command('note').description('Manage notes')

note.command('list').alias('ls').description('List all notes').option('--project <id>', 'Filter by project id').action((opts) => {
  const notes = readNotes().filter(n => !opts.project || n.projectId === opts.project)
  if (!notes.length) return console.log(d('  No notes found.'))
  console.log()
  for (const n of notes) console.log(`  ${n.emoji || '📝'} ${b(n.title)} ${d(`(${n.id})`)}`)
  console.log()
})

note.command('show <id>').description('Show a note, including its content').action((id) => {
  const meta = readNotes().find(n => n.id === id)
  if (!meta) die(`Note not found: "${id}"`)
  const content = readJsonOr(join(NOTES_DIR, `${id}.md`), null) ?? (existsSync(join(NOTES_DIR, `${id}.md`)) ? readFileSync(join(NOTES_DIR, `${id}.md`), 'utf-8') : '')
  console.log(JSON.stringify({ ...meta, content }, null, 2))
})

note.command('new <title>')
  .description('Create a note')
  .option('--content <text>', 'Note body (Markdown)')
  .option('--project <id>', 'Attach to a project')
  .action((title, opts) => {
    dieIfSqlite()
    const now = nowIso()
    const id = randomUUID()
    const meta = {
      id, title, emoji: '📝', starred: false, archived: false,
      projectId: opts.project || null, tags: [], createdAt: now, updatedAt: now,
    }
    ensureDir(NOTES_DIR)
    writeJson(join(NOTES_DIR, `${id}.json`), meta)
    writeFileSync(join(NOTES_DIR, `${id}.md`), opts.content || '')
    ok(`Created note ${b(title)} ${d(`(${id})`)}`)
  })

note.command('edit <id>')
  .description('Edit a note')
  .option('--title <title>')
  .option('--content <text>')
  .action((id, opts) => {
    dieIfSqlite()
    const path = join(NOTES_DIR, `${id}.json`)
    if (!existsSync(path)) die(`Note not found: "${id}"`)
    const meta = readJsonOr(path, null)
    if (opts.title) meta.title = opts.title
    meta.updatedAt = nowIso()
    writeJson(path, meta)
    if (opts.content !== undefined) writeFileSync(join(NOTES_DIR, `${id}.md`), opts.content)
    ok(`Updated note ${b(meta.title)}`)
  })

note.command('delete <id>').description('Delete a note').action((id) => {
  dieIfSqlite()
  const jsonPath = join(NOTES_DIR, `${id}.json`)
  const mdPath = join(NOTES_DIR, `${id}.md`)
  if (!existsSync(jsonPath)) die(`Note not found: "${id}"`)
  unlinkSync(jsonPath)
  if (existsSync(mdPath)) unlinkSync(mdPath)
  ok('Deleted note')
})

// ── croco todo ────────────────────────────────────────────────────────────────
const todo = program.command('todo').description('Manage todos')

todo.command('list').alias('ls').description('List todos').option('--project <id>', 'Filter by project id').action((opts) => {
  const todos = readTodos().filter(t => !opts.project || t.projectId === opts.project)
  if (!todos.length) return console.log(d('  No todos found.'))
  console.log()
  for (const t of todos) console.log(`  ${t.completed ? g('✓') : ' '} ${t.completed ? d(t.title) : t.title} ${d(`[${t.priority}] (${t.id})`)}`)
  console.log()
})

todo.command('new <title>')
  .description('Create a todo')
  .option('--priority <p>', 'Priority id (default: med)')
  .option('--project <id>', 'Attach to a project')
  .option('--due <date>', 'Due date, ISO (YYYY-MM-DD)')
  .action((title, opts) => {
    dieIfSqlite()
    const id = randomUUID()
    const t = {
      id, title, emoji: null, completed: false,
      priority: opts.priority || 'med', projectId: opts.project || null,
      noteId: null, dueDate: opts.due || null, createdAt: nowIso(),
    }
    ensureDir(TODOS_DIR)
    writeJson(join(TODOS_DIR, `${id}.json`), t)
    ok(`Created todo ${b(title)} ${d(`(${id})`)}`)
  })

todo.command('toggle <id>').description('Toggle a todo complete/incomplete').action((id) => {
  dieIfSqlite()
  const path = join(TODOS_DIR, `${id}.json`)
  if (!existsSync(path)) die(`Todo not found: "${id}"`)
  const t = readJsonOr(path, null)
  t.completed = !t.completed
  t.completedAt = t.completed ? nowIso() : null
  writeJson(path, t)
  ok(`${t.completed ? 'Completed' : 'Un-completed'} ${b(t.title)}`)
})

todo.command('edit <id>')
  .description('Edit a todo')
  .option('--title <title>')
  .option('--priority <p>')
  .option('--due <date>')
  .action((id, opts) => {
    dieIfSqlite()
    const path = join(TODOS_DIR, `${id}.json`)
    if (!existsSync(path)) die(`Todo not found: "${id}"`)
    const t = readJsonOr(path, null)
    Object.assign(t, optsToChanges(opts, { title: 'title', priority: 'priority', due: 'dueDate' }))
    writeJson(path, t)
    ok(`Updated ${b(t.title)}`)
  })

todo.command('delete <id>').description('Delete a todo').action((id) => {
  dieIfSqlite()
  const path = join(TODOS_DIR, `${id}.json`)
  if (!existsSync(path)) die(`Todo not found: "${id}"`)
  unlinkSync(path)
  ok('Deleted todo')
})

// ── croco schedule ────────────────────────────────────────────────────────────
const schedule = program.command('schedule').description('Manage schedules & deadlines (distinct from todos)')

schedule.command('list').alias('ls').description('List schedules').option('--project <id>', 'Filter by project id').action((opts) => {
  const schedules = readSchedules().filter(s => !opts.project || s.projectId === opts.project)
  if (!schedules.length) return console.log(d('  No schedules found.'))
  console.log()
  for (const s of schedules) {
    const due = s.dueDate ? `${s.dueDate}${s.dueTime ? ' ' + s.dueTime : ''}` : 'no due date'
    console.log(`  ${s.completed ? g('✓') : y('🕐')} ${b(s.title)} ${d(`[${s.priority}] — ${due} (${s.id})`)}`)
  }
  console.log()
})

schedule.command('show <id>').description('Show a schedule').action((id) => {
  const s = readSchedules().find(x => x.id === id)
  if (!s) die(`Schedule not found: "${id}"`)
  console.log(JSON.stringify(s, null, 2))
})

schedule.command('new <title>')
  .description('Create a schedule (dated commitment — distinct from a todo)')
  .option('--description <text>', 'Longer description')
  .option('--priority <p>', 'Priority id (default: med)')
  .option('--project <id>', 'Attach to a project')
  .option('--due-date <date>', 'Expiry date, ISO (YYYY-MM-DD)')
  .option('--due-time <time>', 'Expiry time, 24h (HH:MM)')
  .option('--notes <ids>', 'Comma-separated note ids to attach')
  .action((title, opts) => {
    dieIfSqlite()
    const id = randomUUID()
    const now = nowIso()
    const s = {
      id, title, description: opts.description || '',
      priority: opts.priority || 'med', projectId: opts.project || null,
      noteIds: opts.notes ? opts.notes.split(',').map(x => x.trim()).filter(Boolean) : [],
      dueDate: opts.dueDate || null, dueTime: opts.dueTime || null,
      completed: false, completedAt: null, createdAt: now, updatedAt: now,
    }
    ensureDir(SCHEDULES_DIR)
    writeJson(join(SCHEDULES_DIR, `${id}.json`), s)
    ok(`Created schedule ${b(title)} ${d(`(${id})`)}`)
  })

schedule.command('toggle <id>').description('Toggle a schedule complete/incomplete').action((id) => {
  dieIfSqlite()
  const path = join(SCHEDULES_DIR, `${id}.json`)
  if (!existsSync(path)) die(`Schedule not found: "${id}"`)
  const s = readJsonOr(path, null)
  s.completed = !s.completed
  s.completedAt = s.completed ? nowIso() : null
  s.updatedAt = nowIso()
  writeJson(path, s)
  ok(`${s.completed ? 'Completed' : 'Un-completed'} ${b(s.title)}`)
})

schedule.command('edit <id>')
  .description('Edit a schedule')
  .option('--title <title>')
  .option('--description <text>')
  .option('--priority <p>')
  .option('--due-date <date>')
  .option('--due-time <time>')
  .action((id, opts) => {
    dieIfSqlite()
    const path = join(SCHEDULES_DIR, `${id}.json`)
    if (!existsSync(path)) die(`Schedule not found: "${id}"`)
    const s = readJsonOr(path, null)
    Object.assign(s, optsToChanges(opts, {
      title: 'title', description: 'description', priority: 'priority',
      dueDate: 'dueDate', dueTime: 'dueTime',
    }))
    s.updatedAt = nowIso()
    writeJson(path, s)
    ok(`Updated ${b(s.title)}`)
  })

schedule.command('delete <id>').description('Delete a schedule').action((id) => {
  dieIfSqlite()
  const path = join(SCHEDULES_DIR, `${id}.json`)
  if (!existsSync(path)) die(`Schedule not found: "${id}"`)
  unlinkSync(path)
  ok('Deleted schedule')
})

// ── croco settings ────────────────────────────────────────────────────────────
const settingsCmd = program.command('settings').description('View/edit app settings (JSON backend only)')

settingsCmd.command('get [key]')
  .description('Print settings, or one dot-path key (e.g. `app.storageBackend`)')
  .action((key) => {
    const s = readSettings()
    if (!key) return console.log(JSON.stringify(s, null, 2))
    const value = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), s)
    console.log(JSON.stringify(value, null, 2))
  })

settingsCmd.command('set <key> <value>')
  .description('Set a dot-path settings key to a JSON value (e.g. `croco settings set app.closeBehavior "quit"`)')
  .action((key, value) => {
    const path = join(DATA_DIR, 'settings.json')
    const s = readJsonOr(path, {})
    let parsed
    try { parsed = JSON.parse(value) } catch { parsed = value }
    const parts = key.split('.')
    let node = s
    for (let i = 0; i < parts.length - 1; i++) {
      node[parts[i]] = node[parts[i]] && typeof node[parts[i]] === 'object' ? node[parts[i]] : {}
      node = node[parts[i]]
    }
    node[parts[parts.length - 1]] = parsed
    writeJson(path, s)
    ok(`Set ${b(key)} = ${JSON.stringify(parsed)}`)
  })

// ── boot ─────────────────────────────────────────────────────────────────────
program.parse()
