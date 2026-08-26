#!/usr/bin/env node
import { program } from 'commander'
import { execSync, spawn } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import os from 'os'
import { DATA_DIR, findProject, readProjects, readSettings } from './data.js'

const PROJECT_DETAILS_DIR = join(DATA_DIR, 'project-details')

// ── ANSI helpers ─────────────────────────────────────────────────────────────

const b  = s => `\x1b[1m${s}\x1b[0m`
const d  = s => `\x1b[2m${s}\x1b[0m`
const g  = s => `\x1b[32m${s}\x1b[0m`
const y  = s => `\x1b[33m${s}\x1b[0m`
const bl = s => `\x1b[34m${s}\x1b[0m`
const r  = s => `\x1b[31m${s}\x1b[0m`
const or = s => `\x1b[38;5;208m${s}\x1b[0m`

// ── Shared constants ─────────────────────────────────────────────────────────

const IDE_CMD = {
  vscode:   p => `code "${p}"`,
  cursor:   p => `cursor "${p}"`,
  webstorm: p => `webstorm "${p}"`,
  idea:     p => `idea "${p}"`,
  zed:      p => `zed "${p}"`,
  sublime:  p => `subl "${p}"`,
  vim:      p => `vim "${p}"`,
  neovim:   p => `nvim "${p}"`,
  atom:     p => `atom "${p}"`,
}

// ── Utility functions ─────────────────────────────────────────────────────────

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'project'
}

function uniqueSlug(base) {
  const taken = new Set(readProjects().map(p => p.slug))
  let slug = base, i = 2
  while (taken.has(slug)) slug = `${base}-${i++}`
  return slug
}

function relativeTime(iso) {
  if (!iso) return 'never'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000)     return 'just now'
  if (diff < 3600000)   return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000)  return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 172800000) return 'yesterday'
  return `${Math.floor(diff / 86400000)}d ago`
}

function autoDetectCommands(root) {
  const empty = { dev: '', build: '', start: '', test: '', custom: [] }
  const pkgPath = join(root, 'package.json')
  if (!existsSync(pkgPath)) return empty
  try {
    const scripts = JSON.parse(readFileSync(pkgPath, 'utf-8')).scripts || {}
    return {
      dev:    scripts.dev   ? 'npm run dev'   : scripts.start ? 'npm start' : '',
      build:  scripts.build ? 'npm run build' : '',
      start:  scripts.start ? 'npm start'     : '',
      test:   scripts.test  ? 'npm test'      : '',
      custom: [],
    }
  } catch { return empty }
}

// ── pm list ───────────────────────────────────────────────────────────────────

program
  .command('list')
  .alias('ls')
  .description('List all projects')
  .option('-n, --limit <n>', 'Max projects to show', '20')
  .action((opts) => {
    const projects = readProjects().slice(0, parseInt(opts.limit))

    if (!projects.length) {
      console.log()
      console.log(d('  No projects found. Run `pm new <name>` to create one.'))
      console.log()
      return
    }

    const nameW = Math.min(30, Math.max(12, ...projects.map(p => p.name.length)) + 2)
    const ideW  = 10
    const timeW = 12

    console.log()
    console.log(`  ${b('Projects')} ${d(`(${projects.length})`)}`)
    console.log()
    console.log(`  ${b('NAME'.padEnd(nameW))}  ${b('IDE'.padEnd(ideW))}  ${b('LAST OPENED'.padEnd(timeW))}  ${b('PATH')}`)
    console.log(`  ${d('─'.repeat(nameW + ideW + timeW + 36))}`)

    for (const p of projects) {
      const star  = p.favourite ? y('★') : ' '
      const label = `${p.emoji || '📁'} ${p.name}`
      const ide   = d((p.ide || 'vscode').padEnd(ideW))
      const time  = d(relativeTime(p.meta?.lastOpenedAt).padEnd(timeW))
      const path_ = d(p.paths?.projectRoot || '—')
      console.log(`  ${star} ${label.padEnd(nameW)} ${ide}  ${time}  ${path_}`)
    }

    console.log()
  })

// ── pm new ────────────────────────────────────────────────────────────────────

