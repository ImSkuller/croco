// Settings storage: a single JSON file (settings.json in app_data_dir),
// always read through a deep-merge onto default_settings() so new nested
// keys added in later versions show up for upgrading installs without a
// migration step. See ARCHITECTURE.md's storage-backends section for the
// storage-backend split (settings.json itself is always plain JSON,
// independent of settings.app.storageBackend which only affects
// projects/notes/todos).

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde_json::{json, Value};
use std::fs;
use std::path::Path;
use tauri::AppHandle;

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
            "style": "default",
            "accentColor": "#E8E4DC",
            "fontBody": "Geist",
            "fontDisplay": "Lora"
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
            "obsidian": { "enabled": false, "vaultPath": "", "lastSyncAt": null }
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
        },
        "premium": { "key": "", "active": false }
    })
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
    merged
}

pub fn write_settings(app: &AppHandle, v: &Value) -> Result<(), String> {
    let mut v = v.clone();
    strip_secrets(&mut v);
    let path = crate::settings_path(app);
    fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    fs::write(&path, serde_json::to_string_pretty(&v).unwrap()).map_err(|e| e.to_string())
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
    let mut s = read_settings(&app);
    let keys: Vec<&str> = key.split('.').collect();
    set_nested(&mut s, &keys, value);
    write_settings(&app, &s)?;
    Ok(s)
}

#[tauri::command]
pub fn settings_update(app: AppHandle, changes: Value) -> Result<Value, String> {
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

#[tauri::command]
pub fn settings_save_avatar(app: AppHandle, file_path: String) -> Result<String, String> {
    let data = fs::read(&file_path).map_err(|e| e.to_string())?;
    let ext = Path::new(&file_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();
    let mime = if ext == "jpg" || ext == "jpeg" { "image/jpeg" } else { "image/png" };
    let b64 = format!("data:{};base64,{}", mime, B64.encode(&data));
    let mut s = read_settings(&app);
    if let Value::Object(ref mut m) = s {
        if let Some(Value::Object(ref mut u)) = m.get_mut("user") {
            u.insert("avatar".to_string(), Value::String(b64.clone()));
        }
    }
    write_settings(&app, &s)?;
    Ok(b64)
}
