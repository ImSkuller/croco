// Settings storage: a single JSON file (settings.json in app_data_dir),
// always read through a deep-merge onto default_settings() so new nested
// keys added in later versions show up for upgrading installs without a
// migration step. See ARCHITECTURE.md's storage-backends section for the
// storage-backend split (settings.json itself is always plain JSON,
// independent of settings.app.storageBackend which only affects
// projects/notes/todos).

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use once_cell::sync::Lazy;
use serde_json::{json, Value};
use std::fs;
use std::path::Path;
use std::sync::{Mutex, PoisonError};
use tauri::AppHandle;

// settings_set/settings_update/settings_reset/settings_save_avatar each do a
// full read-modify-write of settings.json. Without a lock, two overlapping
// calls (e.g. two rapid frontend actions) can both read the same old value
// and the second write silently clobbers the first's change. This mutex
// serializes the whole read+merge+write sequence, not just the write.
static SETTINGS_WRITE_LOCK: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));

pub fn default_settings() -> Value {
    let home = dirs::home_dir().unwrap_or_default();
    json!({
        "user": {
            "name": "",
            "avatar": null,
            "tag": "Developer",
            "github": { "username": "", "tokenStored": false }
        },
        "paths": {
            "publicProjects": home.join("projects").to_string_lossy(),
            "hiddenProjects":  home.join(".private").to_string_lossy()
        },
        "defaults": {
            "ide": "vscode",
            "gitBranch": "main",
            "visibility": "public",
            "shell": ""
        },
        "appearance": {
            "theme": "default",
            // 'minimal' (Phase 4.4) is the default for brand-new installs
            // only — an existing settings.json already has a concrete
            // value here (even "default" is a real, previously-written
            // choice), and deep_merge always lets the file win, so this
            // line never silently switches an existing user's Style.
            // They instead see a one-time prompt (Dashboard.jsx) gated on
            // minimalStylePromptShown below.
            "style": "minimal",
            "accentColor": "#E8E4DC",
            "fontBody": "Geist",
            "fontDisplay": "Lora",
            // Deliberately false for everyone, including new installs —
            // the prompt itself (Dashboard.jsx) only shows when
            // appearance.style !== 'minimal', which is already false for
            // a new install (they start on 'minimal' above), so this flag
            // alone never needs to distinguish "new" from "existing
            // upgrading": new installs simply never hit the style-check
            // half of the condition.
            "minimalStylePromptShown": false
        },
        "todos": {
            "priorities": [
                { "id": "high", "label": "High",   "color": "#ff4444" },
                { "id": "med",  "label": "Medium",  "color": "#ffd700" },
                { "id": "low",  "label": "Low",     "color": "#4aff91" }
            ]
        },
        "api": { "enabled": false, "port": 3131 },
        "app": {
            "version": env!("CARGO_PKG_VERSION"),
            "onboarded": false,
            "closeBehavior": "tray",
            "dataPath": "",
            "storageBackend": "json",
            "obsidian": { "enabled": false, "vaultPath": "", "lastSyncAt": null },
            // Stable, non-secret per-install identifier for entitlements.rs
            // — safe to keep in plain settings.json, unlike anything in
            // secrets.rs. Generated lazily on first use, not here.
            "deviceId": ""
        },
        "ai": {
            "tool": "", "keys": { "anthropic": "", "openai": "", "gemini": "" }, "ollamaModel": "llama3.2",
            "mode": "cli", "provider": "anthropic", "activeModeId": "chat",
            "autoConfigAttempted": false,
            "direct": {
                "models": {
                    "anthropic": "claude-sonnet-4-5-20250929",
                    "openai": "gpt-4.1",
                    "gemini": "gemini-2.0-flash",
                    "ollama": "llama3.2"
                },
                "ollamaBaseUrl": "http://localhost:11434"
            }
        }
    })
}

