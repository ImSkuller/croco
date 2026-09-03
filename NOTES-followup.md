# Follow-up notes

Things noticed while working through the remediation brief that are out of
scope for the current phase. Not acted on yet.

## From Phase 0 baseline

- `npm audit` reported 8 vulnerabilities (2 low, 1 moderate, 5 high) in
  `node_modules` as of the 2026-08-26 baseline. **Resolved in Phase 2** via
  `npm audit fix` (all had non-breaking fixes available) — see the Phase 2
  section below.
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

## From Phase 2 (CI, tests, supply chain)

- **`cargo fmt --check` is NOT in CI**, deliberately — the codebase's
  compact single-line if/match style fails it on all 16 Rust source files
  (282 diff hunks), and stable `rustfmt` has no config option to preserve
  that style. You chose "skip the fmt gate, keep clippy + test + build"
  over a mass reformat. If that changes, the reformat should be its own
  isolated commit (see the Phase 2 report for the full option writeup)
  before turning the CI check on.
- `npm audit` is clean (0 vulnerabilities) as of this phase — fixed via
  `npm audit fix` (bumped `@babel/core`, `brace-expansion`, `dompurify`,
  `nanoid`, `postcss`, `react-router`/`react-router-dom`, `vite`, all
  within semver-compatible ranges, no `--force` needed).
- `cargo audit` still reports 2 unfixable vulnerabilities: RUSTSEC-2026-0194
  and -0195 (quick-xml, both DoS-on-untrusted-XML), pulled in transitively
  via `plist` (pinned by `tauri v2.11.2` itself to `quick-xml ^0.39.2`,
  which can't be bumped to the fixed `>=0.41.0` without an upstream
  tauri/plist release). Explicitly ignored in CI with a comment explaining
  why and what would unblock it — re-check on every tauri version bump.
  (A third, quinn-proto, *was* fixable and got bumped via `cargo update -p
  quinn-proto --precise 0.11.15`.)
- `cargo audit` also surfaces 19 "unmaintained" (not vulnerable) warnings,
  mostly the GTK3 bindings pulled in transitively via `rfd`'s Linux file-
  dialog backend (`atk`/`gdk`/`gtk`/etc.), plus `proc-macro-error` and the
  `unic-*` crates. These don't fail the CI gate (only actual vulnerabilities
  do, not warnings) and weren't chased down — worth a look whenever `rfd`
  or its GTK3 dependency chain has a maintained alternative.
- The e2e nightly workflow (`.github/workflows/e2e-nightly.yml`) is written
  and mirrors the locally-verified tauri-driver + msedgedriver pattern
  (WebView2-version-matched driver download, `--no-bundle` release build,
  `npm run test:e2e`), but **has not been run on an actual GitHub-hosted
  runner** — only the equivalent local setup was verified in Phase 1. Watch
  its first scheduled/manual run for anything environment-specific that
  doesn't hold on `windows-latest` (e.g. WebView2 version availability,
  `cargo install tauri-driver` build time within the job timeout).
- Branch protection settings for `main` were recommended in the Phase 2
  report but not applied (no `gh` CLI / repo-admin access from this
  session) — still needs doing by hand in GitHub repo settings.
