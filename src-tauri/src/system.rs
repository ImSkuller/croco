// Small OS-integration and misc utility commands: opening paths/URLs,
// platform/homedir queries, the embedded community-user list, the project
// template catalog, and cross-cutting helpers (validate_safe_id) used
// throughout the rest of the backend.

use serde_json::{json, Value};
use std::path::Path;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
pub fn system_open_path(app: AppHandle, p: String) -> Result<(), String> {
    app.opener().open_path(&p, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn system_open_external(app: AppHandle, url: String) -> Result<(), String> {
    app.opener().open_url(&url, None::<&str>).map_err(|e| e.to_string())
}

// Opens (or refocuses) a native webview window inside the app, instead of
// handing the URL off to the system browser. Available for embedding
// pages that feel like part of Croco rather than a redirect — not
// currently wired to any feature (the LeetCode easter egg used this but
// was switched to system_open_external because leetcode.com's bot
// protection returns 403/blank inside an embedded, non-browser webview).
#[tauri::command]
pub fn system_open_in_app_browser(app: AppHandle, label: String, url: String, title: String) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(&label) {
        w.show().ok();
        w.set_focus().ok();
        return Ok(());
    }
    let parsed = url.parse::<tauri::Url>().map_err(|e| e.to_string())?;
    let builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(parsed))
        .title(title)
        .inner_size(1200.0, 840.0)
        .min_inner_size(600.0, 400.0);
    // drag_and_drop() only exists on Windows in the tauri crate — it's a
    // WebView2-specific quirk. WebView2 intercepts HTML5 drag gestures at
    // the native level unless drag-and-drop is explicitly disabled on the
    // window; other platforms' webviews don't intercept HTML5 drag events
    // natively, so there's nothing to disable there and the method isn't
    // compiled in.
    #[cfg(windows)]
    let builder = builder.drag_and_drop(false);
    builder.build().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn system_path_exists(p: String) -> bool {
    Path::new(&p).exists()
}

#[tauri::command]
pub fn system_homedir() -> String {
    dirs::home_dir().unwrap_or_default().to_string_lossy().to_string()
}

#[tauri::command]
pub fn system_platform() -> &'static str {
    if cfg!(windows) { "win32" } else if cfg!(target_os = "macos") { "darwin" } else { "linux" }
}

#[tauri::command]
pub fn system_user_data(app: AppHandle) -> String {
    crate::app_data_dir(&app).to_string_lossy().to_string()
}

// Community users embedded in binary — no network request needed.
const COMMUNITY_USERS_JSON: &str = r#"[
  { "github": "ImSkuller", "tag": "Owner",    "locked": true  },
  { "github": "ImForge",   "tag": "Forge",    "locked": true  },
  { "github": "Evasive-6", "tag": "King",     "locked": true  }
]"#;

#[tauri::command]
pub fn system_lookup_community_user(github_username: String) -> Option<Value> {
    if github_username.is_empty() { return None; }
    let lower = github_username.to_lowercase();
    let users: Vec<Value> = serde_json::from_str(COMMUNITY_USERS_JSON).unwrap_or_default();
    users.into_iter().find(|u| u["github"].as_str().map(|s| s.to_lowercase()) == Some(lower.clone()))
}

#[tauri::command]
pub async fn system_validate_github_username(username: String) -> Value {
    if username.is_empty() { return json!({ "valid": false }); }
    let client = reqwest::Client::new();
    match client
        .get(format!("https://api.github.com/users/{}", urlencoding::encode(&username)))
        .header("User-Agent", crate::UA)
        .header("Accept", "application/vnd.github.v3+json")
        .timeout(std::time::Duration::from_secs(8))
        .send().await
    {
        Ok(resp) if resp.status().as_u16() == 200 => {
            let body: Value = resp.json().await.unwrap_or(json!({}));
            json!({ "valid": true, "login": body["login"], "name": body["name"], "avatar": body["avatar_url"] })
        }
        _ => json!({ "valid": false })
    }
}