/// One-time migration off the old client-side-only premium stub
/// (`premium.key`/`premium.active` — trivially bypassable by editing
/// settings.json by hand, replaced in Phase 3 by server-verified
/// entitlements; see entitlements.rs). Idempotent — a no-op once the
/// field is gone. Doesn't touch any other part of the file, unlike
/// write_settings' defensive strip_secrets, since `premium` was never a
/// secret, just dead client-side gating state.
pub fn migrate_away_premium_stub(app: &AppHandle) {
    let path = crate::settings_path(app);
    let Ok(raw) = fs::read_to_string(&path) else { return };
    let Ok(mut v) = serde_json::from_str::<Value>(&raw) else { return };
    let Some(obj) = v.as_object_mut() else { return };
    if obj.remove("premium").is_none() {
        return; // already migrated (or a fresh install that never had it)
    }
    if let Ok(pretty) = serde_json::to_string_pretty(&v) {
        let _ = fs::write(&path, pretty);
    }
}

pub fn deep_merge(base: Value, patch: Value) -> Value {
    match (base, patch) {
        (Value::Object(mut bm), Value::Object(pm)) => {
            for (k, v) in pm {
                let e = bm.entry(k).or_insert(Value::Null);
                *e = deep_merge(e.clone(), v);
            }
            Value::Object(bm)
        }
        (_, p) => p,
    }
}

// Secret fields that must never survive a read (returned to the frontend)
// or a write (persisted to settings.json) in plaintext. Actual values live
// in the OS keyring / secrets.rs fallback — see settings_set_github_token
// and secrets::migrate_secrets_to_keyring for how they get there.
fn strip_secrets(v: &mut Value) {
    if let Some(github) = v.get_mut("user").and_then(|u| u.get_mut("github")).and_then(|g| g.as_object_mut()) {
        github.remove("token");
    }
    if let Some(obj) = v.as_object_mut() {
        obj.remove("githubToken");
    }
    if let Some(keys) = v.get_mut("ai").and_then(|a| a.get_mut("keys")).and_then(|k| k.as_object_mut()) {
        for k in ["anthropic", "openai", "gemini"] {
            keys.insert(k.into(), Value::String(String::new()));
        }
    }
}

pub fn read_settings(app: &AppHandle) -> Value {
    let path = crate::settings_path(app);
    let mut merged = if path.exists() {
        match fs::read_to_string(&path).ok().and_then(|s| serde_json::from_str::<Value>(&s).ok()) {
            // Deep-merge onto defaults so new nested keys (added in later
            // versions) are present for installs upgrading from an older
            // settings.json, without needing a migration step.
            Some(v) => deep_merge(default_settings(), v),
            None => default_settings(),
        }
    } else {
        default_settings()
    };

    strip_secrets(&mut merged);
    if let Some(github) = merged.get_mut("user").and_then(|u| u.get_mut("github")).and_then(|g| g.as_object_mut()) {
        github.insert("tokenStored".into(), Value::Bool(crate::get_secret(app, "github_token").is_some()));
    }
    if let Some(app_obj) = merged.get_mut("app").and_then(|a| a.as_object_mut()) {
        app_obj.insert("secretsFallbackActive".into(), Value::Bool(crate::fallback_in_use()));
    }
    // user.avatar on disk is just a marker ("png"/"jpg" — see the Avatar
    // storage section below); rebuild the data URI here so callers see the
    // same shape they always have, without that image ever round-tripping
    // through every other read_settings() call.
    if let Some(marker) = merged.get("user").and_then(|u| u.get("avatar")).and_then(|a| a.as_str()) {
        if AVATAR_EXTS.contains(&marker) {
            let data_uri = fs::read(avatar_file_path(app, marker))
                .ok()
                .map(|bytes| format!("data:{};base64,{}", avatar_mime(marker), B64.encode(bytes)));
            if let Some(user) = merged.get_mut("user").and_then(|u| u.as_object_mut()) {
                match data_uri {
                    Some(uri) => { user.insert("avatar".into(), Value::String(uri)); }
                    None => { user.insert("avatar".into(), Value::Null); }
                }
            }
        }
    }
    merged
}

