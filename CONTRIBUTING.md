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

## Code of Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
