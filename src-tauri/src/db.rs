// SQLite storage backend — one of the two storage backends Croco supports
// (the other being flat JSON files, handled inline in projects.rs/
// notes_todos.rs). Tables are `(id TEXT PRIMARY KEY, data TEXT)` JSON blobs,
// selected via settings.app.storageBackend == "sqlite". See
// switch_storage_backend (data_transfer.rs) for how installs move between
// the two backends.

use once_cell::sync::Lazy;
use rusqlite::{params, Connection};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::AppHandle;

static DB: Lazy<Mutex<Option<Connection>>> = Lazy::new(|| Mutex::new(None));

pub fn db_path(app: &AppHandle) -> PathBuf {
    crate::projects_data_dir(app).join("croco.db")
}

pub fn is_sqlite_enabled(app: &AppHandle) -> bool {
    crate::read_settings(app)["app"]["storageBackend"].as_str() == Some("sqlite")
}

pub fn open_db(app: &AppHandle) -> Result<(), String> {
    let mut guard = DB.lock().unwrap();
    if guard.is_some() { return Ok(()); }
    let path = db_path(app);
    if let Some(p) = path.parent() { fs::create_dir_all(p).ok(); }
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
    conn.execute_batch("
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
    ").map_err(|e| e.to_string())?;
    *guard = Some(conn);
    Ok(())
}

pub fn db_get_all(table: &str) -> Vec<Value> {
    let guard = DB.lock().unwrap();
    let conn = match guard.as_ref() { Some(c) => c, None => return vec![] };
    let query = format!("SELECT data FROM {}", table);
    let mut stmt = match conn.prepare(&query) { Ok(s) => s, Err(_) => return vec![] };
    stmt.query_map([], |row| row.get::<_, String>(0))
        .ok()
        .map(|rows| rows.flatten().filter_map(|s| serde_json::from_str(&s).ok()).collect())
        .unwrap_or_default()
}

pub fn db_get_by_id(table: &str, id: &str) -> Option<Value> {
    let guard = DB.lock().unwrap();
    let conn = guard.as_ref()?;
    let query = format!("SELECT data FROM {} WHERE id = ?1", table);
    conn.query_row(&query, params![id], |row| row.get::<_, String>(0))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
}

pub fn db_upsert(table: &str, id: &str, data: &Value) -> Result<(), String> {
    let guard = DB.lock().unwrap();
    let conn = guard.as_ref().ok_or("DB not open")?;
    let json = serde_json::to_string(data).unwrap();
    let query = format!("INSERT INTO {} (id, data) VALUES (?1, ?2) ON CONFLICT(id) DO UPDATE SET data=excluded.data", table);
    conn.execute(&query, params![id, json]).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn db_delete(table: &str, id: &str) -> Result<(), String> {
    let guard = DB.lock().unwrap();
    let conn = guard.as_ref().ok_or("DB not open")?;
    let query = format!("DELETE FROM {} WHERE id = ?1", table);
    conn.execute(&query, params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn db_activity_insert(entry: &Value) -> Result<(), String> {
    let guard = DB.lock().unwrap();
    let conn = guard.as_ref().ok_or("DB not open")?;
    let json = serde_json::to_string(entry).unwrap();
    conn.execute("INSERT INTO activity (data) VALUES (?1)", params![json]).map_err(|e| e.to_string())?;
    // Trim old entries (keep latest 500)
    conn.execute("DELETE FROM activity WHERE id NOT IN (SELECT id FROM activity ORDER BY id DESC LIMIT 500)", []).ok();
    Ok(())
}

pub fn db_activity_clear() -> bool {
    let guard = DB.lock().unwrap();
    match guard.as_ref() {
        Some(conn) => conn.execute("DELETE FROM activity", []).is_ok(),
        None => false,
    }
}

pub fn db_activity_get_all(limit: usize) -> Vec<Value> {
    let guard = DB.lock().unwrap();
    let conn = match guard.as_ref() { Some(c) => c, None => return vec![] };
    let mut stmt = match conn.prepare(&format!("SELECT data FROM activity ORDER BY id DESC LIMIT {}", limit)) { Ok(s) => s, Err(_) => return vec![] };
    stmt.query_map([], |row| row.get::<_, String>(0))
        .ok()
        .map(|rows| rows.flatten().filter_map(|s| serde_json::from_str(&s).ok()).collect())
        .unwrap_or_default()
}
