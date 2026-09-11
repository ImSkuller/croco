// Scheduled automatic backups (Phase 6 item 4). Reuses data_export_all's
// bundle format (formatVersion 2 — see data_transfer.rs) but writes it to a
// rotating set of files in the app data dir on a schedule, rather than
// requiring the user to manually pick a destination every time. The manual
// "Export Backup" flow (data_export_all) is untouched and still exists
// separately for a user-chosen destination/one-off export.

#![deny(clippy::unwrap_used)]

use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use std::time::Duration;
use tauri::AppHandle;

fn backups_dir(app: &AppHandle) -> PathBuf {
    crate::app_data_dir(app).join("backups")
}

/// Same bundle shape as data_export_all — kept as a shared builder so the
/// two paths (manual export, scheduled backup) can't silently drift apart.
pub fn build_backup_bundle(app: &AppHandle) -> Value {
    json!({
        "app":           "croco",
        "formatVersion": 2,
        "appVersion":    env!("CARGO_PKG_VERSION"),
        "exportedAt":    chrono::Utc::now().to_rfc3339(),
        "settings":      crate::read_settings(app),
        "projects":      crate::read_all_projects(app),
        "notes":         crate::read_all_notes_raw(app),
        "todos":         crate::read_all_todos_raw(app),
        "schedules":     crate::read_all_schedules_raw(app),
    })
}

fn write_backup_now(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = backups_dir(app);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let bundle = build_backup_bundle(app);
    let pretty = serde_json::to_string_pretty(&bundle).map_err(|e| e.to_string())?;
    // Filename embeds a sortable UTC timestamp so rotation (oldest-first
    // pruning) needs nothing fancier than a lexicographic sort of names.
    let stamp = chrono::Utc::now().format("%Y%m%dT%H%M%SZ");
    let path = dir.join(format!("croco-backup-{stamp}.json"));
    fs::write(&path, pretty).map_err(|e| e.to_string())?;
    Ok(path)
}

fn prune_old_backups(app: &AppHandle, keep: usize) {
    let dir = backups_dir(app);
    let Ok(rd) = fs::read_dir(&dir) else { return };
    let mut files: Vec<_> = rd
        .flatten()
        .filter(|e| e.path().extension().and_then(|e| e.to_str()) == Some("json"))
        .collect();
    files.sort_by_key(|e| e.file_name());
    let keep = keep.max(1);
    if files.len() > keep {
        for e in &files[..files.len() - keep] {
            fs::remove_file(e.path()).ok();
        }
    }
}

/// Pure decision extracted for testability (real time is hard to fake):
/// is a backup due, given when the last one ran and the configured
/// interval? `now`/`last_backup_at` are both explicit so no wall-clock
/// dependency leaks into the test.
pub fn is_backup_due(last_backup_at: Option<&str>, now: chrono::DateTime<chrono::Utc>, interval_days: i64) -> bool {
    let Some(last) = last_backup_at else { return true };
    match chrono::DateTime::parse_from_rfc3339(last) {
        Ok(last) => now.signed_duration_since(last.to_utc()) >= chrono::Duration::days(interval_days.max(1)),
        Err(_) => true,
    }
}

fn record_backup_ran(app: &AppHandle) {
    let mut s = crate::read_settings(app);
    crate::set_nested(&mut s, &["app", "autoBackup", "lastBackupAt"], json!(chrono::Utc::now().to_rfc3339()));
    // Same as the startup migrate_*/purge_* functions: an infrequent,
    // low-contention write outside the interactive SETTINGS_WRITE_LOCK
    // path is an accepted, existing pattern in this codebase rather than
    // new plumbing for a once-a-day-at-most write.
    let _ = crate::write_settings(app, &s);
}

/// Checked once at startup and periodically while the app stays open
/// (see start_backup_scheduler below) — runs a backup if enabled and due,
/// then prunes to the configured retention count and records when it ran.
pub fn maybe_run_scheduled_backup(app: &AppHandle) {
    let settings = crate::read_settings(app);
    let cfg = &settings["app"]["autoBackup"];
    if cfg["enabled"].as_bool() != Some(true) {
        return;
    }
    let interval_days = cfg["intervalDays"].as_i64().unwrap_or(1);
    let retention = cfg["retentionCount"].as_u64().unwrap_or(7) as usize;
    if !is_backup_due(cfg["lastBackupAt"].as_str(), chrono::Utc::now(), interval_days) {
        return;
    }
    if write_backup_now(app).is_ok() {
        prune_old_backups(app, retention);
        record_backup_ran(app);
        crate::activity_log(app, "backup.auto", json!({}));
    }
}

/// Spawns a background loop that re-checks every hour for the rest of the
/// process lifetime, so a session left open across a day boundary still
/// gets backed up without needing a relaunch. The startup call in
/// setup_app() covers the common case (app launched at least once a day);
/// this covers the "left running for a long stretch" case.
pub fn start_backup_scheduler(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(60 * 60)).await;
            maybe_run_scheduled_backup(&app);
        }
    });
}

#[tauri::command]
pub fn backup_run_now(app: AppHandle) -> Result<Value, String> {
    let path = write_backup_now(&app)?;
    let settings = crate::read_settings(&app);
    let retention = settings["app"]["autoBackup"]["retentionCount"].as_u64().unwrap_or(7) as usize;
    prune_old_backups(&app, retention);
    record_backup_ran(&app);
    crate::activity_log(&app, "backup.manual", json!({}));
    Ok(json!({ "ok": true, "path": path.to_string_lossy() }))
}

#[cfg(test)]
mod tests {
    use super::is_backup_due;

    #[test]
    fn no_prior_backup_is_always_due() {
        assert!(is_backup_due(None, chrono::Utc::now(), 1));
    }

    #[test]
    fn unparseable_timestamp_is_treated_as_due() {
        assert!(is_backup_due(Some("not-a-date"), chrono::Utc::now(), 1));
    }

    #[test]
    fn within_the_interval_is_not_due() {
        let now = chrono::DateTime::parse_from_rfc3339("2026-02-02T00:00:00Z").unwrap().to_utc();
        assert!(!is_backup_due(Some("2026-02-01T12:00:00Z"), now, 1));
    }

    #[test]
    fn past_the_interval_is_due() {
        let now = chrono::DateTime::parse_from_rfc3339("2026-02-03T00:00:00Z").unwrap().to_utc();
        assert!(is_backup_due(Some("2026-02-01T00:00:00Z"), now, 1));
    }

    #[test]
    fn exactly_at_the_interval_boundary_is_due() {
        let now = chrono::DateTime::parse_from_rfc3339("2026-02-02T00:00:00Z").unwrap().to_utc();
        assert!(is_backup_due(Some("2026-02-01T00:00:00Z"), now, 1));
    }

    #[test]
    fn multi_day_interval_is_respected() {
        let now = chrono::DateTime::parse_from_rfc3339("2026-02-05T00:00:00Z").unwrap().to_utc();
        // 4 days elapsed, interval is 7 — not due yet.
        assert!(!is_backup_due(Some("2026-02-01T00:00:00Z"), now, 7));
    }
}
