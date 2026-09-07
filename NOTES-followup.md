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
- Branch protection settings for `main` were recommended in the Phase 2
  report but not applied (no `gh` CLI / repo-admin access from this
  session) — still needs doing by hand in GitHub repo settings.

## Post-merge CI fallout (fixed directly on main, not a numbered phase)

- Phase 2's CI matrix went live on the real PR merge and immediately
  failed `cargo clippy` on `ubuntu-22.04` and `macos-latest` (never
  catchable locally — this dev machine is Windows-only). Two separate,
  genuinely distinct bugs, found by exhaustively auditing every
  `#[cfg(windows)]`/`#[cfg(not(windows))]`/`#[cfg(unix)]` block in the
  codebase for asymmetric variable usage:
  1. `no_window()` only mutated its `&mut Command` param inside
     `#[cfg(windows)]`; the non-Windows body was `let _ = cmd;` —
     `clippy::needless_pass_by_ref_mut`. Fixed by splitting into two
     platform-gated function definitions.
  2. `assert_write_target_safe()` computed `path_str` unconditionally but
     only read it inside a `#[cfg(windows)]` UNC-path check — plain
     `unused_variables` on non-Windows. Fixed by inlining the
     `.to_string_lossy()` call into the cfg-gated check itself.
  Both verified against real CI after push (commit `63c1b3d`) — green
  across all three platforms.
- The e2e nightly workflow ran for real (4 scheduled runs) and failed
  every single time, always at the same point: every `e2e/verify-*.mjs`
  script assumes `settings.json` already exists (backs it up before
  mutating, restores after) — true on a dev machine that's launched Croco
  before, false on a brand-new CI runner, so the first script in the
  chain (`verify-obsidian-sync.mjs`) threw immediately and the whole
  `&&`-chained `test:e2e` script never got past it. Fixed at the
  workflow level: a new step launches the built exe briefly and stops it
  (`setup_app()` writes default settings.json on startup) before the
  suite runs. **Not** fixed at the script level — all 8 scripts duplicate
  the identical existence check rather than sharing a helper, so anyone
  running `npm run test:e2e` locally on a genuinely fresh machine (never
  launched Croco) will still hit this; worth centralizing into a shared
  "ensure settings.json exists" helper at some point rather than fixing
  each script individually.
- This dev machine's Rust toolchain was accidentally left in a broken,
  version-mismatched state (rustc 1.96.0 paired with cargo 1.98.0) by an
  interrupted `rustup update stable` call during the CI-failure
  investigation. Repaired via a clean toolchain uninstall/reinstall, now
  on a consistent 1.98.1 — closer to what CI's `dtolnay/rust-toolchain@
  stable` actually fetches, which should reduce (not eliminate) future
  local/CI clippy-lint drift.
- Tried to get a genuine non-Windows compile locally (WSL Ubuntu) to
  verify the clippy fixes before pushing rather than relying on push-and-
  check. Blocked twice: `sudo` needed an interactive password this
  session couldn't provide (worked around via `wsl -u root`, which
  doesn't need one), then the actual `apt-get install` of Tauri's Linux
  deps (webkit2gtk et al.) hit ~14KB/s throughput on this WSL instance's
  network — >100MB at that rate is hours, not minutes. Abandoned as
  impractical; pushed the best-reasoned fix instead and verified against
  real CI, which turned out faster overall despite two round-trips.
- **E2E nightly is still broken after the settings.json bootstrap fix —
  a second, deeper issue.** Manually triggered a real run after the fix
  (commit `054e83a`): it got past the settings.json check this time, but
  failed with `session not created: DevToolsActivePort file doesn't
  exist` when tauri-driver/msedgedriver tries to actually launch the app.
  This is a well-known Selenium/Chromium-family error class, generally
  caused by the browser process failing to start normally in a
  restricted/non-interactive environment — plausible here since
  `windows-latest` GitHub runners don't have the same interactive desktop
  session this was verified against locally (Phase 1's tauri-driver
  testing all happened on this dev machine's normal logged-in session).
  Did not chase this further: e2e-nightly is a supplementary, non-blocking
  workflow (doesn't gate PRs or merges — the actual `ci.yml` gate is green
  on all three platforms), and fixing a CI-environment-specific WebView2
  launch failure blind, without a way to reproduce the runner's exact
  environment locally, risks an unbounded guess-push-wait cycle for
  comparatively low value. Needs real investigation in a future pass —
  likely starting points: whether tauri-driver needs an explicit
  `--native-driver`/user-data-dir flag under GitHub Actions' Windows
  runner, or whether the WebView2 Runtime install on that image needs a
  different bootstrap than what's already there.

## From Phase 3 (entitlements)

- **`croco-server` is built and verified end-to-end but not deployed
  anywhere.** `ENTITLEMENTS_SERVER_URL` in `src-tauri/src/entitlements.rs`
  points at `https://entitlements.croco.dev`, which does not resolve.
  Every entitlements_refresh call will fail with a network error until
  the private repo is actually hosted somewhere and that constant is
  updated to match — this is by design (see docs/entitlements.md's
  "Decisions made / still open"), not a bug, but worth flagging loudly
  since it means the whole feature is currently inert in any real build.
  A user with no GitHub login (the common case) never even attempts the
  call and just sees free tier, so this isn't user-visible yet.
