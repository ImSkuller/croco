// Activity feed — a capped, timestamped log of ~30 event types fired
// throughout the app (git.committed, note.created, setting.github, ...).
// Respects the configured storage backend (SQLite table vs activity.json),
// capped at 500 entries either way. personality.rs seeds its own
// long-lived habit aggregate from this log on first run, since this log
// itself is too short-lived for that purpose — see personality.rs's module
// doc comment.

use serde_json::{json, Value};
use std::fs;
use tauri::AppHandle;

pub fn activity_log(app: &AppHandle, event_type: &str, data: Value) {
    let id = uuid::Uuid::new_v4().to_string();
    let mut entry = json!({ "id": id, "type": event_type, "timestamp": chrono::Utc::now().to_rfc3339() });
    if let (Value::Object(ref mut em), Value::Object(dm)) = (&mut entry, data) {
        em.extend(dm);
    }
    if crate::open_db(app).is_ok() {
        crate::db_activity_insert(&entry).ok();
        return;
    }
    let path = crate::activity_file(app);
    let mut entries: Vec<Value> = fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();
    entries.insert(0, entry);
    if entries.len() > 500 { entries.truncate(500); }
    if let Some(parent) = path.parent() { fs::create_dir_all(parent).ok(); }
    fs::write(&path, serde_json::to_string_pretty(&entries).unwrap()).ok();
}

#[tauri::command]
pub fn activity_get_all(app: AppHandle, limit: Option<u32>) -> Vec<Value> {
    let limit = limit.unwrap_or(100) as usize;
    if crate::open_db(&app).is_ok() {
        return crate::db_activity_get_all(limit);
    }
    let path = crate::activity_file(&app);
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str::<Vec<Value>>(&s).ok())
        .map(|v| v.into_iter().take(limit).collect())
        .unwrap_or_default()
}

#[tauri::command]
pub fn activity_clear(app: AppHandle) -> bool {
    if crate::open_db(&app).is_ok() {
        return crate::db_activity_clear();
    }
    fs::write(crate::activity_file(&app), "[]").is_ok()
}
