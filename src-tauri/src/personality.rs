// Work-habits tracking ("personality monitoring" on the product roadmap).
//
// Croco's activity log already timestamps 30+ event types, but both storage
// backends auto-trim it to the latest 500 entries (main.rs) — fine for a
// recent-activity feed, not enough for a long-term habit profile. So this
// module keeps its own small, durably-accumulating aggregate (habits.json)
// that updates incrementally alongside the existing activity_log() calls,
// rather than deriving everything from the capped log on every read.
//
// Scope, deliberately: commits, todos, notes, and per-project attention —
// all backed by solid existing timestamps. Session-length tracking is NOT
// included (no app open/close hooks exist today, and Croco's close-to-tray
// default makes "session end" ambiguous) — a future addition, not an
// oversight. Commit stats are periodically recomputed from `git log` across
// every tracked project's repo (see personality_scan_commits), so commits
// made outside Croco — via terminal, another IDE, etc — count too, not just
// ones made through Croco's own commit UI.
//
// appOpenDates tracks a separate "did you use Croco today" streak (see
// personality_track_app_open, called once per launch from the frontend on
// mount) — deliberately independent of commitDates so a quiet coding day
// spent triaging/planning in Croco still keeps a streak alive.

use chrono::{Datelike, Timelike};
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

fn habits_path(app: &AppHandle) -> PathBuf {
    crate::projects_data_dir(app).join("habits.json")
}

fn default_habits() -> Value {
    let now = chrono::Utc::now().to_rfc3339();
    json!({
        "formatVersion": 1,
        "firstTrackedAt": now,
        "lastUpdatedAt": now,
        "commitsByHour": vec![0; 24],
        "commitsByWeekday": vec![0; 7],
        "commitDates": Vec::<String>::new(),
        "totalCommits": 0,
        "appOpenDates": Vec::<String>::new(),
        "notesCreated": 0,
        "notesByWeekday": vec![0; 7],
        "todosCreated": 0,
        "todosCompleted": 0,
        "projectStats": {},
    })
}

fn read_habits(app: &AppHandle) -> Value {
    fs::read_to_string(habits_path(app))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(default_habits)
}

fn write_habits(app: &AppHandle, v: &Value) -> Result<(), String> {
    let path = habits_path(app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, serde_json::to_string_pretty(v).unwrap()).map_err(|e| e.to_string())
}

fn incr_counter(v: &mut Value, key: &str) {
    let cur = v[key].as_i64().unwrap_or(0);
    v[key] = json!(cur + 1);
}

fn incr_array(v: &mut Value, key: &str, idx: usize) {
    if let Some(arr) = v[key].as_array_mut() {
        if let Some(slot) = arr.get_mut(idx) {
            let cur = slot.as_i64().unwrap_or(0);
            *slot = json!(cur + 1);
        }
    }
}

fn add_unique_date(v: &mut Value, key: &str, day: &str) {
    if let Some(arr) = v[key].as_array_mut() {
        if !arr.iter().any(|d| d.as_str() == Some(day)) {
            arr.push(json!(day));
            arr.sort_by(|a, b| a.as_str().cmp(&b.as_str()));
        }
    }
}

fn add_commit_date(v: &mut Value, day: &str) {
    add_unique_date(v, "commitDates", day);
}

// Auto-vivifies `projectStats.<id>` on first touch (serde_json's IndexMut
// converts a Null entry to an Object on assignment).
fn touch_project_stat(v: &mut Value, project_id: &str, field: &str, at: &str) {
    if project_id.is_empty() {
        return;
    }
    let entry = &mut v["projectStats"][project_id];
    if entry.is_null() {
        *entry = json!({ "opens": 0, "commits": 0, "todos": 0, "lastActivityAt": at });
    }
    let cur = entry[field].as_i64().unwrap_or(0);
    entry[field] = json!(cur + 1);
    entry["lastActivityAt"] = json!(at);
}

/// Fire-and-update entry point, called synchronously right alongside the
/// existing `activity_log(...)` call at each tracked mutation site — these
/// host commands already do comparably small file I/O (writing a note/todo
/// JSON file), so one more small read+write here doesn't change their
/// async-vs-sync characteristics.
pub fn track(app: &AppHandle, metric: &str, data: Value) {
    let mut habits = read_habits(app);
    let now_utc = chrono::Utc::now().to_rfc3339();
    let local = chrono::Local::now();
    let hour = local.hour() as usize;
    let weekday = local.weekday().num_days_from_sunday() as usize; // 0 = Sunday
    let project_id = data["projectId"].as_str().unwrap_or("").to_string();

    match metric {
        "commit" => {
            incr_array(&mut habits, "commitsByHour", hour);
            incr_array(&mut habits, "commitsByWeekday", weekday);
            incr_counter(&mut habits, "totalCommits");
            add_commit_date(&mut habits, &local.format("%Y-%m-%d").to_string());
            touch_project_stat(&mut habits, &project_id, "commits", &now_utc);
        }
        "note_created" => {
            incr_counter(&mut habits, "notesCreated");
            incr_array(&mut habits, "notesByWeekday", weekday);
        }
        "todo_created" => {
            incr_counter(&mut habits, "todosCreated");
            touch_project_stat(&mut habits, &project_id, "todos", &now_utc);
        }
        "todo_completed" => {
            incr_counter(&mut habits, "todosCompleted");
        }
        "project_open" => {
            touch_project_stat(&mut habits, &project_id, "opens", &now_utc);
        }
        _ => return,
    }

    habits["lastUpdatedAt"] = json!(now_utc);
    let _ = write_habits(app, &habits);
}

