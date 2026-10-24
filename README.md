# Croco — Project Manager

A fast, minimal desktop project manager built for developers. Small native binary, no bundled browser engine. Open source, built with Tauri + React.

![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Version](https://img.shields.io/github/v/release/ImSkuller/croco?label=latest)
![Downloads](https://img.shields.io/github/downloads/ImSkuller/croco/total?label=downloads)
![License](https://img.shields.io/badge/license-MIT-green)

Cross-platform (macOS/Linux) support is active work-in-progress for v2 — the codebase already builds a 3-OS matrix in CI, but only Windows has had an actual tested release so far.

## Download

Go to the [**Releases**](https://github.com/ImSkuller/croco/releases) tab and download the installer for your platform.

| Platform | File |
|---|---|
| Windows | `Croco_x.x.x_x64_setup.exe` |

Run the installer — Croco installs to `C:\Program Files\Croco`, adds a Start Menu shortcut, and puts the `croco` terminal command on your PATH (see [Terminal](#terminal)).

## Features

### Core

- **Projects** — Create from 26 starter templates (web, backend, CLI, and a Minecraft plugin/mod set for Paper, Fabric, NeoForge, Velocity, BungeeCord), import an existing folder, or **clone straight from GitHub**. Open in your IDE with one click, hide projects from the Dashboard, archive the ones you're done with.
- **Tags** — Colour-coded custom tags shared across projects and notes. Rename, merge, recolour and delete them from Settings → Tags and every card updates.
- **Git** — Commit (with or without pushing), amend, push, pull, fetch; inline colourised diffs; selective staging; stash/unstash; discard changes; create, switch (with stash-and-switch when your tree is dirty) and delete branches locally or on the remote. Pushes retry with your stored GitHub token when no credential helper is configured, so private repos work out of the box.
- **GitHub** — A dedicated page for every linked repo: overview, releases & tags with version diffing, issues & pull requests (open, comment, close, merge, and an **Open PR** flow from the Git tab), **Actions** run status, an auto-generated changelog, and contribution insights. Auto-create a public or private repo when you create a project.
- **Todos** — Scoped to a project or global, with due dates, completion tracking, fully customisable priority levels (add, rename, recolour, reorder), and a drag-and-drop **Kanban board** view (Backlog / Doing / Done). The Dashboard shows just how many are open; **Patterns** shows your completion rate for today, 7 days, 30 days, 3 months or lifetime.
- **Schedules & Deadlines** — Recurring reminders and one-off deadlines per project with desktop notifications.
- **Notes** — Markdown editor with live preview, image paste, star/pin/archive, project linking, and a tag filter. One-way sync to an Obsidian vault as markdown with frontmatter.
- **Patterns** — A habit dashboard scanned from every tracked project's real `git log`: contribution heatmap, weekly trend, language mix, todo completion rate, note-taking cadence, per-project time tracking, and two independent streaks (commits and app logins).
- **Project Insights** — On each project's overview, on demand: lines of code per language, a TODO/FIXME scanner (one click turns a marker into a todo), and a dependency audit that checks `package-lock.json`, `Cargo.lock` or pinned `requirements.txt` against the free [OSV.dev](https://osv.dev) database (only package names and versions are sent, only when you press the button).
- **Proactive Suggestions** — A Dashboard card that surfaces a streak about to break, overdue todos, a quiet project, or a growing high-priority backlog.
- **Favourites**, **Activity Log**, **per-project Terminal** with run/stop and streamed output, and an **Ideas** scratchpad with a drawing canvas.
- **Desktop notifications** — Deadline reminders plus per-event toggles for run finished/failed, push succeeded/failed, AI replies and focus sessions (Settings → Behaviour).
- **Command palette** — `Ctrl+K` with fuzzy matching across pages, projects, notes and actions; chord shortcuts (`G` + key) remappable in Settings → Shortcuts; press `?` to see them all.
- **Deep links & local API** — `croco://` links open a project or note; an optional local HTTP API lets editors and scripts talk to Croco.
- **SQLite or JSON storage** — Switch in Settings → Storage with one-click migration either way.
- **Auto-updates** — In-app update check; installs silently and restarts on Windows and Linux (AppImage); on macOS the new version downloads and mounts for you to drag into Applications.

### Terminal

Type `croco` in cmd, PowerShell or any shell to open an interactive prompt in the style of Claude Code — boxed input, live `/` command suggestions, history — backed by the same projects, todos and notes as the desktop app (JSON or SQLite). It's a standalone native binary; no Node required.

```sh
croco                         # interactive prompt
croco todos                   # what's open
croco add "Ship it" !high @my-project due:2026-12-31
croco done 2                  # tick off the 2nd item of the last list
croco stats                   # completion rate by day / week / month / 3 months / lifetime
croco code my-project         # start Claude Code in that project's folder
croco open | run | git | projects | notes | note | schedules | app | help
```

The Windows installer adds it to your PATH. On other setups use **Settings → Terminal → Add to PATH**.

### Modules (beta)

Optional features, off by default, each toggled in **Settings → Modules**:

- **AI** — Chat, Research, Plan and Code modes backed by a local *Storage Brain* that remembers what matters about your projects across sessions. Anthropic, OpenAI, Gemini or a local Ollama server; Research mode can use the provider's own web search. Also powers AI-generated commit messages and an **Ask AI** side panel inside the IDE that can insert or replace code in the open file.
- **IDE** — A Monaco-based editor (the engine behind VS Code) embedded in the app, with a file explorer, tabs, format-on-save and per-editor preferences.
- **Discord** — Rich Presence that follows what you're doing (browsing, editing a file, focusing, idle) with a "View on GitHub" button for the current repo or your profile, plus webhook posts for project events.
- **Docker** — Docker Compose for the current project: see services, bring them up, stop or tear them down, and tail logs without leaving Croco.
- **Env Manager** — An Env tab on each project for browsing and editing its `.env` files with values masked by default.
- **Slack** — Webhook notifications for the same events as Discord.
- **Focus Timer** — Pomodoro-style work/break sessions that run in the background (they finish and notify you even if you leave the page), with per-project daily stats.

### Appearance

Two independent axes in **Settings → Appearance**:

- **Theme** picks the palette: Default, Catppuccin Mocha, NeoVim Dark, Futuristic.
- **Style** picks the shape and motion on top of any theme: Default (liquid-glass — translucent frosted chrome, spring motion) or Natural (calmer and flatter, no glow).
- **Glass Effect** turns the window itself into real frosted glass on Windows 11 (Mica, falling back to Acrylic/Blur), not a simulated blur.
- Accent colour and font are free choices on top of both.

## System Requirements

- Windows 10 or later (x64); Windows 11 for the frosted-glass window
- ~40 MB disk space
- Internet connection for GitHub, AI providers and update checks (all optional)

## Updates

Croco checks for updates on launch and every six hours after. When one is available you'll get a notification and a badge in the sidebar. **Settings → Updates** shows the release notes and an **Install** button with a download progress bar; updates are signature-verified before installing, and the app restarts automatically.

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 19, React Router v7, Vite 8, Monaco (IDE module) |
| Desktop | Tauri 2 (Rust) |
| Styling | CSS custom properties (theme + style system) |
| Fonts | Geist, Inter, IBM Plex Sans, Nunito, DM Sans, Geist Mono |
| Terminal app | Rust + crossterm (`cli-rs/`) |
| Storage | JSON files or bundled SQLite (`rusqlite` with `bundled` feature); secrets in the OS keyring |
| HTTP | reqwest (GitHub API, AI providers, webhooks) |

## Building from source

Requirements: Node.js (LTS) and the [Rust toolchain](https://www.rust-lang.org/tools/install), plus the platform prerequisites for [Tauri v2](https://v2.tauri.app/start/prerequisites/).

```sh
npm install
npm run tauri:dev    # dev mode with hot reload
npm run tauri:build  # full production bundle (also builds cli-rs/, the `croco` terminal app)
```

The terminal app lives in `cli-rs/` and builds on its own with `cargo build --release` there. Release builds sign the updater artifacts with a key supplied through `TAURI_SIGNING_PRIVATE_KEY` — never commit key material or `.env` files.

`npm run build` builds just the frontend (useful for quickly catching JS errors); `cargo check` in `src-tauri/` does the same for the Rust side. `cargo test` runs the backend unit tests.

## Contributing

Issues and pull requests are welcome. This is a young open-source project — if you're planning a larger change, opening an issue first to discuss it is appreciated before you sink time into a PR.

## Changelog

Full version history and release notes live on the [**Releases**](https://github.com/ImSkuller/croco/releases) page — every release is tagged there with its own notes, so this README doesn't need to be updated each time.

## License

MIT — see [LICENSE](LICENSE).

## Support

Found a bug or have a suggestion? Open an [issue](https://github.com/ImSkuller/croco/issues).
