// SQLite storage backend — one of the two storage backends Croco supports
// (the other being flat JSON files, handled inline in projects.rs/
// notes_todos.rs). Tables are `(id TEXT PRIMARY KEY, data TEXT)` JSON blobs,
// selected via settings.app.storageBackend == "sqlite". See
// switch_storage_backend (data_transfer.rs) for how installs move between
// the two backends.
//
// NOTE on schema (Phase 5 remediation): every table stores its row as an
// opaque JSON blob rather than promoting filtered fields (archived,
// projectId, dueDate, priority) to real indexed columns. That means a
// filtered read still deserializes every row for a table. This is a
// deliberate, documented trade-off rather than an oversight: at this app's
// realistic scale (a personal/small-team project manager — hundreds of
// notes/todos, not tens of thousands; see CLAUDE.md's own "virtualize past
// ~100 rows" bar) the cost is negligible, and a real-column migration would
// need to be provably lossless and idempotent against every existing
// install's data — a correctness risk not worth taking without a concrete,
// measured need. SQLite is chosen here for durability/WAL, not query speed;
// if that stops being true (real user-reported lag on large datasets),
// revisit with real columns + indexes then.

// Phase 5: this module was swept of every panic-on-error unwrap()/expect() —
// deny any new one so the module can't silently regress.
#![deny(clippy::unwrap_used)]

use once_cell::sync::Lazy;
use rusqlite::{params, Connection};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard, PoisonError};
use tauri::AppHandle;

static DB: Lazy<Mutex<Option<Connection>>> = Lazy::new(|| Mutex::new(None));

/// A panic while holding the DB lock (e.g. a bug in a query callback) would
/// otherwise poison the mutex permanently, making every later DB call panic
/// for the rest of the session. The `Option<Connection>` itself has no
/// invariant a panic could leave torn, so recovering the poisoned guard's
/// data is safe — same reasoning `parking_lot` uses to not poison at all.
fn db_lock() -> MutexGuard<'static, Option<Connection>> {
    DB.lock().unwrap_or_else(PoisonError::into_inner)
}

pub fn db_path(app: &AppHandle) -> PathBuf {
    crate::projects_data_dir(app).join("croco.db")
}

pub fn is_sqlite_enabled(app: &AppHandle) -> bool {
    crate::read_settings(app)["app"]["storageBackend"].as_str() == Some("sqlite")
}

pub fn open_db(app: &AppHandle) -> Result<(), String> {
    let mut guard = db_lock();
    if guard.is_some() {
        return Ok(());
    }
    let path = db_path(app);
    if let Some(p) = path.parent() {
        fs::create_dir_all(p).ok();
    }
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
    conn.execute_batch(
        "
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS todos (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS schedules (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT NOT NULL
        );
    ",
    )
    .map_err(|e| e.to_string())?;
    *guard = Some(conn);
    Ok(())
}

pub fn db_get_all(table: &str) -> Vec<Value> {
    let guard = db_lock();
    let Some(conn) = guard.as_ref() else { return vec![] };
    let query = format!("SELECT data FROM {}", table);
    let Ok(mut stmt) = conn.prepare(&query) else { return vec![] };
    let Ok(rows) = stmt.query_map([], |row| row.get::<_, String>(0)) else { return vec![] };
    rows.flatten().filter_map(|s| serde_json::from_str(&s).ok()).collect()
}

pub fn db_get_by_id(table: &str, id: &str) -> Option<Value> {
    let guard = db_lock();
    let conn = guard.as_ref()?;
    let query = format!("SELECT data FROM {} WHERE id = ?1", table);
    conn.query_row(&query, params![id], |row| row.get::<_, String>(0))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
}

pub fn db_upsert(table: &str, id: &str, data: &Value) -> Result<(), String> {
    let guard = db_lock();
    let conn = guard.as_ref().ok_or("DB not open")?;
    let json = serde_json::to_string(data).map_err(|e| e.to_string())?;
    let query = format!(
        "INSERT INTO {} (id, data) VALUES (?1, ?2) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
        table
    );
    conn.execute(&query, params![id, json]).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn db_delete(table: &str, id: &str) -> Result<(), String> {
    let guard = db_lock();
    let conn = guard.as_ref().ok_or("DB not open")?;
    let query = format!("DELETE FROM {} WHERE id = ?1", table);
    conn.execute(&query, params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn db_activity_insert(entry: &Value) -> Result<(), String> {
    let guard = db_lock();
    let conn = guard.as_ref().ok_or("DB not open")?;
    let json = serde_json::to_string(entry).map_err(|e| e.to_string())?;
    conn.execute("INSERT INTO activity (data) VALUES (?1)", params![json])
        .map_err(|e| e.to_string())?;
    // Trim old entries (keep latest 500)
    conn.execute(
        "DELETE FROM activity WHERE id NOT IN (SELECT id FROM activity ORDER BY id DESC LIMIT 500)",
        [],
    )
    .ok();
    Ok(())
}

pub fn db_activity_clear() -> bool {
    let guard = db_lock();
    match guard.as_ref() {
        Some(conn) => conn.execute("DELETE FROM activity", []).is_ok(),
        None => false,
    }
}

pub fn db_activity_get_all(limit: usize) -> Vec<Value> {
    let guard = db_lock();
    let Some(conn) = guard.as_ref() else { return vec![] };
    let Ok(mut stmt) = conn.prepare("SELECT data FROM activity ORDER BY id DESC LIMIT ?1") else {
        return vec![];
    };
    // `limit` is an internal usize today (never user-controlled SQL text),
    // but bind it as a parameter rather than `format!`-interpolating it so
    // that stays true if a caller ever becomes untrusted.
    let limit = limit as i64;
    let Ok(rows) = stmt.query_map(params![limit], |row| row.get::<_, String>(0)) else {
        return vec![];
    };
    rows.flatten().filter_map(|s| serde_json::from_str(&s).ok()).collect()
}