// ─── Templates list ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn templates_list() -> Vec<Value> {
    vec![
        json!({ "id": "empty",          "name": "Empty",              "desc": "A blank project with no files.",                           "emoji": "📁", "category": "Blank",     "tags": [],                                    "hasInstall": false }),
        json!({ "id": "vanilla-js",     "name": "Vanilla JS",         "desc": "Plain HTML, CSS, and JavaScript. No build tools.",         "emoji": "🌐", "category": "Frontend",  "tags": ["html","css","javascript"],           "hasInstall": false }),
        json!({ "id": "react-vite",     "name": "React + Vite",       "desc": "React 18 with Vite for blazing-fast HMR.",                 "emoji": "⚛️", "category": "Frontend",  "tags": ["react","vite","javascript"],         "hasInstall": true }),
        json!({ "id": "react-ts",       "name": "React + TypeScript", "desc": "React 18 with TypeScript and Vite.",                       "emoji": "⚛️", "category": "Frontend",  "tags": ["react","typescript","vite"],         "hasInstall": true }),
        json!({ "id": "react-tailwind", "name": "React + Tailwind",   "desc": "React + Vite with Tailwind CSS.",                          "emoji": "🎨", "category": "Frontend",  "tags": ["react","vite","tailwind"],           "hasInstall": true }),
        json!({ "id": "vue-vite",       "name": "Vue 3 + Vite",       "desc": "Vue 3 with the Composition API and Vite.",                 "emoji": "💚", "category": "Frontend",  "tags": ["vue","vite","javascript"],           "hasInstall": true }),
        json!({ "id": "svelte-vite",    "name": "Svelte + Vite",      "desc": "Svelte with Vite for fast development.",                   "emoji": "🔥", "category": "Frontend",  "tags": ["svelte","vite","javascript"],        "hasInstall": true }),
        json!({ "id": "astro",          "name": "Astro",              "desc": "Content-driven site builder. Zero JS by default.",         "emoji": "🚀", "category": "Frontend",  "tags": ["astro","static","javascript"],       "hasInstall": true }),
        json!({ "id": "nextjs",         "name": "Next.js",            "desc": "Next.js 14 with App Router (React + TypeScript).",         "emoji": "▲",  "category": "Fullstack", "tags": ["react","nextjs","typescript"],       "hasInstall": true }),
        json!({ "id": "sveltekit",      "name": "SvelteKit",          "desc": "Full-stack framework powered by Svelte.",                  "emoji": "🔥", "category": "Fullstack", "tags": ["svelte","sveltekit","fullstack"],    "hasInstall": true }),
        json!({ "id": "nuxt",           "name": "Nuxt 3",             "desc": "Vue-based fullstack framework.",                           "emoji": "💚", "category": "Fullstack", "tags": ["vue","nuxt","fullstack"],            "hasInstall": true }),
        json!({ "id": "express-api",    "name": "Express API",        "desc": "RESTful API server with Express.js.",                      "emoji": "🖥️", "category": "Backend",   "tags": ["nodejs","express","api"],            "hasInstall": true }),
        json!({ "id": "fastify-api",    "name": "Fastify API",        "desc": "High-performance API server with Fastify.",                "emoji": "⚡", "category": "Backend",   "tags": ["nodejs","fastify","api"],            "hasInstall": true }),
        json!({ "id": "hono-api",       "name": "Hono API",           "desc": "Ultra-fast web framework for edge and Node.js.",          "emoji": "🔥", "category": "Backend",   "tags": ["nodejs","hono","api","edge"],        "hasInstall": true }),
        json!({ "id": "python-flask",   "name": "Python Flask",       "desc": "Lightweight Python web framework.",                        "emoji": "🐍", "category": "Backend",   "tags": ["python","flask","api"],              "hasInstall": false }),
        json!({ "id": "python-fastapi", "name": "Python FastAPI",     "desc": "Modern async Python API with auto-generated docs.",        "emoji": "🐍", "category": "Backend",   "tags": ["python","fastapi","async","api"],    "hasInstall": false }),
        json!({ "id": "node-cli",       "name": "Node.js CLI",        "desc": "Command-line tool with Commander.js and Chalk.",           "emoji": "⌨️", "category": "CLI",       "tags": ["nodejs","cli","commander"],          "hasInstall": true }),
        json!({ "id": "electron-react", "name": "Electron + React",   "desc": "Desktop app with Electron and React + Vite.",             "emoji": "🖥️", "category": "Desktop",   "tags": ["electron","react","desktop","vite"], "hasInstall": true }),
        json!({ "id": "go-http",        "name": "Go HTTP Server",     "desc": "HTTP server in Go using the standard library.",            "emoji": "🐹", "category": "Other",     "tags": ["go","golang","http"],                "hasInstall": false }),
        json!({ "id": "rust-cli",       "name": "Rust CLI",           "desc": "Command-line tool in Rust with Cargo.",                   "emoji": "🦀", "category": "Other",     "tags": ["rust","cli","cargo"],                "hasInstall": false }),
        json!({ "id": "monorepo",       "name": "Turborepo",          "desc": "Monorepo with Turborepo, apps/web (Next.js) and packages/ui.", "emoji": "🏗️", "category": "Other", "tags": ["monorepo","turborepo","nextjs"],     "hasInstall": true }),
        json!({ "id": "mc-paper",      "name": "Paper Plugin",       "desc": "Minecraft Paper/Spigot server plugin with Maven.",             "emoji": "📜", "category": "Minecraft", "tags": ["java","minecraft","paper","spigot","maven"],  "hasInstall": true }),
        json!({ "id": "mc-fabric",     "name": "Fabric Mod",         "desc": "Minecraft Fabric mod with Gradle and Java.",                  "emoji": "🧵", "category": "Minecraft", "tags": ["java","minecraft","fabric","gradle","mod"],   "hasInstall": true }),
        json!({ "id": "mc-forge",      "name": "Forge Mod",          "desc": "Minecraft NeoForge mod with Gradle and Java.",                "emoji": "⚒️", "category": "Minecraft", "tags": ["java","minecraft","forge","neoforge","gradle"],"hasInstall": true }),
        json!({ "id": "mc-velocity",   "name": "Velocity Plugin",    "desc": "Velocity proxy plugin with Maven (Java).",                    "emoji": "🚄", "category": "Minecraft", "tags": ["java","minecraft","velocity","proxy","maven"], "hasInstall": true }),
        json!({ "id": "mc-bungeecord", "name": "BungeeCord Plugin",  "desc": "BungeeCord proxy plugin with Maven (Java).",                  "emoji": "🌐", "category": "Minecraft", "tags": ["java","minecraft","bungeecord","waterfall","maven"], "hasInstall": true }),
    ]
}

