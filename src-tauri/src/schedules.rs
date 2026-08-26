// Schedules & deadlines — distinct from todos.rs's todos: a schedule is a
// dated commitment (an expiry/due date *and* time, a longer description,
// and zero or more attached notes) rather than a simple checklist item.
// Same storage-backend/caching pattern as notes_todos.rs (JSON files under
// schedules_dir(), or SQLite via db.rs) — every mutation here MUST call
// invalidate_schedules_cache() or reads go stale.

use once_cell::sync::Lazy;
use serde_json::{json, Value};
use std::fs;
use std::sync::Mutex;
use tauri::AppHandle;

static SCHEDULES_CACHE: Lazy<Mutex<Option<Vec<Value>>>> = Lazy::new(|| Mutex::new(None));

pub fn invalidate_schedules_cache() { *SCHEDULES_CACHE.lock().unwrap() = None; }

pub fn ensure_schedules_dir(app: &AppHandle) { fs::create_dir_all(crate::schedules_dir(app)).ok(); }

// Read all schedules (raw) — served from the in-memory cache when warm.
pub fn read_all_schedules_raw(app: &AppHandle) -> Vec<Value> {
    {
        let c = SCHEDULES_CACHE.lock().unwrap();
        if let Some(ref s) = *c { return s.clone(); }
    }
    let out: Vec<Value> = if crate::is_sqlite_enabled(app) && crate::open_db(app).is_ok() {
        crate::db_get_all("schedules")
    } else {
        ensure_schedules_dir(app);
        let dir = crate::schedules_dir(app);
        match fs::read_dir(&dir) {
            Ok(rd) => rd.flatten().filter_map(|e| {
                let path = e.path();
                if path.extension().and_then(|e| e.to_str()) != Some("json") { return None; }
                let s = fs::read_to_string(&path).ok()?;
                serde_json::from_str::<Value>(&s).ok()
            }).collect(),
            Err(_) => vec![],
        }
    };
    *SCHEDULES_CACHE.lock().unwrap() = Some(out.clone());
    out
}

fn due_at(s: &Value) -> String {
    let date = s["dueDate"].as_str().unwrap_or("");
    let time = s["dueTime"].as_str().filter(|t| !t.is_empty()).unwrap_or("00:00");
    if date.is_empty() { String::new() } else { format!("{}T{}", date, time) }
}

#[tauri::command]
pub fn schedules_get_all(app: AppHandle, project_id: Option<String>) -> Vec<Value> {
    let raw: Vec<Value> = read_all_schedules_raw(&app);
    let mut schedules: Vec<Value> = raw.into_iter().filter(|s| {
        if let Some(ref pid) = project_id {
            s["projectId"].as_str() == Some(pid.as_str())
        } else { true }
    }).collect();
    // Soonest due date first; schedules without a due date sort last.
    schedules.sort_by(|a, b| {
        let da = due_at(a);
        let db = due_at(b);
        match (da.is_empty(), db.is_empty()) {
            (true, true) => std::cmp::Ordering::Equal,
            (true, false) => std::cmp::Ordering::Greater,
            (false, true) => std::cmp::Ordering::Less,
            (false, false) => da.cmp(&db),
        }
    });
    schedules
}

#[tauri::command]
pub fn schedules_get_by_id(app: AppHandle, id: String) -> Option<Value> {
    crate::validate_safe_id(&id).ok()?;
    read_all_schedules_raw(&app).into_iter().find(|s| s["id"].as_str() == Some(id.as_str()))
}

#[tauri::command]
pub fn schedules_create(app: AppHandle, data: Value) -> Result<Value, String> {
    let title = data["title"].as_str().ok_or("Title is required")?.trim().to_string();
    if title.is_empty() { return Err("Title is required".into()); }
    let id  = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let schedule = json!({
        "id":          id,
        "title":       title,
        "description": data["description"].as_str().unwrap_or(""),
        "priority":    data["priority"].as_str().unwrap_or("med"),
        "projectId":   data["projectId"],
        "noteIds":     data["noteIds"].as_array().cloned().unwrap_or_default(),
        "dueDate":     data["dueDate"],
        "dueTime":     data["dueTime"],
        "completed":   false,
        "completedAt": Value::Null,
        "createdAt":   now,
        "updatedAt":   now,
    });
    if crate::is_sqlite_enabled(&app) && crate::open_db(&app).is_ok() {
        crate::db_upsert("schedules", &id, &schedule)?;
    } else {
        ensure_schedules_dir(&app);
        fs::write(crate::schedules_dir(&app).join(format!("{}.json", id)), serde_json::to_string_pretty(&schedule).unwrap())
            .map_err(|e| e.to_string())?;
    }
    invalidate_schedules_cache();
    let project_id = data["projectId"].as_str().unwrap_or("").to_string();
    crate::activity_log(&app, "schedule.created", json!({ "projectId": project_id, "title": title }));
    Ok(schedule)
}

