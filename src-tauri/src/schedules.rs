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
use std::time::Duration;
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
    // Editing the due date/time means any reminder already sent was for the
    // old deadline — clear it so the new one can still fire.
    let due_changed = changes.get("dueDate").is_some() || changes.get("dueTime").is_some();
    let mut updated = crate::deep_merge(schedule, changes);
    if let Value::Object(ref mut m) = updated {
        m.insert("updatedAt".into(), json!(chrono::Utc::now().to_rfc3339()));
        if due_changed {
            m.insert("reminderSentAt".into(), Value::Null);
        }
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

// ─── Desktop notifications for deadlines (Phase 6 item 5) ──────────────────────
//
// notify_send_desktop (system.rs) already existed as infrastructure but
// nothing called it automatically — this wires it to schedules actually
// becoming due. Each schedule gets a one-time reminder when its deadline
// arrives, tracked via a new `reminderSentAt` field (cleared by
// schedules_update above whenever the due date/time itself changes).
//
// Deliberately bounded to a 24-hour lookback window: without it, shipping
// this feature would fire a notification for every already-overdue
// schedule an existing install has accumulated the first time it checks —
// a notification storm, not a helpful reminder. The tradeoff is that a
// deadline which passed more than 24h while the app was closed goes
// unremarked; better than spamming everyone who has old schedules lying
// around, given no lead-time/snooze system was asked for here.

fn parse_due_local(due_date: &str, due_time: &str) -> Option<chrono::NaiveDateTime> {
    if due_date.is_empty() {
        return None;
    }
    let time = if due_time.is_empty() { "00:00" } else { due_time };
    chrono::NaiveDateTime::parse_from_str(&format!("{due_date}T{time}:00"), "%Y-%m-%dT%H:%M:%S").ok()
}

/// Pure decision, clock-injected for testability: should this schedule get
/// a reminder right now? `now_local` is the caller's already-resolved local
/// wall-clock time (real local timezone handling stays outside this
/// function, which only compares two already-parsed values).
pub fn is_deadline_due_for_reminder(
    due_date: &str,
    due_time: &str,
    already_reminded: bool,
    completed: bool,
    now_local: chrono::NaiveDateTime,
) -> bool {
    if completed || already_reminded {
        return false;
    }
    let Some(due) = parse_due_local(due_date, due_time) else { return false };
    now_local >= due && now_local - due <= chrono::Duration::hours(24)
}

/// Checked once at startup and periodically while the app stays open (see
/// start_deadline_reminder_scheduler) — sends a desktop notification for
/// every schedule whose deadline just arrived, then records that it did so.
pub fn check_and_send_deadline_reminders(app: &AppHandle) {
    let settings = crate::read_settings(app);
    if settings["app"]["deadlineReminders"]["enabled"].as_bool() != Some(true) {
        return;
    }
    if !crate::notify_desktop_permission_granted(app.clone()) {
        return;
    }

    let now_local = chrono::Local::now().naive_local();
    let due: Vec<Value> = read_all_schedules_raw(app)
        .into_iter()
        .filter(|s| {
            is_deadline_due_for_reminder(
                s["dueDate"].as_str().unwrap_or(""),
                s["dueTime"].as_str().unwrap_or(""),
                s["reminderSentAt"].as_str().is_some(),
                s["completed"].as_bool().unwrap_or(false),
                now_local,
            )
        })
        .collect();

    for schedule in due {
        let Some(id) = schedule["id"].as_str().map(|s| s.to_string()) else { continue };
        let title = schedule["title"].as_str().unwrap_or("Untitled").to_string();
        if crate::notify_send_desktop(app.clone(), "Deadline reached".into(), title).is_err() {
            continue; // don't mark as reminded if the OS notification actually failed
        }
        let mut updated = schedule;
        if let Value::Object(ref mut m) = updated {
            m.insert("reminderSentAt".into(), json!(chrono::Utc::now().to_rfc3339()));
        }
        let _ = save_schedule(app, &id, &updated);
    }
    invalidate_schedules_cache();
}

/// Spawns a background loop that re-checks every minute for the rest of the
/// process lifetime — deadlines are time-sensitive enough that an hourly
/// check (as used for the backup scheduler) would be too coarse.
pub fn start_deadline_reminder_scheduler(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(60)).await;
            check_and_send_deadline_reminders(&app);
        }
    });
}

#[cfg(test)]
mod reminder_tests {
    use super::is_deadline_due_for_reminder;
    use chrono::NaiveDateTime;

    fn dt(s: &str) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S").unwrap()
    }

    #[test]
    fn not_due_yet_is_not_reminded() {
        assert!(!is_deadline_due_for_reminder("2026-02-02", "09:00", false, false, dt("2026-02-01T09:00:00")));
    }

    #[test]
    fn exactly_at_due_time_is_reminded() {
        assert!(is_deadline_due_for_reminder("2026-02-01", "09:00", false, false, dt("2026-02-01T09:00:00")));
    }

    #[test]
    fn shortly_after_due_time_is_reminded() {
        assert!(is_deadline_due_for_reminder("2026-02-01", "09:00", false, false, dt("2026-02-01T10:00:00")));
    }

    #[test]
    fn already_reminded_is_not_reminded_again() {
        assert!(!is_deadline_due_for_reminder("2026-02-01", "09:00", true, false, dt("2026-02-01T10:00:00")));
    }

    #[test]
    fn completed_is_never_reminded() {
        assert!(!is_deadline_due_for_reminder("2026-02-01", "09:00", false, true, dt("2026-02-01T10:00:00")));
    }

    #[test]
    fn no_due_date_is_never_reminded() {
        assert!(!is_deadline_due_for_reminder("", "", false, false, dt("2026-02-01T10:00:00")));
    }

    #[test]
    fn missing_due_time_defaults_to_midnight() {
        assert!(is_deadline_due_for_reminder("2026-02-01", "", false, false, dt("2026-02-01T00:00:00")));
    }

    #[test]
    fn far_overdue_backlog_is_not_retroactively_spammed() {
        // 3 days overdue — outside the 24h lookback window.
        assert!(!is_deadline_due_for_reminder("2026-01-29", "09:00", false, false, dt("2026-02-01T09:00:01")));
    }

    #[test]
    fn just_inside_the_24h_window_is_still_reminded() {
        assert!(is_deadline_due_for_reminder("2026-01-31", "09:00", false, false, dt("2026-02-01T08:59:59")));
    }
}
