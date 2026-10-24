//! Reads and writes the same data the desktop app manages — JSON files or the
//! SQLite database, whichever backend the user picked in Settings → Storage.
//! Path resolution mirrors `src-tauri/src/main.rs` exactly (CROCO_DATA_DIR →
//! app data dir → `settings.app.dataPath`).

use rusqlite::{params, Connection};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};

const IDENTIFIER: &str = "xyz.skuller.croco";

#[derive(Clone, Copy, PartialEq)]
pub enum Kind {
    Projects,
    Todos,
    Notes,
    Schedules,
}

impl Kind {
    fn dir(self) -> &'static str {
        match self {
            Kind::Projects => "project-details",
            Kind::Todos => "todos",
            Kind::Notes => "notes",
            Kind::Schedules => "schedules",
        }
    }
    fn table(self) -> &'static str {
        match self {
            Kind::Projects => "projects",
            Kind::Todos => "todos",
            Kind::Notes => "notes",
            Kind::Schedules => "schedules",
        }
    }
}

pub struct Store {
    pub app_dir: PathBuf,
    pub data_dir: PathBuf,
    pub sqlite: bool,
}

fn read_json(path: &Path) -> Option<Value> {
    serde_json::from_str(&fs::read_to_string(path).ok()?).ok()
}

pub fn app_data_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("CROCO_DATA_DIR") {
        if !dir.trim().is_empty() {
            return PathBuf::from(dir);
        }
    }
    dirs::data_dir().unwrap_or_else(|| PathBuf::from(".")).join(IDENTIFIER)
}

/// Ids end up in file paths — only ever accept the UUIDs the app generates.
fn safe_id(id: &str) -> Result<(), String> {
    if !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        Ok(())
    } else {
        Err(format!("invalid id: {id}"))
    }
}

impl Store {
    pub fn open() -> Store {
        let app_dir = app_data_dir();
        let settings = read_json(&app_dir.join("settings.json")).unwrap_or(Value::Null);
        let data_dir = match settings["app"]["dataPath"].as_str() {
            Some(p) if !p.trim().is_empty() => PathBuf::from(p),
            _ => app_dir.clone(),
        };
        let sqlite = settings["app"]["storageBackend"].as_str() == Some("sqlite");
        Store { app_dir, data_dir, sqlite }
    }

    fn db(&self) -> Result<Connection, String> {
        let conn = Connection::open(self.data_dir.join("croco.db")).map_err(|e| e.to_string())?;
        conn.busy_timeout(std::time::Duration::from_secs(3)).ok();
        for t in ["projects", "notes", "todos", "schedules"] {
            conn.execute_batch(&format!("CREATE TABLE IF NOT EXISTS {t} (id TEXT PRIMARY KEY, data TEXT NOT NULL);"))
                .map_err(|e| e.to_string())?;
        }
        Ok(conn)
    }

    pub fn list(&self, kind: Kind) -> Vec<Value> {
        if self.sqlite {
            let Ok(conn) = self.db() else { return vec![] };
            let Ok(mut stmt) = conn.prepare(&format!("SELECT data FROM {}", kind.table())) else { return vec![] };
            let Ok(rows) = stmt.query_map([], |r| r.get::<_, String>(0)) else { return vec![] };
            return rows.flatten().filter_map(|s| serde_json::from_str(&s).ok()).collect();
        }
        let Ok(rd) = fs::read_dir(self.data_dir.join(kind.dir())) else { return vec![] };
        rd.flatten()
            .filter(|e| e.path().extension().and_then(|x| x.to_str()) == Some("json"))
            .filter_map(|e| read_json(&e.path()))
            .collect()
    }

    pub fn save(&self, kind: Kind, item: &Value) -> Result<(), String> {
        let id = item["id"].as_str().ok_or("missing id")?;
        safe_id(id)?;
        if self.sqlite {
            let json = serde_json::to_string(item).map_err(|e| e.to_string())?;
            self.db()?
                .execute(
                    &format!("INSERT INTO {} (id, data) VALUES (?1, ?2) ON CONFLICT(id) DO UPDATE SET data=excluded.data", kind.table()),
                    params![id, json],
                )
                .map_err(|e| e.to_string())?;
        } else {
            let dir = self.data_dir.join(kind.dir());
            fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
            let text = serde_json::to_string_pretty(item).map_err(|e| e.to_string())?;
            fs::write(dir.join(format!("{id}.json")), text).map_err(|e| e.to_string())?;
        }
        self.touch();
        Ok(())
    }

    pub fn remove(&self, kind: Kind, id: &str) -> Result<(), String> {
        safe_id(id)?;
        if self.sqlite {
            self.db()?
                .execute(&format!("DELETE FROM {} WHERE id = ?1", kind.table()), params![id])
                .map_err(|e| e.to_string())?;
        } else {
            let dir = self.data_dir.join(kind.dir());
            let _ = fs::remove_file(dir.join(format!("{id}.json")));
            if kind == Kind::Notes {
                let _ = fs::remove_file(dir.join(format!("{id}.md")));
            }
        }
        self.touch();
        Ok(())
    }

    /// Body text of a note (a sidecar .md for JSON storage, `_content` in SQLite).
    pub fn note_content(&self, note: &Value) -> String {
        if self.sqlite {
            return note["_content"].as_str().unwrap_or("").to_string();
        }
        let Some(id) = note["id"].as_str() else { return String::new() };
        if safe_id(id).is_err() {
            return String::new();
        }
        fs::read_to_string(self.data_dir.join("notes").join(format!("{id}.md"))).unwrap_or_default()
    }

    pub fn save_note(&self, meta: &Value, content: &str) -> Result<(), String> {
        let id = meta["id"].as_str().ok_or("missing id")?.to_string();
        safe_id(&id)?;
        if self.sqlite {
            let mut m = meta.clone();
            m["_content"] = json!(content);
            return self.save(Kind::Notes, &m);
        }
        let dir = self.data_dir.join("notes");
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        fs::write(dir.join(format!("{id}.md")), content).map_err(|e| e.to_string())?;
        self.save(Kind::Notes, meta)
    }

    /// The desktop app keeps lists in memory; this stamp file tells a running
    /// instance that something changed on disk behind its back so it drops
    /// those caches on the next read (see `external_change_check` in the app).
    fn touch(&self) {
        let _ = fs::write(self.app_dir.join(".cli-touch"), chrono::Utc::now().to_rfc3339());
    }
}
