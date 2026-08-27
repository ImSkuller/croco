# Contributing to Croco

Thanks for taking an interest in Croco. This doc covers what you need to get
a change from idea to merged PR.

## Getting set up

```
npm ci
npm run tauri:dev     # dev mode, Vite on :5173
```

Requirements: Node (see `package.json` engines if present), Rust stable, and
the platform prerequisites Tauri v2 needs for your OS (WebView2 on Windows —
usually already present; `webkit2gtk` + friends on Linux; Xcode command line
tools on macOS).

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the frontend, backend, and
storage layers fit together before making a non-trivial change.

## Before opening a PR

```
npm run build          # catches JS/build errors
npm run lint            # eslint
cd src-tauri && cargo check && cargo test
```

All of the above must pass. `npm run tauri:build` (full bundle) is not
required for every PR but is worth running if you touched packaging,
updater, or native integration code.

## Making changes

- Keep PRs scoped to one logical change. Unrelated cleanup (formatting,
  unused imports, etc.) belongs in its own PR.
- New Tauri commands must be registered in `invoke_handler` (`main.rs`) AND
  exposed in `src/lib/api.js` — see [ARCHITECTURE.md](ARCHITECTURE.md).
- Any command that touches the filesystem heavily, spawns a process, or
  hits the network must be `async fn` — Tauri runs sync commands on the
  main thread and freezes the UI otherwise.
- List-backed pages must read from `useData()` (`src/lib/store.js`), never
  fetch directly — see the frontend data rules if you're touching a page
  that lists projects/notes/todos/activity.
- Match the existing code style: inline styles with CSS custom properties
  (no CSS-in-JS, no Tailwind), no TypeScript in `src/`.

## Commit messages

Plain, descriptive commit messages — no required prefix convention. Explain
*why* a change was made when it isn't obvious from the diff.

## Reporting bugs / requesting features

Use the issue templates. For security vulnerabilities, see
[SECURITY.md](SECURITY.md) instead of opening a public issue.

## Windows code signing (not yet set up)

The NSIS installer `.github/workflows/release.yml` builds is currently
**unsigned**. That triggers a Windows SmartScreen warning on every download,
which hurts first-install conversion, and `installMode: "perMachine"` means
every install/update needs a UAC elevation prompt on top of that. Neither is
fixed yet — no certificate is available as of this writing. To fix it:

1. Get a code-signing certificate. Two realistic options:
   - **Azure Trusted Signing** (Microsoft's newer, cheaper option — a
     per-year subscription rather than a traditional EV cert purchase).
     Requires a verified Azure account and a few days for identity
     verification the first time.
   - A traditional **EV code-signing certificate** from a CA (DigiCert,
     SSL.com, etc.) — more expensive, but works with the classic
     `signtool.exe`-based signing step without an Azure dependency.
2. Wire the signing step into `.github/workflows/release.yml`, after
   `tauri-apps/tauri-action` produces the NSIS installer and before the
   release asset is uploaded. For Azure Trusted Signing, use
   `azure/trusted-signing-action`; for a traditional cert, use `signtool
   sign /f <cert> /p <password> /fd sha256 /tr <timestamp-url> /td sha256`
   on the built `.exe`.
3. Store whatever credential the chosen path needs (Azure service principal
   secret, or the `.pfx` + password) as GitHub Actions secrets — never
   commit them, same rule as the updater signing key in `SECURITY.md`.
4. Once signing is live, `installMode` can be revisited — a signed
   `perMachine` install still prompts for UAC once per install/update, but
   without the SmartScreen "unknown publisher" warning on top of it.

**Tracking:** this needs a GitHub issue opened (labelled `security`, not yet
created as of the Phase 1 remediation pass — see the phase report) so it
doesn't get silently forgotten.

## Code of Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
