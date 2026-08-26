// App self-update: checks ImSkuller/croco (the main repo's own GitHub
// Releases, now that the project is open-source and no longer needs a
// separate private releases repo) for a newer release, downloads and
// silently runs the installer, then relaunches. Also the
// GitHub OAuth device flow used by Settings -> GitHub "Login with GitHub"
// (separate from the personal-access-token field, which stays the primary
// path since it works without an OAuth App being configured).

use serde_json::{json, Value};
use std::fs;
use std::process::Command;
use tauri::AppHandle;

fn semver_gt(a: &str, b: &str) -> bool {
    let parse = |s: &str| -> (u64, u64, u64) {
        let parts: Vec<&str> = s.split('.').collect();
        let n = |i: usize| parts.get(i).and_then(|p| p.parse().ok()).unwrap_or(0);
        (n(0), n(1), n(2))
    };
    parse(a) > parse(b)
}

// Set your GitHub OAuth App client_id here (optional — enables "Login with GitHub")
const GITHUB_OAUTH_CLIENT_ID: &str = "Ov23lipwixVRwrFFbWNN";

// GitHub token as stored by Settings -> User (user.github.token),
// with a fallback to the legacy top-level key.
pub fn stored_github_token(app: &AppHandle) -> Option<String> {
    let v = crate::read_settings(app);
    v["user"]["github"]["token"].as_str()
        .filter(|t| !t.is_empty())
        .or_else(|| v["githubToken"].as_str().filter(|t| !t.is_empty()))
        .map(|t| t.to_string())
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<Value, String> {
    let current = env!("CARGO_PKG_VERSION");
    let token = stored_github_token(&app);

    let client  = reqwest::Client::new();
    let mut req = client
        .get("https://api.github.com/repos/ImSkuller/croco/releases/latest")
        .header("User-Agent", crate::UA)
        .header("Accept", "application/vnd.github.v3+json")
        .timeout(std::time::Duration::from_secs(8));
    if let Some(ref t) = token {
        req = req.header("Authorization", format!("token {}", t));
    }
    let resp = req.send().await.map_err(|e| e.to_string())?;

    let status = resp.status().as_u16();
    if status == 404 || status == 401 || status == 403 {
        return Ok(json!({ "current": current, "latest": current, "hasUpdate": false }));
    }
    let body: Value = resp.json().await.unwrap_or(json!({}));
    let tag = body["tag_name"].as_str().unwrap_or("").trim_start_matches('v');
    let has_update = !tag.is_empty() && semver_gt(tag, current);

    // Find platform-specific asset download URL. macOS CI builds two .dmg
    // files (aarch64 + x64, one per Apple Silicon/Intel) — matching on
    // extension alone would pick whichever one the GitHub API happens to
    // list first, which isn't guaranteed to be this machine's architecture,
    // so an Apple Silicon Mac could get offered the Intel build or vice
    // versa. Match on arch too for macOS (Windows/Linux only ever produce
    // one asset of their extension today, so extension alone is enough there).
    let matches_asset = |name: &str| -> bool {
        if cfg!(target_os = "windows") {
            name.ends_with(".exe")
        } else if cfg!(target_os = "macos") {
            let arch = if cfg!(target_arch = "aarch64") { "aarch64" } else { "x64" };
            name.ends_with(".dmg") && name.contains(arch)
        } else {
            name.ends_with(".AppImage")
        }
    };
    let asset_url = body["assets"].as_array().and_then(|assets| {
        assets.iter().find(|a| {
            a["name"].as_str().map(matches_asset).unwrap_or(false)
        }).and_then(|a| a["browser_download_url"].as_str())
    }).unwrap_or(body["html_url"].as_str().unwrap_or(""));

    Ok(json!({
        "current":     current,
        "latest":      tag,
        "hasUpdate":   has_update,
        "downloadUrl": body["html_url"],
        "assetUrl":    asset_url,
        "body":        body["body"]
    }))
}

// ─── GitHub OAuth Device Flow ──────────────────────────────────────────────────

#[tauri::command]
pub fn github_oauth_configured() -> bool {
    !GITHUB_OAUTH_CLIENT_ID.is_empty()
}

#[tauri::command]
pub async fn github_oauth_start() -> Result<Value, String> {
    if GITHUB_OAUTH_CLIENT_ID.is_empty() {
        return Err("GitHub OAuth App not configured. Set GITHUB_OAUTH_CLIENT_ID in main.rs.".into());
    }
    let client = reqwest::Client::new();
    let resp = client
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .header("User-Agent", crate::UA)
        .form(&[("client_id", GITHUB_OAUTH_CLIENT_ID), ("scope", "repo read:user")])
        .timeout(std::time::Duration::from_secs(10))
        .send().await.map_err(|e| e.to_string())?;
    let body: Value = resp.json().await.map_err(|e| e.to_string())?;
    if body["device_code"].is_null() {
        return Err(body["error_description"].as_str().unwrap_or("Failed to start device flow").to_string());
    }
    Ok(body)
}

#[tauri::command]
pub async fn github_oauth_poll(device_code: String) -> Result<Value, String> {
    if GITHUB_OAUTH_CLIENT_ID.is_empty() {
        return Err("GitHub OAuth App not configured.".into());
    }
    let client = reqwest::Client::new();
    let resp = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .header("User-Agent", crate::UA)
        .form(&[
            ("client_id",   GITHUB_OAUTH_CLIENT_ID),
            ("device_code", device_code.as_str()),
            ("grant_type",  "urn:ietf:params:oauth:grant-type:device_code"),
        ])
        .timeout(std::time::Duration::from_secs(10))
        .send().await.map_err(|e| e.to_string())?;
    let body: Value = resp.json().await.map_err(|e| e.to_string())?;

    if let Some(token) = body["access_token"].as_str() {
        // User info fetch is non-fatal — a failure here must not propagate as Err
        // because JS catches Err as a rejection and silently keeps polling forever.
        let user: Value = match client
            .get("https://api.github.com/user")
            .header("Authorization", format!("token {}", token))
            .header("User-Agent", crate::UA)
            .header("Accept", "application/vnd.github.v3+json")
            .timeout(std::time::Duration::from_secs(8))
            .send().await
        {
            Ok(r)  => r.json().await.unwrap_or(json!({})),
            Err(_) => json!({}),
        };
        return Ok(json!({
            "status": "success",
            "token":  token,
            "login":  user["login"],
            "name":   user["name"],
            "avatar": user["avatar_url"],
        }));
    }
    Ok(json!({ "status": body["error"].as_str().unwrap_or("authorization_pending") }))
}

// ─── Download and install update ──────────────────────────────────────────────

#[tauri::command]
pub async fn download_and_install_update(app: AppHandle, url: String) -> Result<(), String> {
    // Read GitHub token for private-repo download auth
    let token = stored_github_token(&app);

    let client = reqwest::Client::new();
    let mut req = client.get(&url)
        .header("User-Agent", crate::UA)
        .timeout(std::time::Duration::from_secs(300));
    if let Some(ref t) = token {
        req = req.header("Authorization", format!("token {}", t));
    }
    let resp = req.send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Download failed: HTTP {}", resp.status()));
    }
    let fname = url.rsplit('/').next().unwrap_or("update-installer.exe");
    let tmp = std::env::temp_dir().join(fname);
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    fs::write(&tmp, &bytes).map_err(|e| e.to_string())?;
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let installer_path = tmp.to_string_lossy().into_owned();
        let exe_path = std::env::current_exe()
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_default();

        // Batch: wait for current app to exit, run installer silently, relaunch updated exe
        let bat_content = format!(
            "@echo off\r\nping 127.0.0.1 -n 4 >nul\r\nstart /wait \"\" \"{}\" /S /NCRC\r\ntimeout /t 2 /nobreak >nul\r\nstart \"\" \"{}\"\r\ndel \"%~f0\"\r\n",
            installer_path,
            exe_path
        );
        let bat_path = std::env::temp_dir().join("croco_relaunch.bat");

        if fs::write(&bat_path, bat_content.as_bytes()).is_ok() {
            Command::new("cmd")
                .raw_arg(&format!("/c \"{}\"", bat_path.to_string_lossy()))
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
                .map_err(|e| e.to_string())?;
        } else {
            // Fallback: silent install without auto-relaunch
            Command::new("cmd")
                .raw_arg(&format!(
                    "/c start \"\" \"{}\" /S /NCRC",
                    installer_path.replace('"', "\\\"")
                ))
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        std::thread::sleep(std::time::Duration::from_millis(500));
        app.exit(0);
    }
    #[cfg(target_os = "macos")]
    {
        // Unlike Windows/NSIS, macOS apps conventionally aren't silently
        // replaced in place — the standard (and Gatekeeper-friendly)
        // convention is mounting the DMG and letting the user drag the
        // .app to Applications, same as a first install. Automating the
        // copy would need to assume an install location (fragile: sandboxed
        // vs. user-moved installs differ) and isn't verifiable from this
        // Windows dev machine, so this stays a safe, explicit hand-off
        // rather than an unverified silent-replace attempt.
        Command::new("open").arg(&tmp).spawn().map_err(|e| e.to_string())?;
        crate::emit_toast(&app, "Update downloaded", "Drag Croco to Applications to finish updating", "info");
    }
    #[cfg(target_os = "linux")]
    {
        // AppImages are conventionally self-updating: the AppImage runtime
        // sets $APPIMAGE to the path of the running file, so replace it in
        // place and relaunch — mirrors the Windows silent-update UX. Falls
        // back to just opening the file for non-AppImage installs (.deb/.rpm).
        use std::os::unix::fs::PermissionsExt;
        if let Ok(appimage_path) = std::env::var("APPIMAGE") {
            let mut perms = fs::metadata(&tmp).map_err(|e| e.to_string())?.permissions();
            perms.set_mode(0o755);
            fs::set_permissions(&tmp, perms).map_err(|e| e.to_string())?;
            // Copy (not rename) since the temp dir and the AppImage's real
            // location may be on different filesystems, where rename fails.
            fs::copy(&tmp, &appimage_path).map_err(|e| e.to_string())?;
            fs::remove_file(&tmp).ok();
            Command::new(&appimage_path).spawn().map_err(|e| e.to_string())?;
            app.exit(0);
        } else {
            Command::new("xdg-open").arg(&tmp).spawn().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