#[tauri::command]
pub fn personality_get_profile(app: AppHandle) -> Value {
    read_habits(&app)
}

/// Records "the app was opened today" for the login streak — called once
/// from the frontend on app mount. Idempotent per calendar day (dedupes
/// like add_commit_date), so repeat calls in the same session are cheap
/// no-ops after the first.
#[tauri::command]
pub fn personality_track_app_open(app: AppHandle) -> Value {
    let mut habits = read_habits(&app);
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    add_unique_date(&mut habits, "appOpenDates", &today);
    habits["lastUpdatedAt"] = json!(chrono::Utc::now().to_rfc3339());
    let _ = write_habits(&app, &habits);
    habits
}

/// Recomputes commit-derived stats (by-hour, by-weekday, streak dates,
/// per-project commit counts) directly from `git log` across every tracked
/// project's repo, instead of relying only on commits made through Croco's
/// own commit UI. Overwrites those fields wholesale each run — full
/// recompute rather than incremental, so it stays correct no matter how
/// commits were made (Croco, terminal, another IDE). Notes/todos counters
/// are untouched since those have no git-log equivalent.
#[tauri::command]
pub async fn personality_scan_commits(app: AppHandle) -> Result<Value, String> {
    let projects = crate::read_all_projects(&app);

    let mut by_hour: Vec<i64> = vec![0; 24];
    let mut by_weekday: Vec<i64> = vec![0; 7];
    let mut dates: std::collections::BTreeSet<String> = Default::default();
    let mut total: i64 = 0;
    let mut projects_scanned: i64 = 0;
    let mut per_project: std::collections::HashMap<String, (i64, String)> = std::collections::HashMap::new();

    for p in &projects {
        let id = p["id"].as_str().unwrap_or("").to_string();
        let root = crate::project_root_str(p);
        if id.is_empty() || root.is_empty() { continue; }
        if !std::path::Path::new(&root).join(".git").exists() { continue; }
        projects_scanned += 1;

        let Ok(out) = crate::run_git(&["log", "--all", "--date=iso-strict", "--format=%ad"], &root) else { continue };
        let mut proj_total: i64 = 0;
        let mut proj_last = String::new();
        for line in out.lines().map(str::trim).filter(|l| !l.is_empty()) {
            let Ok(parsed) = chrono::DateTime::parse_from_rfc3339(line) else { continue };
            let local = parsed.with_timezone(&chrono::Local);
            by_hour[local.hour() as usize] += 1;
            by_weekday[local.weekday().num_days_from_sunday() as usize] += 1;
            dates.insert(local.format("%Y-%m-%d").to_string());
            total += 1;
            proj_total += 1;
            let iso = parsed.to_rfc3339();
            if iso > proj_last { proj_last = iso; }
        }
        if proj_total > 0 {
            per_project.insert(id, (proj_total, proj_last));
        }
    }

    let mut habits = read_habits(&app);
    habits["commitsByHour"] = json!(by_hour);
    habits["commitsByWeekday"] = json!(by_weekday);
    habits["commitDates"] = json!(dates.into_iter().collect::<Vec<_>>());
    habits["totalCommits"] = json!(total);
    habits["commitsSource"] = json!("git-log-all-projects");
    habits["projectsScanned"] = json!(projects_scanned);
    habits["lastCommitScanAt"] = json!(chrono::Utc::now().to_rfc3339());

    if !habits["projectStats"].is_object() {
        habits["projectStats"] = json!({});
    }
    let stats_map = habits["projectStats"].as_object_mut().unwrap();
    for (id, (count, last_at)) in per_project {
        let entry = stats_map.entry(id).or_insert_with(|| json!({ "opens": 0, "commits": 0, "todos": 0, "lastActivityAt": "" }));
        entry["commits"] = json!(count);
        let existing_last = entry["lastActivityAt"].as_str().unwrap_or("").to_string();
        if last_at > existing_last {
            entry["lastActivityAt"] = json!(last_at);
        }
    }

    habits["lastUpdatedAt"] = json!(chrono::Utc::now().to_rfc3339());
    write_habits(&app, &habits)?;
    Ok(habits)
}