fn get_schedule(app: &AppHandle, id: &str) -> Result<Value, String> {
    if crate::is_sqlite_enabled(app) && crate::open_db(app).is_ok() {
        return crate::db_get_by_id("schedules", id).ok_or(format!("Schedule {} not found", id));
    }
    ensure_schedules_dir(app);
    let path = crate::schedules_dir(app).join(format!("{}.json", id));
    if !path.exists() { return Err(format!("Schedule {} not found", id)); }
    let s = fs::read_to_string(&path).map_err(|_| "Read error".to_string())?;
    serde_json::from_str::<Value>(&s).map_err(|_| "Parse error".to_string())
}

fn save_schedule(app: &AppHandle, id: &str, schedule: &Value) -> Result<(), String> {
    if crate::is_sqlite_enabled(app) && crate::open_db(app).is_ok() {
        crate::db_upsert("schedules", id, schedule)?;
    } else {
        let path = crate::schedules_dir(app).join(format!("{}.json", id));
        fs::write(&path, serde_json::to_string_pretty(schedule).unwrap()).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn schedules_update(app: AppHandle, id: String, changes: Value) -> Result<Value, String> {
    crate::validate_safe_id(&id)?;
    let schedule = get_schedule(&app, &id)?;
    let title_changed = changes.get("title").is_some();
    let mut updated = crate::deep_merge(schedule, changes);
    if let Value::Object(ref mut m) = updated {
        m.insert("updatedAt".into(), json!(chrono::Utc::now().to_rfc3339()));
    }
    save_schedule(&app, &id, &updated)?;
    invalidate_schedules_cache();
    if title_changed {
        let title      = updated["title"].as_str().unwrap_or("").to_string();
        let project_id = updated["projectId"].as_str().unwrap_or("").to_string();
        crate::activity_log(&app, "schedule.edited", json!({ "projectId": project_id, "title": title }));
    }
    Ok(updated)
}

#[tauri::command]
pub fn schedules_toggle(app: AppHandle, id: String) -> Result<Value, String> {
    crate::validate_safe_id(&id)?;
    let mut schedule = get_schedule(&app, &id)?;
    let completed = !schedule["completed"].as_bool().unwrap_or(false);
    if let Value::Object(ref mut m) = schedule {
        m.insert("completed".into(), json!(completed));
        m.insert("completedAt".into(), json!(if completed { Some(chrono::Utc::now().to_rfc3339()) } else { None }));
        m.insert("updatedAt".into(), json!(chrono::Utc::now().to_rfc3339()));
    }
    save_schedule(&app, &id, &schedule)?;
    invalidate_schedules_cache();
    let title      = schedule["title"].as_str().unwrap_or("").to_string();
    let project_id = schedule["projectId"].as_str().unwrap_or("").to_string();
    let event = if completed { "schedule.completed" } else { "schedule.reverted" };
    crate::activity_log(&app, event, json!({ "projectId": project_id, "title": title }));
    Ok(schedule)
}

#[tauri::command]
pub fn schedules_delete(app: AppHandle, id: String) -> Result<Value, String> {
    crate::validate_safe_id(&id)?;
    if crate::is_sqlite_enabled(&app) && crate::open_db(&app).is_ok() {
        let s = crate::db_get_by_id("schedules", &id).unwrap_or(json!({}));
        let title      = s["title"].as_str().unwrap_or("").to_string();
        let project_id = s["projectId"].as_str().unwrap_or("").to_string();
        crate::db_delete("schedules", &id)?;
        crate::activity_log(&app, "schedule.deleted", json!({ "projectId": project_id, "title": title }));
    } else {
        ensure_schedules_dir(&app);
        let path = crate::schedules_dir(&app).join(format!("{}.json", id));
        if path.exists() {
            let s = fs::read_to_string(&path).ok()
                .and_then(|s| serde_json::from_str::<Value>(&s).ok())
                .unwrap_or(json!({}));
            let title      = s["title"].as_str().unwrap_or("").to_string();
            let project_id = s["projectId"].as_str().unwrap_or("").to_string();
            fs::remove_file(&path).ok();
            crate::activity_log(&app, "schedule.deleted", json!({ "projectId": project_id, "title": title }));
        }
    }
    invalidate_schedules_cache();
    Ok(json!({ "ok": true }))
}
