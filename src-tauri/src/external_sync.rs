// The `croco` terminal app (cli-rs/) writes todos/notes straight to the data
// dir while this process may be running with warm in-memory caches
// (PROJECTS_CACHE, NOTES_CACHE, TODOS_CACHE, SCHEDULES_CACHE). After every
// write the CLI touches `<app data dir>/.cli-touch`; each cache getter calls
// `external_changes_check` first, which compares that file's mtime with the
// last one seen and drops all four caches when it moved. One stat() per read
// — cheap, and it means no watcher thread to leak.

use once_cell::sync::Lazy;
use std::sync::{Mutex, PoisonError};
use std::time::SystemTime;
use tauri::AppHandle;

static LAST_SEEN: Lazy<Mutex<Option<SystemTime>>> = Lazy::new(|| Mutex::new(None));

pub fn external_changes_check(app: &AppHandle) {
    let stamp = crate::app_data_dir(app).join(".cli-touch");
    let Ok(modified) = std::fs::metadata(&stamp).and_then(|m| m.modified()) else { return };
    let mut last = LAST_SEEN.lock().unwrap_or_else(PoisonError::into_inner);
    if *last == Some(modified) {
        return;
    }
    *last = Some(modified);
    drop(last);
    crate::invalidate_projects_cache();
    crate::invalidate_notes_cache();
    crate::invalidate_todos_cache();
    crate::invalidate_schedules_cache();
}
