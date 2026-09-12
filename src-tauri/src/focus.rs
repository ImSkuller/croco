// Focus Timer module (v2.0, beta) — see docs/modules-plan.md. A local
// Pomodoro-style work/break timer: zero network calls, no accounts. One
// active session at a time, history kept as a flat JSON file (respects
// settings.app.dataPath the same way notes/todos do — see ai_brain.rs's
// header comment for why that matters).

use serde_json::{json, Value};
use std::fs;
use tauri::{AppHandle, Emitter};

fn sessions_path(app: &AppHandle) -> std::path::PathBuf {
    crate::projects_data_dir(app).join("focus_sessions.json")
}

fn read_sessions(app: &AppHandle) -> Vec<Value> {
    fs::read_to_string(sessions_path(app)).ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_sessions(app: &AppHandle, sessions: &[Value]) {
    if let Some(parent) = sessions_path(app).parent() { let _ = fs::create_dir_all(parent); }
    let _ = fs::write(sessions_path(app), serde_json::to_string_pretty(sessions).unwrap_or_default());
}

/// Starts a session, ending whatever was still active first (a stale
/// "active" session from a crashed/killed app is far more likely than a
/// genuine second concurrent session, so this favors always leaving a
/// clean single-active-session invariant over preserving a possibly-stale
/// one).
#[tauri::command]
pub fn focus_session_start(app: AppHandle, project_id: Option<String>, kind: String) -> Value {
    let mut sessions = read_sessions(&app);
    let now = chrono::Utc::now().to_rfc3339();
    for s in sessions.iter_mut() {
        if s["endedAt"].is_null() {
            if let Value::Object(ref mut m) = s { m.insert("endedAt".into(), json!(now)); }
        }
    }
    // Planned end lives on the session so the backend scheduler (below) can
    // finish it even when the Focus page — or the whole window — isn't open.
    let settings = crate::read_settings(&app);
    let minutes = settings["modules"]["focusTimer"][if kind == "work" { "workMinutes" } else { "breakMinutes" }]
        .as_i64()
        .unwrap_or(if kind == "work" { 25 } else { 5 })
        .max(1);
    let planned_end = (chrono::Utc::now() + chrono::Duration::minutes(minutes)).to_rfc3339();
    let session = json!({
        "id": uuid::Uuid::new_v4().to_string(),
        "projectId": project_id,
        "kind": kind, // "work" | "break"
        "startedAt": now,
        "plannedEndsAt": planned_end,
        "endedAt": null,
    });
    sessions.insert(0, session.clone());
    if sessions.len() > 500 { sessions.truncate(500); }
    write_sessions(&app, &sessions);
    crate::activity_log(&app, "focus.session_started", json!({ "kind": session["kind"], "projectId": session["projectId"] }));
    session
}

#[tauri::command]
pub fn focus_session_end(app: AppHandle, id: String) -> Result<Value, String> {
    crate::validate_safe_id(&id)?;
    let mut sessions = read_sessions(&app);
    let now = chrono::Utc::now().to_rfc3339();
    let mut ended = None;
    for s in sessions.iter_mut() {
        if s["id"].as_str() == Some(id.as_str()) && s["endedAt"].is_null() {
            if let Value::Object(ref mut m) = s { m.insert("endedAt".into(), json!(now)); }
            ended = Some(s.clone());
            break;
        }
    }
    let ended = ended.ok_or("Session not found or already ended")?;
    write_sessions(&app, &sessions);
    if ended["kind"].as_str() == Some("work") {
        crate::activity_log(&app, "focus.session_completed", json!({ "projectId": ended["projectId"] }));
    }
    Ok(ended)
}

/// Ends any active session whose planned end has passed. `notify` is false
/// on the startup catch-up (a session that expired while the app was
/// closed is stale, not news) and true from the running scheduler, where
/// it fires the focusEnded desktop notification and a `focus:ended` event
/// so an open Focus page refreshes. This is what makes the timer survive
/// leaving the page — the countdown UI is display only.
pub fn end_due_focus_sessions(app: &AppHandle, notify: bool) {
    let now = chrono::Utc::now();
    let due: Vec<Value> = read_sessions(app).into_iter()
        .filter(|s| s["endedAt"].is_null())
        .filter(|s| s["plannedEndsAt"].as_str()
            .and_then(|t| chrono::DateTime::parse_from_rfc3339(t).ok())
            .map(|t| t <= now)
            .unwrap_or(false))
        .collect();
    for s in due {
        let Some(id) = s["id"].as_str() else { continue };
        if focus_session_end(app.clone(), id.to_string()).is_err() { continue; }
        let _ = app.emit("focus:ended", &s);
        if notify {
            let work = s["kind"].as_str() == Some("work");
            crate::notify_event(
                app,
                "focusEnded",
                if work { "Focus session complete" } else { "Break over" },
                if work { "Time for a break." } else { "Back to it." },
                false,
            );
        }
    }
}

pub fn start_focus_scheduler(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            end_due_focus_sessions(&app, true);
        }
    });
}

#[tauri::command]
pub fn focus_session_get_active(app: AppHandle) -> Option<Value> {
    read_sessions(&app).into_iter().find(|s| s["endedAt"].is_null())
}

#[tauri::command]
pub fn focus_session_get_history(app: AppHandle, limit: Option<u32>) -> Vec<Value> {
    let limit = limit.unwrap_or(50) as usize;
    read_sessions(&app).into_iter().filter(|s| !s["endedAt"].is_null()).take(limit).collect()
}

/// Total completed work minutes today, plus a session count — enough for a
/// simple daily readout without a separate stats store.
#[tauri::command]
pub fn focus_session_get_today_stats(app: AppHandle) -> Value {
    let today = chrono::Utc::now().date_naive();
    let mut work_minutes = 0i64;
    let mut sessions_completed = 0u32;
    for s in read_sessions(&app) {
        if s["kind"].as_str() != Some("work") { continue; }
        let Some(started) = s["startedAt"].as_str().and_then(|t| chrono::DateTime::parse_from_rfc3339(t).ok()) else { continue };
        if started.date_naive() != today { continue; }
        let Some(ended_str) = s["endedAt"].as_str() else { continue };
        let Ok(ended) = chrono::DateTime::parse_from_rfc3339(ended_str) else { continue };
        work_minutes += (ended - started).num_minutes().max(0);
        sessions_completed += 1;
    }
    json!({ "workMinutes": work_minutes, "sessionsCompleted": sessions_completed })
}