// Writes to a temp file in the same directory then renames it over the real
// path — a crash/power-loss mid-write leaves either the old file intact or
// the new one fully written, never a half-written settings.json. Same-
// filesystem rename is atomic on both Windows (MoveFileExW with
// MOVEFILE_REPLACE_EXISTING, which is what std::fs::rename uses) and Unix.
// Pulled out of write_settings() (which additionally strips secrets and
// resolves the AppHandle-specific path) so the atomic-write mechanics can be
// stress-tested directly against a plain path, without a Tauri AppHandle.
fn write_json_atomic(path: &std::path::Path, v: &Value) -> Result<(), String> {
    let parent = path.parent().ok_or("Invalid settings path")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let pretty = serde_json::to_string_pretty(v).map_err(|e| e.to_string())?;
    let tmp_path = parent.join("settings.json.tmp");
    fs::write(&tmp_path, pretty).map_err(|e| e.to_string())?;
    fs::rename(&tmp_path, path).map_err(|e| e.to_string())
}

// read_settings() returns user.avatar as a full reconstructed data URI (see
// its avatar-injection step) so every caller sees the shape it always has —
// but that means a write built from a read_settings() base (settings_set,
// settings_update merging in unrelated changes, etc.) would otherwise carry
// that full data URI right back into the value being persisted, undoing the
// whole point of storing it as a file. Collapse it back to the on-disk
// marker before every write.
fn sanitize_avatar_field(v: &mut Value) {
    let marker = v.get("user").and_then(|u| u.get("avatar")).and_then(|a| a.as_str()).and_then(|s| {
        if s.starts_with("data:image/png") { Some("png") }
        else if s.starts_with("data:image/jpeg") { Some("jpg") }
        else { None }
    });
    if let Some(marker) = marker {
        if let Some(obj) = v.get_mut("user").and_then(|u| u.as_object_mut()) {
            obj.insert("avatar".into(), Value::String(marker.to_string()));
        }
    }
}

pub fn write_settings(app: &AppHandle, v: &Value) -> Result<(), String> {
    let mut v = v.clone();
    strip_secrets(&mut v);
    let was_cleared = v.get("user").and_then(|u| u.get("avatar")).map(|a| a.is_null()).unwrap_or(false);
    sanitize_avatar_field(&mut v);
    if was_cleared {
        delete_stored_avatar(app);
    }
    write_json_atomic(&crate::settings_path(app), &v)
}

pub fn set_nested(obj: &mut Value, keys: &[&str], val: Value) {
    if keys.is_empty() { return; }
    if keys.len() == 1 {
        if let Value::Object(m) = obj { m.insert(keys[0].to_string(), val); }
    } else if let Value::Object(m) = obj {
        let e = m.entry(keys[0]).or_insert(json!({}));
        set_nested(e, &keys[1..], val);
    }
}

// ─── Settings commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub fn settings_get(app: AppHandle) -> Value { read_settings(&app) }

#[tauri::command]
pub fn settings_set(app: AppHandle, key: String, value: Value) -> Result<Value, String> {
    let _guard = SETTINGS_WRITE_LOCK.lock().unwrap_or_else(PoisonError::into_inner);
    let mut s = read_settings(&app);
    let keys: Vec<&str> = key.split('.').collect();
    set_nested(&mut s, &keys, value);
    write_settings(&app, &s)?;
    Ok(s)
}

