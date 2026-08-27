# Follow-up notes

Things noticed while working through the remediation brief that are out of
scope for the current phase. Not acted on yet.

## From Phase 0 baseline

- `npm audit` reports 8 vulnerabilities (2 low, 1 moderate, 5 high) in
  `node_modules` as of the 2026-08-26 baseline. Not triaged — belongs in
  Phase 2 (supply chain: `npm audit --audit-level=high` in CI).
- `npm run build` warns that `dist/assets/index-*.js` is 791 KB
  (min+gzip 200 KB), above Vite's 500 KB chunk-size-warning threshold. No
  code-splitting today. Not a Phase 0 concern; worth a look during Phase 4
  (page splitting) or Phase 5 (perf) since large pages like
  `ProjectDetail.jsx`/`Settings.jsx`/`Onboarding.jsx` are likely the bulk
  of it.
- `npm run lint` baseline has 5 pre-existing `react-hooks/exhaustive-deps`
  warnings (0 errors): `GitHub/InsightsPanel.jsx:40`,
  `layout/AppShell.jsx:22`, `pages/NoteEditor.jsx:83`,
  `pages/ProjectDetail.jsx:139` and `:204`. Recorded as baseline, not fixed
  — fixing these isn't Phase 0 scope and at least one (`ProjectDetail.jsx`)
  overlaps with the Phase 4 page-splitting work anyway.

## From Phase 1 (security)

- `index.html:8` still has `<title>Pac Man</title>` — another leftover from
  the pre-Croco-rename, same family as the `release.yml` one CLAUDE.md
  already flags as fixed. Trivial one-line fix, but out of scope for a
  security phase; do it opportunistically in an unrelated doc/chore pass.
- `ai.keys.{anthropic,openai,gemini}` and the rest of `settings.ai`/
  `settings.api` remain dead config per CLAUDE.md/Phase 5 item 7 — Phase 1
  only stopped them from ever being stored in plaintext (migrated any
  legacy value into the keyring, strips them from every read/write). Full
  removal from `default_settings()` is still Phase 5's job, not done here.
- `keyring`'s Linux fallback (`secrets.rs`, used only when no Secret Service
  is available) encrypts the local secrets file with a key stored right next
  to it on disk — that stops casual disk access/backups but not another
  process reading the same app data directory. This is inherently weaker
  than a real OS keyring; flagged to the user in Settings via
  `secretsFallbackActive`, and called out again in the phase report. Could
  not be tested on this machine (Windows-only dev box) — only the primary
  Windows Credential Manager path was verified with a real round-trip.
- Adding `tauri-plugin-updater` pulled in a second `reqwest` major version
  (0.13.4 alongside the existing 0.12.28) as a transitive dependency of the
  plugin's own HTTP client, duplicating some of the TLS/HTTP stack in the
  binary. Didn't chase pinning this down in Phase 1 — worth a look in
  Phase 5/"keep the binary small" pass if binary size becomes a concrete
  problem.
- `run_ops.rs::run_start` is a plain `fn`, not `async fn`, even though it
  spawns a child process — violates the CLAUDE.md rule that anything
  spawning a process/touching the filesystem heavily/hitting the network
  must be async (sync commands block Tauri's main thread). Pre-existing,
  not introduced by Phase 1's confirmation-gate change to this function;
  belongs in Phase 5's correctness/performance pass.
- `style-src` in the new CSP (`tauri.conf.json`) still needs
  `'unsafe-inline'` because ~1,674 inline `style={{}}` objects across
  `src/` render as inline `style=""` attributes, which CSP blocks without
  it. This is the one place Phase 1's CSP isn't as strict as the brief's
  "no unsafe-eval" framing implied it should be — see the Phase 1 report
  for the full reasoning. Tightening it to drop `'unsafe-inline'` is
  gated on Phase 4's inline-style extraction, not Phase 1.
- The Google Fonts `@import` at `src/index.css:1` (12 font families,
  loaded from `fonts.googleapis.com`/`fonts.gstatic.com` at runtime) is
  still live — the CSP had to allow those two origins in `style-src`/
  `font-src` to avoid breaking the current UI. Phase 4 already plans to
  self-host these; once that lands, those two CSP allowances should come
  out too.
