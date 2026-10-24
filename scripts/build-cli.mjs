// Builds the standalone `croco` terminal app (cli-rs/) and stages it in
// src-tauri/cli-bin/, where tauri.conf.json's bundle.resources picks it up
// (installed as <app dir>/bin/croco[.exe]). Runs as part of
// `beforeBuildCommand`, so every installer ships a matching CLI. Honors
// TAURI_ENV_TARGET_TRIPLE so `tauri build --target <triple>` (the macOS
// arm64/x64 CI jobs) builds the CLI for the same architecture.
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const triple = process.env.TAURI_ENV_TARGET_TRIPLE || ''
const isWindows = triple ? triple.includes('windows') : process.platform === 'win32'
const exe = isWindows ? 'croco.exe' : 'croco'

const args = ['build', '--release', '--manifest-path', join(root, 'cli-rs', 'Cargo.toml')]
if (triple) args.push('--target', triple)

console.log(`[build-cli] cargo ${args.join(' ')}`)
const r = spawnSync('cargo', args, { stdio: 'inherit', shell: process.platform === 'win32' })
if (r.status !== 0) {
  console.error('[build-cli] cargo build failed')
  process.exit(r.status ?? 1)
}

const built = join(root, 'cli-rs', 'target', ...(triple ? [triple] : []), 'release', exe)
if (!existsSync(built)) {
  console.error(`[build-cli] expected binary not found: ${built}`)
  process.exit(1)
}
const outDir = join(root, 'src-tauri', 'cli-bin')
mkdirSync(outDir, { recursive: true })
copyFileSync(built, join(outDir, exe))
console.log(`[build-cli] staged ${join(outDir, exe)}`)
