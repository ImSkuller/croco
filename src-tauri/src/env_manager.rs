// Env Manager module (v2.0, beta) — see docs/modules-plan.md. A masked
// editor for a project's own `.env` file. The file itself is the only
// store — same philosophy as the IDE module treating project files as
// source of truth — so this is exactly as secure as that file already was
// on disk; nothing is copied into the keyring.
//
// Saving rewrites the file as plain KEY=VALUE lines and does not preserve
// comments or blank-line formatting from the original file — a deliberate
// simplification for a beta feature. Reading is non-destructive; only an
// explicit save touches the file.

use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

fn env_path(app: &AppHandle, project_id: &str) -> Result<PathBuf, String> {
    crate::validate_safe_id(project_id)?;
    let project = crate::get_project(app, project_id).ok_or("Project not found")?;
    Ok(PathBuf::from(crate::project_root_str(&project)).join(".env"))
}

fn parse_env(content: &str) -> Vec<Value> {
    content.lines().filter_map(|line| {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') { return None; }
        let (key, value) = trimmed.split_once('=')?;
        Some(json!({ "key": key.trim(), "value": value.trim() }))
    }).collect()
}

#[tauri::command]
pub fn env_read(app: AppHandle, project_id: String) -> Result<Vec<Value>, String> {
    let path = env_path(&app, &project_id)?;
    if !path.exists() { return Ok(vec![]); }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(parse_env(&content))
}

#[tauri::command]
pub fn env_write(app: AppHandle, project_id: String, entries: Vec<Value>) -> Result<(), String> {
    let path = env_path(&app, &project_id)?;
    let body = entries.iter()
        .filter_map(|e| Some(format!("{}={}", e["key"].as_str()?.trim(), e["value"].as_str().unwrap_or(""))))
        .collect::<Vec<_>>()
        .join("\n");
    fs::write(&path, format!("{body}\n")).map_err(|e| e.to_string())?;
    crate::activity_log(&app, "env.saved", json!({ "projectId": project_id }));
    Ok(())
}