#[tauri::command]
pub fn settings_update(app: AppHandle, changes: Value) -> Result<Value, String> {
    let _guard = SETTINGS_WRITE_LOCK.lock().unwrap_or_else(PoisonError::into_inner);
    let merged = deep_merge(read_settings(&app), changes.clone());
    write_settings(&app, &merged)?;
    // Log only meaningful changes — skip appearance (theme, font, accent, etc.)
    if changes.get("appearance").is_none() {
        if let Some(user) = changes.get("user") {
            if user.get("github").is_some() {
                crate::activity_log(&app, "setting.github", json!({}));
            } else if user.get("name").is_some() || user.get("tag").is_some() || user.get("avatar").is_some() {
                crate::activity_log(&app, "setting.profile", json!({}));
            }
        }
    }
    Ok(merged)
}

#[tauri::command]
pub fn settings_reset(app: AppHandle) -> Result<Value, String> {
    let _guard = SETTINGS_WRITE_LOCK.lock().unwrap_or_else(PoisonError::into_inner);
    let d = default_settings();
    write_settings(&app, &d)?;
    Ok(d)
}

// Stores the GitHub token in the OS keyring (never in settings.json — see
// strip_secrets above). Passing an empty string clears it.
#[tauri::command]
pub fn settings_set_github_token(app: AppHandle, token: String) -> Result<(), String> {
    crate::set_secret(&app, "github_token", &token)?;
    crate::activity_log(&app, "setting.github", json!({}));
    Ok(())
}

#[tauri::command]
pub async fn settings_test_github(token: String) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.github.com/user")
        .header("Authorization", format!("token {}", token))
        .header("User-Agent", crate::UA)
        .header("Accept", "application/vnd.github.v3+json")
        .timeout(std::time::Duration::from_secs(8))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = resp.status().as_u16();
    let body: Value = resp.json().await.unwrap_or(json!({}));

    if status == 200 {
        Ok(json!({ "ok": true, "login": body["login"], "name": body["name"], "avatarUrl": body["avatar_url"] }))
    } else if status == 401 {
        Ok(json!({ "ok": false, "message": "Invalid token — check your Personal Access Token" }))
    } else {
        Ok(json!({ "ok": false, "message": format!("GitHub returned status {}", status) }))
    }
}

// ─── Avatar storage ─────────────────────────────────────────────────────────
//
// The avatar image lives as a real file in the app data dir, not embedded
// as a base64 data URI inside settings.json. read_settings() is called on
// nearly every command (including from inside projects_data_dir), so an
// embedded image meant every single one of those calls parsed the whole
// image out of the JSON file whether or not the caller needed it. Only
// `user.avatar`'s *marker* ("png"/"jpg" — which extension is on disk) lives
// in settings.json; read_settings() reads the actual file and rebuilds the
// data URI only when producing a value to return, never writing it back.

const AVATAR_EXTS: [&str; 2] = ["png", "jpg"];

fn avatar_mime(ext: &str) -> &'static str {
    if ext == "jpg" || ext == "jpeg" { "image/jpeg" } else { "image/png" }
}

fn avatar_file_path(app: &AppHandle, ext: &str) -> std::path::PathBuf {
    crate::app_data_dir(app).join(format!("avatar.{}", ext))
}

fn delete_stored_avatar(app: &AppHandle) {
    for ext in AVATAR_EXTS {
        fs::remove_file(avatar_file_path(app, ext)).ok();
    }
}

/// One-time migration for installs that saved an avatar before this file-
/// based storage existed (it was a full base64 data URI directly in
/// settings.json). Extracts it to a file and replaces the field with the
/// same small marker a fresh save would produce. Idempotent — a no-op once
/// `user.avatar` is already a marker (or absent).
pub fn migrate_avatar_out_of_settings(app: &AppHandle) {
    let path = crate::settings_path(app);
    let Ok(raw) = fs::read_to_string(&path) else { return };
    let Ok(mut v) = serde_json::from_str::<Value>(&raw) else { return };
    let Some(avatar) = v.get("user").and_then(|u| u.get("avatar")).and_then(|a| a.as_str()) else { return };
    let Some(b64) = avatar.strip_prefix("data:image/png;base64,").map(|s| (s, "png"))
        .or_else(|| avatar.strip_prefix("data:image/jpeg;base64,").map(|s| (s, "jpg"))) else { return };
    let (b64, ext) = b64;
    let Ok(data) = B64.decode(b64) else { return };
    if fs::write(avatar_file_path(app, ext), data).is_err() { return; }
    if let Some(obj) = v.get_mut("user").and_then(|u| u.as_object_mut()) {
        obj.insert("avatar".into(), Value::String(ext.to_string()));
    }
    if let Ok(pretty) = serde_json::to_string_pretty(&v) {
        let _ = fs::write(&path, pretty);
    }
}