/// One-shot, idempotent: seeds habits.json from whatever's still in the
/// (capped) activity log, so existing users see a meaningful profile
/// immediately instead of a blank slate. No-ops if already seeded.
#[tauri::command]
pub fn personality_backfill_from_activity(app: AppHandle) -> Result<Value, String> {
    let mut habits = read_habits(&app);
    let already_seeded = habits["totalCommits"].as_i64().unwrap_or(0) > 0
        || habits["notesCreated"].as_i64().unwrap_or(0) > 0
        || habits["todosCreated"].as_i64().unwrap_or(0) > 0;
    if already_seeded {
        return Ok(habits);
    }

    let entries = crate::activity_get_all(app.clone(), Some(500));
    for entry in entries.iter().rev() {
        // oldest first, so `lastActivityAt` ends up as the most recent
        let Some(ts) = entry["timestamp"].as_str() else { continue };
        let Ok(parsed) = chrono::DateTime::parse_from_rfc3339(ts) else { continue };
        let local = parsed.with_timezone(&chrono::Local);
        let hour = local.hour() as usize;
        let weekday = local.weekday().num_days_from_sunday() as usize;
        let project_id = entry["projectId"].as_str().unwrap_or("").to_string();

        match entry["type"].as_str().unwrap_or("") {
            "git.committed" => {
                incr_array(&mut habits, "commitsByHour", hour);
                incr_array(&mut habits, "commitsByWeekday", weekday);
                incr_counter(&mut habits, "totalCommits");
                add_commit_date(&mut habits, &local.format("%Y-%m-%d").to_string());
                touch_project_stat(&mut habits, &project_id, "commits", ts);
            }
            "note.created" => {
                incr_counter(&mut habits, "notesCreated");
                incr_array(&mut habits, "notesByWeekday", weekday);
            }
            "todo.created" => {
                incr_counter(&mut habits, "todosCreated");
                touch_project_stat(&mut habits, &project_id, "todos", ts);
            }
            "todo.completed" => {
                incr_counter(&mut habits, "todosCompleted");
            }
            "ide.opened" => {
                touch_project_stat(&mut habits, &project_id, "opens", ts);
            }
            _ => {}
        }
    }

    habits["lastUpdatedAt"] = json!(chrono::Utc::now().to_rfc3339());
    write_habits(&app, &habits)?;
    Ok(habits)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn incr_counter_starts_from_missing_key() {
        let mut v = json!({});
        incr_counter(&mut v, "totalCommits");
        incr_counter(&mut v, "totalCommits");
        assert_eq!(v["totalCommits"], json!(2));
    }

    #[test]
    fn incr_array_bumps_only_the_target_bucket() {
        let mut v = json!({ "commitsByHour": vec![0; 24] });
        incr_array(&mut v, "commitsByHour", 9);
        incr_array(&mut v, "commitsByHour", 9);
        incr_array(&mut v, "commitsByHour", 17);
        assert_eq!(v["commitsByHour"][9], json!(2));
        assert_eq!(v["commitsByHour"][17], json!(1));
        assert_eq!(v["commitsByHour"][0], json!(0));
    }

    #[test]
    fn add_commit_date_dedupes_and_sorts() {
        let mut v = json!({ "commitDates": [] });
        add_commit_date(&mut v, "2026-07-05");
        add_commit_date(&mut v, "2026-07-01");
        add_commit_date(&mut v, "2026-07-05"); // duplicate, should not double-add
        assert_eq!(v["commitDates"], json!(["2026-07-01", "2026-07-05"]));
    }

    #[test]
    fn touch_project_stat_creates_then_increments() {
        let mut v = json!({ "projectStats": {} });
        touch_project_stat(&mut v, "proj-1", "commits", "2026-07-05T10:00:00Z");
        touch_project_stat(&mut v, "proj-1", "commits", "2026-07-05T11:00:00Z");
        touch_project_stat(&mut v, "proj-1", "opens", "2026-07-05T12:00:00Z");
        assert_eq!(v["projectStats"]["proj-1"]["commits"], json!(2));
        assert_eq!(v["projectStats"]["proj-1"]["opens"], json!(1));
        assert_eq!(v["projectStats"]["proj-1"]["lastActivityAt"], json!("2026-07-05T12:00:00Z"));
    }

    #[test]
    fn touch_project_stat_ignores_empty_project_id() {
        let mut v = json!({ "projectStats": {} });
        touch_project_stat(&mut v, "", "commits", "2026-07-05T10:00:00Z");
        assert_eq!(v["projectStats"], json!({}));
    }
}