#[tauri::command]
pub fn app_restart(app: AppHandle) {
    // Relaunch the current binary then exit cleanly
    if let Ok(exe) = std::env::current_exe() {
        std::process::Command::new(exe).spawn().ok();
    }
    app.exit(0);
}

#[tauri::command]
pub fn premium_validate_key(_key: String) -> Value {
    // Stub — premium validation backend not yet implemented
    json!({ "valid": false, "message": "Premium validation coming soon" })
}

#[tauri::command]
pub fn notify_send(app: AppHandle, title: String, body: String) -> Result<(), String> {
    app.emit("notify:toast", json!({ "title": title, "body": body, "type": "info" }))
        .map_err(|e| e.to_string())
}

// ─── Desktop (OS-level) notifications ──────────────────────────────────────────
// Separate from notify_send above, which only emits an in-app toast. These
// commands talk to the real OS notification center (Windows Action Center /
// macOS Notification Center / Linux notify-daemon) via tauri-plugin-notification.
// Not wired up to any automatic trigger yet — infrastructure only, for future
// features (schedule/deadline reminders, run-finished alerts, etc.) to call into.

#[tauri::command]
pub fn notify_desktop_permission_granted(app: AppHandle) -> bool {
    app.notification().permission_state().map(|s| s == tauri_plugin_notification::PermissionState::Granted).unwrap_or(false)
}

#[tauri::command]
pub fn notify_request_desktop_permission(app: AppHandle) -> Result<bool, String> {
    app.notification().request_permission().map(|s| s == tauri_plugin_notification::PermissionState::Granted).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn notify_send_desktop(app: AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| e.to_string())
}

// Reject project IDs that contain path-traversal characters.
// Valid IDs are UUIDs (hex digits + hyphens) or short alphanumeric slugs.
pub fn validate_safe_id(id: &str) -> Result<(), String> {
    if !id.is_empty()
        && id.len() <= 128
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
    {
        Ok(())
    } else {
        Err(format!("Invalid project ID"))
    }
}

#[tauri::command]
pub fn app_exit(app: AppHandle) {
    app.exit(0);
}

