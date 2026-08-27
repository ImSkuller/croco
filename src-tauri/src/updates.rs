// App self-update via tauri-plugin-updater: the plugin fetches the static
// `latest.json` manifest published alongside each GitHub Release, verifies
// its Ed25519 (minisign) signature against the public key embedded in
// tauri.conf.json, and only then downloads/installs the matching platform
// artifact — also signature-checked. We never parse GitHub's release JSON
// or run an installer ourselves; this module is a thin wrapper so the
// Settings UI can show a custom "vX available" banner instead of the
// plugin's default (headless) flow.
//
// Also home to the GitHub OAuth device flow used by Settings -> GitHub
// "Login with GitHub" (separate from the personal-access-token field, which
// stays the primary path since it works without an OAuth App being
// configured).

use once_cell::sync::Lazy;
use semver::Version;
use serde_json::{json, Value};
use std::sync::Mutex;
use tauri::AppHandle;
use tauri_plugin_updater::{Update, UpdaterExt};

fn parse_version(v: &str) -> Option<Version> {
    let v = v.trim().trim_start_matches('v');
    if let Ok(parsed) = Version::parse(v) {
        return Some(parsed);
    }
    // Tolerate short/odd forms (e.g. "1.14", or a 4th build component) by
    // keeping only the leading numeric-dot run and padding missing
    // minor/patch components with zero, rather than refusing to compare.
    let numeric: String = v
        .chars()
        .take_while(|c| c.is_ascii_digit() || *c == '.')
        .collect();
    let mut parts: Vec<&str> = numeric.split('.').filter(|p| !p.is_empty()).collect();
    if parts.is_empty() {
        return None;
    }
    while parts.len() < 3 {
        parts.push("0");
    }
    Version::parse(&parts[..3].join(".")).ok()
}

/// True if `a` is a strictly newer released version than `b`. Malformed
/// input on either side fails closed (returns false) rather than guessing —
/// unlike the old naive `.split('.')` parser, a prerelease tag like
/// "1.14.0-beta" compares correctly against "1.14.0" instead of both
/// silently truncating to the same (major, minor, patch) triple.
pub fn semver_gt(a: &str, b: &str) -> bool {
    match (parse_version(a), parse_version(b)) {
        (Some(va), Some(vb)) => va > vb,
        _ => false,
    }
}

// Set your GitHub OAuth App client_id here (optional — enables "Login with GitHub")
const GITHUB_OAUTH_CLIENT_ID: &str = "Ov23lipwixVRwrFFbWNN";

// GitHub token as stored by Settings -> User, read from the OS keyring (see
// secrets.rs). settings.json itself never holds this value — a startup
// migration (secrets::migrate_secrets_to_keyring) moves it out of any
// pre-1.14 settings.json the first time this version runs.
pub fn stored_github_token(app: &AppHandle) -> Option<String> {
    crate::get_secret(app, "github_token")
}

// Holds the last `Update` returned by a successful check, so `updates_install`
// can install exactly what the user was shown without re-downloading a URL
// the frontend passed in (the old, unverified `download_and_install_update(url)`
// design let the caller point the installer at anything).
static PENDING_UPDATE: Lazy<Mutex<Option<Update>>> = Lazy::new(|| Mutex::new(None));

#[tauri::command]
pub async fn updates_check(app: AppHandle) -> Result<Value, String> {
    let current = env!("CARGO_PKG_VERSION").to_string();
    let updater = app.updater().map_err(|e| e.to_string())?;
    let found = updater.check().await.map_err(|e| e.to_string())?;

    let result = match &found {
        Some(update) => {
            let has_update = semver_gt(&update.version, &update.current_version);
            json!({
                "current":   update.current_version,
                "latest":    update.version,
                "hasUpdate": has_update,
                "body":      update.body,
            })
        }
        None => json!({ "current": current, "latest": current, "hasUpdate": false }),
    };

    *PENDING_UPDATE.lock().unwrap() = found;

    Ok(result)
}

#[tauri::command]
pub async fn updates_install(app: AppHandle) -> Result<(), String> {
    let update = PENDING_UPDATE.lock().unwrap().take();
    let Some(update) = update else {
        return Err("No update was found — run a check first.".into());
    };

    update
        .download_and_install(|_chunk, _total| {}, || {})
        .await
        .map_err(|e| e.to_string())?;

    app.restart();
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

#[cfg(test)]
mod tests {
    use super::semver_gt;

    #[test]
    fn equal_versions_are_not_greater() {
        assert!(!semver_gt("1.14.0", "1.14.0"));
    }

    #[test]
    fn patch_bump_is_greater() {
        assert!(semver_gt("1.14.1", "1.14.0"));
        assert!(!semver_gt("1.14.0", "1.14.1"));
    }

    #[test]
    fn minor_bump_is_greater() {
        assert!(semver_gt("1.15.0", "1.14.9"));
    }

    #[test]
    fn major_bump_is_greater() {
        assert!(semver_gt("2.0.0", "1.99.99"));
    }

    #[test]
    fn release_is_greater_than_its_own_prerelease() {
        // The bug this replaces: naive `.split('.')` parsing dropped the
        // "-beta" suffix's non-numeric patch component to 0, so "1.14.0-beta"
        // and "1.14.0" compared equal instead of the release being newer.
        assert!(semver_gt("1.14.0", "1.14.0-beta"));
        assert!(!semver_gt("1.14.0-beta", "1.14.0"));
    }

    #[test]
    fn prerelease_ordering_is_respected() {
        assert!(semver_gt("1.14.0-beta.2", "1.14.0-beta.1"));
    }

    #[test]
    fn v_prefixed_tags_are_handled() {
        assert!(semver_gt("v1.14.1", "v1.14.0"));
        assert!(semver_gt("v1.14.1", "1.14.0"));
    }

    #[test]
    fn malformed_tags_fail_closed() {
        assert!(!semver_gt("not-a-version", "1.14.0"));
        assert!(!semver_gt("1.14.0", "not-a-version"));
        assert!(!semver_gt("garbage", "also-garbage"));
    }

    #[test]
    fn short_version_forms_are_padded() {
        assert!(semver_gt("1.15", "1.14.9"));
    }
}
