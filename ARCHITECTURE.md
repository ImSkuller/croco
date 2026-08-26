# Architecture

Croco is a desktop project manager built with **Tauri v2** (Rust backend) +
**React 19** (Vite, JSX, no TypeScript).

```
src/                    React frontend
  lib/api.js            window.api.* -> Tauri invoke() bridge; the frontend/backend contract
  lib/store.js           zustand store — all list data (projects/notes/todos/activity) flows through this
  lib/theme.js            Theme axis: colours (8 themes, html.theme-* classes)
  lib/appearanceStyle.js  Style axis: look-and-feel (html.style-* classes) — independent of Theme
  pages/                 one file per route
  components/            per-page component folders + shared layout
src-tauri/src/          Rust backend, one module per domain (main.rs is just
                         app/tray/menu wiring and invoke_handler registration —
                         not where command logic lives)
  settings.rs             settings read/write/defaults
  projects.rs, notes_todos.rs, git_ops.rs, personality.rs, data_transfer.rs,
  obsidian.rs, updates.rs, system.rs, run_ops.rs, db.rs, activity.rs
cli/                    `pm`/`croco` CLI — reads the same data directory as the app
```

## Storage backends

Project/note/todo data has two switchable backends
(`settings.json` -> `app.storageBackend`, `"json"` or `"sqlite"`):

- **json** (default): `project-details/<id>.json`, `notes/<id>.json` +
  `<id>.md`, `todos/<id>.json` under the app data directory.
- **sqlite**: a single `croco.db` with `projects` / `notes` / `todos` /
  `activity` tables, each row `(id TEXT PRIMARY KEY, data TEXT)` holding a
  JSON blob (notes additionally store rendered content in `_content`).

**Activity is always SQLite**, regardless of the selected backend (falls
back to `activity.json` only if the DB is unavailable).

**`settings.json` itself is always plain JSON**, independent of
`app.storageBackend` — that setting only affects where projects/notes/todos
are stored, never settings.

Reads go through `settings.rs::read_settings`, which deep-merges the file on
disk onto `default_settings()` (`settings.rs::deep_merge`). This means a
settings.json written by an older version, missing keys added in a later
release, still gets those keys at read time with no explicit migration step
— new nested defaults just appear. Any new settings field should be added to
`default_settings()`, not assumed to already exist in every user's file.

## Appearance: Theme vs. Style

Two independent appearance axes compose together:

- **Theme** (`src/lib/theme.js`) — colours only. Applied as an
  `html.theme-*` class plus CSS custom properties.
- **Style** (`src/lib/appearanceStyle.js`) — look-and-feel: shapes, blur,
  motion, chrome. Applied as an `html.style-*` class, independent of colour.

A theme's accent colour still applies under any style's chrome — e.g. a
custom accent survives switching from the default style to a frosted-glass
style.

## Tauri command naming convention

Commands are named `<domain>_<verb>` (e.g. `settings_get`, `projects_get_all`,
`git_status`, `run_stop`), matching the Rust module they live in. Every
command must be registered in `invoke_handler` (`main.rs`) and exposed as a
matching entry in `src/lib/api.js` — that file is the single frontend/backend
contract; nothing calls `invoke()` directly outside of it.

## Adding a new backend module

New modules live at `src-tauri/src/<name>.rs` and are declared in `main.rs`
as `mod <name>; pub(crate) use <name>::*;`. Keep logic out of `main.rs`
itself — it is app/tray/menu wiring and command registration only.
