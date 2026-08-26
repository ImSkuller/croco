# Croco — Project Manager

A fast, minimal desktop project manager built for developers. ~8 MB binary, no browser engine overhead. Open source, built with Tauri + React.

![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Version](https://img.shields.io/github/v/release/ImSkuller/croco-releases?label=latest)
![Downloads](https://img.shields.io/github/downloads/ImSkuller/croco-releases/total?label=downloads)
![License](https://img.shields.io/badge/license-MIT-green)

Cross-platform (macOS/Linux) support is active work-in-progress for v2 — the codebase already builds a 3-OS matrix in CI, but only Windows has had an actual tested release so far.

## Download

Go to the [**Releases**](https://github.com/ImSkuller/croco-releases/releases) tab and download the installer for your platform.

| Platform | File |
|---|---|
| Windows | `Croco_x.x.x_x64_setup.exe` |

Run the installer — Croco installs to `C:\Program Files\Croco` and adds a Start Menu shortcut.

## Features

- **Projects** — Create from 26 starter templates including a Minecraft plugin/mod set (Paper, Fabric, NeoForge, Velocity, BungeeCord); redesigned minimal two-column create flow; import existing folders; open in IDE with one click; tag and filter; archived projects tucked into a collapsible dropdown on the "All" tab instead of a separate view
- **Git & GitHub** — Commit, push, pull, view log, create branches, view an inline colorized diff per changed file, and selectively stage/unstage individual files instead of always staging everything; auto-create GitHub repos (choose public or private) on project creation; push/pull/fetch all retry with your stored GitHub token if your system has no credential helper configured, so private repos work out of the box
- **Todos** — Scoped to projects or global, with due dates, completion date tracking, a 6-day revert lock, and **fully customizable priorities** — add, rename, recolor, reorder, and delete priority levels from the Priority Manager (⚙ next to the priority filter tabs), not just a fixed High/Medium/Low
- **Notes** — Markdown editor with live preview, paste images from clipboard, archive/unarchive, star, pin, and link to projects; one-way sync to an Obsidian vault as markdown with frontmatter
- **Patterns** — A real habit dashboard, not just a summary card: a GitHub-style contribution heatmap, a weekly commit trend chart, language mix across all tracked projects, todo completion rate, note-taking cadence, and which projects are getting attention vs. going quiet. Commit data is scanned straight from every tracked project's actual `git log` (not just commits made through Croco) and kept fresh automatically. Two independent streaks: a **commit streak** and an **app login streak** that stays alive even on days you don't push code
- **Proactive Suggestions** — A Dashboard card nudges you about things worth knowing — a streak about to break, overdue todos, a quiet project, a growing high-priority backlog — dismissable per item
- **Favourites** — Pin projects for quick access; drag to reorder, order persists across restarts
- **Activity Log** — Tracks all project, todo, note, git, run, and settings events; filterable by category, grouped by day
- **Terminal** — Per-project run commands with progress-bar support, graceful stop, and shell preference
- **Ideas Scratchpad** — 69 curated ideas across 11 categories; canvas drawing with undo and eraser tool
- **Themes & Styles** — Two independent appearance axes in Settings → Appearance. **Theme** picks the colour palette: Default, four Catppuccin variants (Latte/Frappé/Macchiato/Mocha), NeoVim Dark, Vim Classic, and Futuristic (neon cyan/violet with glow effects). **Style** picks the overall look-and-feel on top of any theme: Default (today's flat-card look) or Apple (liquid-glass — translucent blurred panels, pill buttons, spring motion); Pasta Galaxy is listed as coming soon
- **SQLite Storage** — Switch from JSON files to a bundled SQLite database via Settings → Storage; one-click migration, JSON files kept as backup
- **Croco Run** — Retro dino-style easter egg game; type `croco:game` in the search bar or click your profile 5 times; high score saved locally
- **Keyboard Shortcuts** — Chord navigation (G+key), remappable via Settings → Shortcuts, displayed with the right modifier key for your OS; press `?` to see them all
- **Auto-updates** — In-app update check; installs silently and restarts automatically on Windows and Linux (AppImage); on macOS the new version downloads and mounts, then you drag it to Applications as usual

## System Requirements

- Windows 10 or later (x64)
- ~30 MB disk space
- Internet connection for GitHub features and update checks (optional)

## Updates

Croco checks for updates on launch. When one is available you'll see a banner in the sidebar. Click **Settings → Updates → Install** — the update downloads and installs silently. The app restarts automatically.

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 19, React Router v7, Vite 8 |
| Desktop | Tauri 2 (Rust) |
| Styling | CSS custom properties (theme + style system) |
| Fonts | Geist, Inter, IBM Plex Sans, Nunito, DM Sans, Geist Mono |
| Storage | JSON files or bundled SQLite (`rusqlite` with `bundled` feature) |
| HTTP | reqwest (GitHub API, community tags) |

## Building from source

Requirements: Node.js (LTS) and the [Rust toolchain](https://www.rust-lang.org/tools/install), plus the platform prerequisites for [Tauri v2](https://v2.tauri.app/start/prerequisites/).

```sh
npm install
npm run tauri:dev    # dev mode with hot reload
npm run tauri:build  # full production bundle
```

`npm run build` builds just the frontend (useful for quickly catching JS errors); `cargo check` in `src-tauri/` does the same for the Rust side.

## Contributing

Issues and pull requests are welcome. This is a young open-source project — if you're planning a larger change, opening an issue first to discuss it is appreciated before you sink time into a PR.

## Changelog

Full version history and release notes live on the [**Releases**](https://github.com/ImSkuller/croco-releases/releases) page — every release is tagged there with its own notes, so this README doesn't need to be updated each time.

## License

MIT — see [LICENSE](LICENSE).

## Support

Found a bug or have a suggestion? Open an [issue](https://github.com/ImSkuller/croco-releases/issues).