program
  .command('new <name>')
  .description('Create a new project')
  .option('--ide <ide>',     'IDE (vscode, cursor, webstorm…)')
  .option('--desc <text>',   'Short description')
  .option('--tags <tags>',   'Comma-separated tags (e.g. web,react)')
  .option('--path <path>',   'Override project root path')
  .option('--emoji <emoji>', 'Project emoji')
  .option('--hidden',        'Mark as hidden/private project')
  .option('--open',          'Open in IDE immediately after creation')
  .action((name, opts) => {
    const settings   = readSettings()
    const slug       = uniqueSlug(slugify(name))
    const ide        = opts.ide || settings.defaults?.ide || 'vscode'
    const basePath   = opts.hidden
      ? (settings.paths?.hiddenProjects || join(os.homedir(), '.private'))
      : (settings.paths?.publicProjects || join(os.homedir(), 'projects'))
    const root = opts.path || join(basePath, slug)
    const now  = new Date().toISOString()

    const project = {
      id:          randomUUID(),
      name,
      slug,
      description: opts.desc  || '',
      emoji:       opts.emoji || '📁',
      tags:        opts.tags  ? opts.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      visibility:  opts.hidden ? 'hidden' : 'public',
      ide,
      github:      null,
      paths:       { projectRoot: root, entryFile: '' },
      commands:    autoDetectCommands(root),
      favourite:   false,
      meta:        { createdAt: now, lastOpenedAt: now, lastCommitAt: null },
    }

    // Same per-file layout the desktop app reads: project-details/<id>.json
    mkdirSync(PROJECT_DETAILS_DIR, { recursive: true })
    writeFileSync(join(PROJECT_DETAILS_DIR, `${project.id}.json`), JSON.stringify(project, null, 2))

    if (!existsSync(root)) mkdirSync(root, { recursive: true })

    console.log()
    console.log(`${g('✓')} ${b(`Created ${project.emoji} ${name}`)}`)
    console.log(d(`  id:   ${project.id}`))
    console.log(d(`  slug: ${slug}`))
    console.log(d(`  path: ${root}`))
    console.log(d(`  ide:  ${ide}`))
    if (project.tags.length) console.log(d(`  tags: ${project.tags.join(', ')}`))
    console.log()

    if (opts.open) {
      const cmd = (IDE_CMD[ide] || IDE_CMD.vscode)(root)
      console.log(`${bl('→')} ${d(`Opening in ${ide}…`)}`)
      try { execSync(cmd, { stdio: 'ignore' }) } catch { /* IDE launcher exits non-zero on some systems */ }
    } else {
      console.log(d(`  Run ${b('pm open ' + slug)} to open in ${ide}`))
    }

    console.log()
  })

// ── pm open ───────────────────────────────────────────────────────────────────

program
  .command('open <name>')
  .description('Open a project in its configured IDE')
  .option('--ide <ide>', 'Override IDE for this open')
  .action((name, opts) => {
    const project = findProject(name)
    if (!project) {
      console.error(r(`✗ Project not found: "${name}"`))
      console.error(d('  Run `pm list` to see available projects'))
      process.exit(1)
    }

    const ide = opts.ide || project.ide || 'vscode'
    const cmd = (IDE_CMD[ide] || IDE_CMD.vscode)(project.paths.projectRoot)

    console.log(`${bl('→')} Opening ${project.emoji} ${b(project.name)} ${d(`in ${ide}…`)}`)
    try { execSync(cmd, { stdio: 'ignore' }) } catch { /* non-zero exits are normal for detached launchers */ }
  })

// ── pm run ────────────────────────────────────────────────────────────────────

program
  .command('run <name> [type]')
  .description('Run a project command: dev (default), build, start, test, or a raw command string')
  .action((name, type = 'dev') => {
    const project = findProject(name)
    if (!project) {
      console.error(r(`✗ Project not found: "${name}"`))
      console.error(d('  Run `pm list` to see available projects'))
      process.exit(1)
    }

    const cmds    = project.commands || {}
    const SLOTS   = ['dev', 'build', 'start', 'test']
    const isSlot  = SLOTS.includes(type)
    const cmd     = isSlot ? cmds[type] : type

    if (!cmd) {
      console.error(r(`✗ No "${type}" command configured for ${project.name}`))
      const available = SLOTS.filter(k => cmds[k])
      if (available.length) console.error(d(`  Available slots: ${available.join(', ')}`))
      console.error(d('  You can also pass a raw command: pm run <project> "npx ts-node src/index.ts"'))
      process.exit(1)
    }

    const root = project.paths?.projectRoot
    if (!existsSync(root)) {
      console.error(r(`✗ Project root does not exist: ${root}`))
      process.exit(1)
    }

    console.log()
    console.log(`${or('▶')} ${b(`${project.emoji} ${project.name}`)} ${d(`— ${cmd}`)}`)
    console.log(d(`  cwd: ${root}`))
    console.log()

    const child = spawn(cmd, { cwd: root, shell: true, stdio: 'inherit' })
    child.on('error', err => { console.error(r(`✗ ${err.message}`)); process.exit(1) })
    child.on('exit',  code => process.exit(code ?? 0))

    process.on('SIGINT',  () => child.kill('SIGINT'))
    process.on('SIGTERM', () => child.kill('SIGTERM'))
  })

// ── boot ─────────────────────────────────────────────────────────────────────

program.parse()