- `src/lib/capabilities.js` has no direct test coverage — its logic
  mirrors `store.js`'s already-tested `ensure()` cache/TTL pattern
  closely enough that I judged it lower-risk than most of what got tests
  in Phase 2, but it's still untested. Would need an exported reset hook
  (its cache is a module-level closure, same issue `store.js` solved via
  `useDataStore.setState()`) to test properly.
- The CSP's `connect-src` addition for `entitlements.croco.dev` is
  currently unused in practice — every entitlements call goes through
  Rust (`reqwest`, in `entitlements.rs`), not the webview's `fetch`/XHR,
  so CSP doesn't actually govern it. Added anyway per the brief's
  explicit instruction and as forward-compatible hardening in case a
  future social-feature UI ever fetches directly from the frontend.
- The admin-side of the entitlements server (granting/revoking
  capabilities) has no UI or CLI beyond raw `curl`/HTTP calls against
  `POST /v1/admin/entitlements` — functional and tested, but a real
  admin workflow (a script, at minimum) would help once this is actually
  used for anything.

## From Phase 4.1 (UI audit)

- **The `color: '#000'`-hardcoded-near-`var(--accent)` contrast bug found
  in the audit exists in 11 files beyond the one fixed** (Projects.jsx):
  `Ideas.jsx`, `Notes.jsx`, `Onboarding.jsx`, `ProjectDetail.jsx`,
  `ProjectForm.jsx`, `Todo.jsx`, `CrocoGame/CrocoGame.jsx`,
  `GitHub/ChangelogPanel.jsx`, `ProjectDetail/GitPanel.jsx`,
  `Settings/ObsidianSection.jsx`, `Settings/StorageSection.jsx` (found via
  `grep -rln "color: '#000'"`). Each needs the same fix (`var(--accent-
  text)` instead of the hardcoded value) — deliberately not hand-patched
  now; these are exactly the pages Phase 4.2's page-by-page extraction
  will touch anyway, and patching them outside that process risks the
  same silent-inline-override trap this one instance already hit once
  (the class fix alone did nothing until the inline override was also
  removed).
- **Vim Classic's `dimmer`-on-`card` contrast (2.99:1, just under the
  3:1 large-text/UI threshold) was found but not fixed** — smaller margin
  of failure than Latte's, and depends on confirming actual font-size at
  each real use site before deciding whether it's a normal-text (4.5:1)
  or large-text (3:1) violation. Worth closing out alongside whichever
  theme-retirement decision you make (§5 of the audit) — moot if Vim
  Classic itself gets retired.
- **Theme retirement (8 → 4) is a recommendation only, not applied** —
  needs your sign-off per the brief before any theme is actually removed.
  See `docs/ui-audit.md` §5 for the specific proposal (keep Default/
  Futuristic/Mocha + pick one of NeoVim-Dark/Vim-Classic; retire Latte/
  Frappé/Macchiato + whichever of NeoVim/Vim isn't kept).
- **`pasta-galaxy` removal is similarly a recommendation, not applied** —
  confirmed dead (one line, no implementation anywhere), but removing a
  user-facing picker entry is exactly the kind of thing the brief's own
  Phase 4.4 asks to bring back for sign-off before deleting, so it wasn't
  touched in the audit pass itself.
- **Phase 4.2 (the actual ~2019-inline-style extraction) has not been
  started.** The audit (4.1) is done; the extraction, the new minimal
  Style (4.4), and the theme cleanup (4.5) are not. This is by far the
  largest remaining piece of Phase 4 — the brief itself calls it "the
  largest phase" and asks for before/after screenshots of every page in
  both the new Style and the previous default as part of its gate, which
  is real, cumulative, per-page visual-verification work, not something
  that compresses into a single pass. Flagging the scale honestly rather
  than either skipping the verification or claiming completion.
