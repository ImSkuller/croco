// Runs every e2e/verify-*.mjs sequentially (they all bind tauri-driver to
// port 4444, so they can't run in parallel) and prints a pass/fail table.
// Each script is isolated via CROCO_DATA_DIR — see the individual scripts.
//
//   node e2e/run-all.mjs            # all
//   node e2e/run-all.mjs modules    # only scripts whose name contains "modules"
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dir = path.dirname(fileURLToPath(import.meta.url))
const filter = process.argv[2] || ''
const scripts = readdirSync(dir).filter(f => f.startsWith('verify-') && f.endsWith('.mjs') && f.includes(filter)).sort()

const results = []
for (const s of scripts) {
  const started = Date.now()
  console.log(`\n=== ${s} ===`)
  const r = spawnSync(process.execPath, [path.join(dir, s)], { stdio: 'inherit', env: process.env })
  results.push({ s, ok: r.status === 0, secs: ((Date.now() - started) / 1000).toFixed(1) })
}

console.log('\n=== summary ===')
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.s}  (${r.secs}s)`)
const failed = results.filter(r => !r.ok).length
console.log(`${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