// Directories a write/delete must never land in even though this command
// has no single fixed root (its only real caller, Ideas.jsx's scribble
// export, lets the user save anywhere via a native save dialog — an
// OS-level trust boundary JS can't forge, but one that also can't be
// verified from inside a Tauri command). This is a denylist of concrete
// system paths, not a substitute for CSP/DOMPurify keeping untrusted
// content from ever reaching this command in the first place.
pub(crate) fn sensitive_system_dirs() -> Vec<std::path::PathBuf> {
    let mut dirs = Vec::new();
    #[cfg(windows)]
    {
        if let Ok(windir) = std::env::var("WINDIR") {
            dirs.push(std::path::PathBuf::from(windir));
        }
        for var in ["ProgramFiles", "ProgramFiles(x86)", "ProgramData"] {
            if let Ok(p) = std::env::var(var) {
                dirs.push(std::path::PathBuf::from(p));
            }
        }
    }
    #[cfg(not(windows))]
    {
        for p in ["/etc", "/usr", "/bin", "/sbin", "/boot", "/System", "/Library", "/private", "/var"] {
            dirs.push(std::path::PathBuf::from(p));
        }
    }
    dirs
}

// Extensions that can achieve code execution on their own (double-click,
// shell association, or being dropped in a startup/autorun location).
// Blocked outside the app's own trusted roots — a canvas-export PNG never
// needs one of these, and nothing else calls this command today.
const DANGEROUS_EXTENSIONS: &[&str] = &[
    "exe", "dll", "bat", "cmd", "com", "scr", "msi", "ps1", "vbs", "vbe",
    "js", "jse", "wsf", "wsh", "app", "sh", "command",
];

// Guards recursive-delete callers (projects_remove_local_files today)
// against a corrupted/malicious `paths.projectRoot` turning "remove this
// project's local files" into "wipe a drive" — a shallow or well-known
// directory almost certainly isn't a real project folder.
pub(crate) fn assert_safe_delete_root(path: &Path) -> Result<(), String> {
    let canon = path.canonicalize().map_err(|e| e.to_string())?;
    if canon.parent().is_none() {
        return Err("Refusing to delete a filesystem root".into());
    }
    if let Some(home) = dirs::home_dir() {
        if let Ok(canon_home) = home.canonicalize() {
            if canon == canon_home {
                return Err("Refusing to delete the home directory".into());
            }
        }
    }
    for sensitive in sensitive_system_dirs() {
        if let Ok(canon_sensitive) = sensitive.canonicalize() {
            if canon == canon_sensitive || canon_sensitive.starts_with(&canon) {
                return Err("Refusing to delete a system directory".into());
            }
        }
    }
    Ok(())
}

fn assert_write_target_safe(app: &AppHandle, path: &Path) -> Result<(), String> {
    let path_str = path.to_string_lossy();
    #[cfg(windows)]
    if path_str.starts_with(r"\\") {
        return Err("Network (UNC) paths are not allowed".into());
    }
    if !path.is_absolute() {
        return Err("Path must be absolute".into());
    }

    let parent = path.parent().ok_or("Refusing to write to a filesystem root")?;
    let canon_parent = parent.canonicalize().map_err(|_| "Target directory does not exist".to_string())?;
    if canon_parent.parent().is_none() {
        return Err("Refusing to write directly into a filesystem root".into());
    }
    for sensitive in sensitive_system_dirs() {
        if let Ok(canon_sensitive) = sensitive.canonicalize() {
            if canon_parent.starts_with(&canon_sensitive) {
                return Err("Refusing to write into a system directory".into());
            }
        }
    }

    let settings = crate::read_settings(app);
    let trusted_roots = [
        Some(crate::app_data_dir(app)),
        settings["paths"]["publicProjects"].as_str().map(std::path::PathBuf::from),
        settings["paths"]["hiddenProjects"].as_str().map(std::path::PathBuf::from),
        settings["app"]["obsidian"]["vaultPath"].as_str().filter(|s| !s.is_empty()).map(std::path::PathBuf::from),
    ];
    let under_trusted_root = trusted_roots.iter().flatten().any(|r| {
        r.canonicalize().map(|cr| canon_parent.starts_with(cr)).unwrap_or(false)
    });

    if !under_trusted_root {
        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            if DANGEROUS_EXTENSIONS.contains(&ext.to_lowercase().as_str()) {
                return Err(format!("Refusing to write a .{} file outside Croco's own data directories", ext));
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn system_write_bytes(app: AppHandle, path: String, data: Vec<u8>) -> Result<(), String> {
    let target = Path::new(&path);
    assert_write_target_safe(&app, target)?;
    std::fs::write(target, data).map_err(|e| e.to_string())
}