#[tauri::command]
pub fn settings_save_avatar(app: AppHandle, file_path: String) -> Result<String, String> {
    let data = fs::read(&file_path).map_err(|e| e.to_string())?;
    let ext = Path::new(&file_path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .filter(|e| e == "jpg" || e == "jpeg")
        .map(|_| "jpg")
        .unwrap_or("png");
    let mime = avatar_mime(ext);
    let b64 = format!("data:{};base64,{}", mime, B64.encode(&data));

    let _guard = SETTINGS_WRITE_LOCK.lock().unwrap_or_else(PoisonError::into_inner);
    delete_stored_avatar(&app);
    fs::write(avatar_file_path(&app, ext), &data).map_err(|e| e.to_string())?;
    let mut s = read_settings(&app);
    if let Value::Object(ref mut m) = s {
        if let Some(Value::Object(ref mut u)) = m.get_mut("user") {
            u.insert("avatar".to_string(), Value::String(ext.to_string()));
        }
    }
    write_settings(&app, &s)?;
    Ok(b64)
}

#[cfg(test)]
mod tests {
    use super::{deep_merge, sanitize_avatar_field, set_nested, write_json_atomic, SETTINGS_WRITE_LOCK};
    use serde_json::json;
    use std::sync::PoisonError;

    // Phase 5 gate: "a stress test doing 100 rapid settings writes loses
    // none." Mimics settings_set's exact pattern (hold SETTINGS_WRITE_LOCK
    // across a full read-modify-write-via-write_json_atomic cycle) from 100
    // concurrent threads writing to the same file, and asserts every
    // thread's change survived — this is exactly the lost-update race the
    // unlocked read-modify-write used to allow.
    #[test]
    fn concurrent_settings_writes_lose_no_updates() {
        let dir = std::env::temp_dir().join(format!(
            "croco-settings-race-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("settings.json");
        std::fs::write(&path, "{}").unwrap();

        let handles: Vec<_> = (0..100)
            .map(|i| {
                let path = path.clone();
                std::thread::spawn(move || {
                    let _guard = SETTINGS_WRITE_LOCK.lock().unwrap_or_else(PoisonError::into_inner);
                    let raw = std::fs::read_to_string(&path).unwrap();
                    let mut v: serde_json::Value = serde_json::from_str(&raw).unwrap();
                    set_nested(&mut v, &[&format!("key_{}", i)], json!(true));
                    write_json_atomic(&path, &v).unwrap();
                })
            })
            .collect();
        for h in handles { h.join().unwrap(); }

        let raw = std::fs::read_to_string(&path).unwrap();
        let v: serde_json::Value = serde_json::from_str(&raw).unwrap();
        let obj = v.as_object().unwrap();
        for i in 0..100 {
            assert_eq!(obj.get(&format!("key_{}", i)), Some(&json!(true)), "write {} was lost", i);
        }
        assert_eq!(obj.len(), 100);

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn deep_merge_overwrites_scalar_leaves() {
        let base = json!({ "a": 1, "b": 2 });
        let patch = json!({ "b": 3 });
        assert_eq!(deep_merge(base, patch), json!({ "a": 1, "b": 3 }));
    }

    #[test]
    fn deep_merge_recurses_into_nested_objects_instead_of_replacing_them() {
        let base = json!({ "user": { "name": "a", "tag": "Developer" } });
        let patch = json!({ "user": { "name": "b" } });
        // If this replaced the whole "user" object instead of merging into
        // it, "tag" would be lost — exactly the bug a settings-upgrade
        // migration must not have.
        assert_eq!(deep_merge(base, patch), json!({ "user": { "name": "b", "tag": "Developer" } }));
    }

    #[test]
    fn deep_merge_adds_new_keys_from_defaults_not_present_in_the_saved_file() {
        // Simulates an old settings.json (patch) being merged onto a newer
        // default_settings() (base) that added a field the old file never had.
        let base = json!({ "app": { "storageBackend": "json", "newField": true } });
        let patch = json!({ "app": { "storageBackend": "sqlite" } });
        assert_eq!(deep_merge(base, patch), json!({ "app": { "storageBackend": "sqlite", "newField": true } }));
    }

    #[test]
    fn deep_merge_patch_value_wins_when_types_conflict() {
        let base = json!({ "a": { "nested": true } });
        let patch = json!({ "a": "now a string" });
        assert_eq!(deep_merge(base, patch), json!({ "a": "now a string" }));
    }

    #[test]
    fn set_nested_sets_a_top_level_key() {
        let mut v = json!({ "a": 1 });
        set_nested(&mut v, &["a"], json!(2));
        assert_eq!(v, json!({ "a": 2 }));
    }

    #[test]
    fn set_nested_sets_a_deeply_nested_key_creating_intermediate_objects() {
        let mut v = json!({});
        set_nested(&mut v, &["user", "github", "username"], json!("skuller"));
        assert_eq!(v, json!({ "user": { "github": { "username": "skuller" } } }));
    }

    #[test]
    fn set_nested_preserves_sibling_keys() {
        let mut v = json!({ "user": { "name": "a", "tag": "Developer" } });
        set_nested(&mut v, &["user", "name"], json!("b"));
        assert_eq!(v, json!({ "user": { "name": "b", "tag": "Developer" } }));
    }

    #[test]
    fn set_nested_on_empty_keys_is_a_noop() {
        let mut v = json!({ "a": 1 });
        set_nested(&mut v, &[], json!("ignored"));
        assert_eq!(v, json!({ "a": 1 }));
    }

    // Regression test for a real bug caught before it shipped: read_settings()
    // reconstructs user.avatar as a full data: URI so callers see the shape
    // they always have, but that means a value built from read_settings() and
    // then written back (settings_set/settings_update merging in unrelated
    // changes) would otherwise persist that full blob to disk again — exactly
    // the "every read_settings call parses the whole image" problem this was
    // meant to fix, just moved to write time instead. write_settings must
    // collapse it back to the on-disk marker on every write.
    #[test]
    fn sanitize_avatar_field_collapses_a_reconstructed_data_uri_back_to_its_marker() {
        let mut v = json!({ "user": { "avatar": "data:image/png;base64,aGVsbG8=" } });
        sanitize_avatar_field(&mut v);
        assert_eq!(v, json!({ "user": { "avatar": "png" } }));

        let mut v = json!({ "user": { "avatar": "data:image/jpeg;base64,aGVsbG8=" } });
        sanitize_avatar_field(&mut v);
        assert_eq!(v, json!({ "user": { "avatar": "jpg" } }));
    }

    #[test]
    fn sanitize_avatar_field_leaves_a_marker_or_null_untouched() {
        let mut v = json!({ "user": { "avatar": "png" } });
        sanitize_avatar_field(&mut v);
        assert_eq!(v, json!({ "user": { "avatar": "png" } }));

        let mut v = json!({ "user": { "avatar": null } });
        sanitize_avatar_field(&mut v);
        assert_eq!(v, json!({ "user": { "avatar": null } }));
    }
}
