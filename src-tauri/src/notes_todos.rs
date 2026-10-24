// Notes and todos CRUD. Like projects, these respect the configured
// storage backend (JSON files under notes_dir()/todos_dir(), or SQLite via
// db.rs) and are cached in memory after first read — every mutation here
// MUST call invalidate_notes_cache()/invalidate_todos_cache() or reads go
// stale.
//
// Every command that builds a filesystem path from a caller-supplied `id`
// runs it through validate_safe_id() first (path-traversal guard) — this
// was previously inconsistent (present on some newer commands, missing
// here); now applied uniformly.

// Phase 5: this module was swept of every panic-on-error unwrap()/expect() —
// deny any new one so the module can't silently regress.
#![deny(clippy::unwrap_used)]

use once_cell::sync::Lazy;
use serde_json::{json, Value};
use std::fs;
use std::sync::{Mutex, PoisonError};
use tauri::AppHandle;

// Raw notes (with _content) and todos, cached in memory after first read.
// Invalidated on every mutation so reads are always consistent.
static NOTES_CACHE: Lazy<Mutex<Option<Vec<Value>>>> =
    Lazy::new(|| Mutex::new(None));

static TODOS_CACHE: Lazy<Mutex<Option<Vec<Value>>>> =
    Lazy::new(|| Mutex::new(None));

// A panic while a cache lock is held (e.g. a bug elsewhere in the same
// critical section) would otherwise poison the mutex permanently — recover
// the poisoned guard's data rather than let every later read/write panic.
pub fn invalidate_notes_cache() { *NOTES_CACHE.lock().unwrap_or_else(PoisonError::into_inner) = None; }
pub fn invalidate_todos_cache() { *TODOS_CACHE.lock().unwrap_or_else(PoisonError::into_inner) = None; }

pub fn ensure_notes_dir(app: &AppHandle) { fs::create_dir_all(crate::notes_dir(app)).ok(); }
pub fn ensure_todos_dir(app: &AppHandle) { fs::create_dir_all(crate::todos_dir(app)).ok(); }

fn note_word_count(text: &str) -> usize {
    text.split_whitespace().count()
}

// Read all notes (raw, with _content) — served from the in-memory cache when warm.
pub fn read_all_notes_raw(app: &AppHandle) -> Vec<Value> {
    crate::external_changes_check(app);
    {
        let c = NOTES_CACHE.lock().unwrap_or_else(PoisonError::into_inner);
        if let Some(ref ns) = *c { return ns.clone(); }
    }
    let out: Vec<Value> = if crate::is_sqlite_enabled(app) && crate::open_db(app).is_ok() {
        crate::db_get_all("notes")
    } else {
        ensure_notes_dir(app);
        let dir = crate::notes_dir(app);
        let mut out = vec![];
        if let Ok(rd) = fs::read_dir(&dir) {
            for e in rd.flatten() {
                let path = e.path();
                if path.extension().and_then(|e| e.to_str()) != Some("json") { continue; }
                let Ok(s) = fs::read_to_string(&path) else { continue };
                let Ok(meta) = serde_json::from_str::<Value>(&s) else { continue };
                let id = meta["id"].as_str().unwrap_or("").to_string();
                let md_path = dir.join(format!("{}.md", id));
                let content = fs::read_to_string(&md_path).unwrap_or_default();
                let mut n = meta;
                if let Value::Object(ref mut m) = n {
                    m.insert("_content".into(), json!(content));
                }
                out.push(n);
            }
        }
        out
    };
    *NOTES_CACHE.lock().unwrap_or_else(PoisonError::into_inner) = Some(out.clone());
    out
}

// Read all todos (raw) — served from the in-memory cache when warm.
pub fn read_all_todos_raw(app: &AppHandle) -> Vec<Value> {
    crate::external_changes_check(app);
    {
        let c = TODOS_CACHE.lock().unwrap_or_else(PoisonError::into_inner);
        if let Some(ref ts) = *c { return ts.clone(); }
    }
    let out: Vec<Value> = if crate::is_sqlite_enabled(app) && crate::open_db(app).is_ok() {
        crate::db_get_all("todos")
    } else {
        ensure_todos_dir(app);
        let dir = crate::todos_dir(app);
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
    *TODOS_CACHE.lock().unwrap_or_else(PoisonError::into_inner) = Some(out.clone());
    out
}

#[tauri::command]
pub fn notes_get_all(app: AppHandle, project_id: Option<String>) -> Vec<Value> {
    let raw: Vec<Value> = read_all_notes_raw(&app);

    let mut notes: Vec<Value> = raw.into_iter().filter(|meta| {
        if let Some(ref pid) = project_id {
            meta["projectId"].as_str() == Some(pid.as_str())
        } else { true }
    }).map(|mut meta| {
        let content = meta["_content"].as_str().unwrap_or("").to_string();
        let preview = content.chars().take(220).collect::<String>();
        if let Value::Object(ref mut m) = meta {
            m.insert("preview".into(), json!(preview));
            m.insert("wordCount".into(), json!(note_word_count(&content)));
            m.insert("time".into(), json!(crate::relative_time(m.get("updatedAt").and_then(|v| v.as_str()))));
            m.remove("_content");
        }
        meta
    }).collect();

    notes.sort_by(|a, b| {
        let at = a["updatedAt"].as_str().unwrap_or("");
        let bt = b["updatedAt"].as_str().unwrap_or("");
        bt.cmp(at)
    });
    notes
}

/// Full-text search over note BODY content — notes_get_all() strips
/// `_content` before returning (title/preview/tag matching already
/// happens instantly client-side against that lighter payload; see
/// Notes.jsx), so a real body-content search has to happen server-side
/// against the same cached raw data, not by shipping every note's full
/// body into the frontend's zustand cache just to filter it there.
/// Returns a short snippet of surrounding context per match, not the
/// full body, keeping the response small regardless of note length.
#[tauri::command]
pub fn notes_search(app: AppHandle, query: String, project_id: Option<String>) -> Vec<Value> {
    let needle = query.trim().to_lowercase();
    if needle.is_empty() {
        return vec![];
    }
    let raw = read_all_notes_raw(&app);
    raw.into_iter().filter_map(|meta| {
        if let Some(ref pid) = project_id {
            if meta["projectId"].as_str() != Some(pid.as_str()) { return None; }
        }
        let id = meta["id"].as_str()?.to_string();
        let content = meta["_content"].as_str().unwrap_or("");
        let haystack = content.to_lowercase();
        let match_pos = haystack.find(&needle)?;
        Some(json!({ "id": id, "snippet": note_search_snippet(content, match_pos, needle.len()) }))
    }).collect()
}

/// Context around a match, not the whole body — ~40 chars before, ~90
/// after, widened outward to the nearest char boundary (`content` is
/// arbitrary user text, so byte-slicing at an exact offset could land
/// mid-character for non-ASCII content).
fn note_search_snippet(content: &str, match_byte_pos: usize, match_len: usize) -> String {
    let start_target = match_byte_pos.saturating_sub(40);
    let end_target = (match_byte_pos + match_len + 90).min(content.len());
    let start = content.char_indices().map(|(i, _)| i).rev().find(|&i| i <= start_target).unwrap_or(0);
    let end = content.char_indices().map(|(i, c)| i + c.len_utf8()).find(|&i| i >= end_target).unwrap_or(content.len());
    let mut snippet = content[start..end].replace('\n', " ");
    if start > 0 { snippet = format!("…{snippet}"); }
    if end < content.len() { snippet = format!("{snippet}…"); }
    snippet
}

#[tauri::command]
pub fn notes_get_by_id(app: AppHandle, id: String) -> Option<Value> {
    crate::validate_safe_id(&id).ok()?;
    if crate::is_sqlite_enabled(&app) && crate::open_db(&app).is_ok() {
        let mut v = crate::db_get_by_id("notes", &id)?;
        let content = v["_content"].as_str().unwrap_or("").to_string();
        if let Value::Object(ref mut m) = v {
            m.insert("content".into(), json!(content));
            m.remove("_content");
        }
        return Some(v);
    }
    ensure_notes_dir(&app);
    let dir  = crate::notes_dir(&app);
    let json_path = dir.join(format!("{}.json", id));
    if !json_path.exists() { return None; }
    let Ok(s)    = fs::read_to_string(&json_path) else { return None };
    let Ok(meta) = serde_json::from_str::<Value>(&s) else { return None };
    let md_path  = dir.join(format!("{}.md", id));
    let content  = fs::read_to_string(&md_path).unwrap_or_default();
    let mut n = meta;
    if let Value::Object(ref mut m) = n { m.insert("content".into(), json!(content)); }
    Some(n)
}

#[tauri::command]
pub fn notes_create(app: AppHandle, data: Value) -> Result<Value, String> {
    let id      = uuid::Uuid::new_v4().to_string();
    let now     = chrono::Utc::now().to_rfc3339();
    let content = data["content"].as_str().unwrap_or("").to_string();
    let mut meta = json!({
        "id":        id,
        "title":     data["title"].as_str().unwrap_or("Untitled Note"),
        "emoji":     data["emoji"].as_str().unwrap_or("📝"),
        "starred":   data["starred"].as_bool().unwrap_or(false),
        "archived":  false,
        "projectId": data["projectId"],
        "tags":      data["tags"].as_array().cloned().unwrap_or_default(),
        "createdAt": now,
        "updatedAt": now
    });
    if crate::is_sqlite_enabled(&app) && crate::open_db(&app).is_ok() {
        if let Value::Object(ref mut m) = meta { m.insert("_content".into(), json!(&content)); }
        crate::db_upsert("notes", &id, &meta)?;
        if let Value::Object(ref mut m) = meta { m.remove("_content"); m.insert("content".into(), json!(&content)); }
    } else {
        ensure_notes_dir(&app);
        let dir = crate::notes_dir(&app);
        let meta_json = serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?;
        fs::write(dir.join(format!("{}.json", id)), meta_json).map_err(|e| e.to_string())?;
        fs::write(dir.join(format!("{}.md", id)), &content).map_err(|e| e.to_string())?;
        if let Value::Object(ref mut m) = meta { m.insert("content".into(), json!(&content)); }
    }
    invalidate_notes_cache();
    let note_title = meta["title"].as_str().unwrap_or("").to_string();
    crate::activity_log(&app, "note.created", json!({ "title": note_title }));
    crate::personality::track(&app, "note_created", json!({}));
    {
        let sync_app = app.clone();
        let sync_id = id.clone();
        tauri::async_runtime::spawn_blocking(move || crate::obsidian::sync_note_to_vault(&sync_app, &sync_id));
    }
    Ok(meta)
}

#[tauri::command]
pub fn notes_update(app: AppHandle, id: String, changes: Value) -> Result<Value, String> {
    crate::validate_safe_id(&id)?;
    let content_opt = changes["content"].as_str().map(|s| s.to_string());

    let meta: Value = if crate::is_sqlite_enabled(&app) && crate::open_db(&app).is_ok() {
        crate::db_get_by_id("notes", &id).ok_or(format!("Note {} not found", id))?
    } else {
        ensure_notes_dir(&app);
        let json_path = crate::notes_dir(&app).join(format!("{}.json", id));
        if !json_path.exists() { return Err(format!("Note {} not found", id)); }
        let Ok(s) = fs::read_to_string(&json_path) else { return Err("Read error".into()) };
        serde_json::from_str::<Value>(&s).map_err(|_| "Parse error".to_string())?
    };

    let archived_changed = changes.get("archived").is_some();
    let archived_new_val = changes["archived"].as_bool();
    let old_archived     = meta["archived"].as_bool().unwrap_or(false);
    let note_title       = meta["title"].as_str().unwrap_or("").to_string();
    let existing_content = meta["_content"].as_str().unwrap_or("").to_string();

    let mut updated = crate::deep_merge(meta, changes);
    if let Value::Object(ref mut m) = updated {
        m.insert("updatedAt".into(), json!(chrono::Utc::now().to_rfc3339()));
        m.remove("content");
    }

    let current_content = content_opt.clone().unwrap_or(existing_content);

    if crate::is_sqlite_enabled(&app) && crate::open_db(&app).is_ok() {
        if let Value::Object(ref mut m) = updated { m.insert("_content".into(), json!(&current_content)); }
        crate::db_upsert("notes", &id, &updated)?;
        if let Value::Object(ref mut m) = updated { m.remove("_content"); }
    } else {
        let dir = crate::notes_dir(&app);
        let json_path = dir.join(format!("{}.json", id));
        if let Value::Object(ref mut m) = updated { m.remove("_content"); }
        let updated_json = serde_json::to_string_pretty(&updated).map_err(|e| e.to_string())?;
        fs::write(&json_path, updated_json).map_err(|e| e.to_string())?;
        let md_path = dir.join(format!("{}.md", id));
        if let Some(ref c) = content_opt {
            fs::write(&md_path, c).map_err(|e| e.to_string())?;
        }
    }

    invalidate_notes_cache();
    if archived_changed {
        let new_archived = archived_new_val.unwrap_or(old_archived);
        if new_archived && !old_archived {
            crate::activity_log(&app, "note.archived", json!({ "title": note_title }));
        } else if !new_archived && old_archived {
            crate::activity_log(&app, "note.unarchived", json!({ "title": note_title }));
        }
    }
    {
        let sync_app = app.clone();
        let sync_id = id.clone();
        tauri::async_runtime::spawn_blocking(move || crate::obsidian::sync_note_to_vault(&sync_app, &sync_id));
    }

    if let Value::Object(ref mut m) = updated { m.insert("content".into(), json!(current_content)); }
    Ok(updated)
}

// Soft delete: sets trashedAt instead of removing the note, and
// deliberately does NOT touch the Obsidian vault copy (if any) — a trashed
// note is meant to be reversible, and removing-then-restoring would leave
// the vault file gone even after a restore. Only notes_delete_permanently
// (and crate::purge_expired_trash after TRASH_RETENTION_DAYS) removes the
// vault copy, matching the old hard-delete behavior.
#[tauri::command]
pub fn notes_delete(app: AppHandle, id: String) -> Result<Value, String> {
    crate::validate_safe_id(&id)?;
    let note_title = read_all_notes_raw(&app).into_iter()
        .find(|n| n["id"].as_str() == Some(id.as_str()))
        .and_then(|n| n["title"].as_str().map(|s| s.to_string()))
        .unwrap_or_default();
    notes_update(app.clone(), id.clone(), json!({ "trashedAt": chrono::Utc::now().to_rfc3339() }))?;
    crate::activity_log(&app, "note.trashed", json!({ "title": note_title }));
    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub fn notes_restore(app: AppHandle, id: String) -> Result<Value, String> {
    crate::validate_safe_id(&id)?;
    let note_title = read_all_notes_raw(&app).into_iter()
        .find(|n| n["id"].as_str() == Some(id.as_str()))
        .and_then(|n| n["title"].as_str().map(|s| s.to_string()))
        .unwrap_or_default();
    notes_update(app.clone(), id.clone(), json!({ "trashedAt": null }))?;
    crate::activity_log(&app, "note.restored", json!({ "title": note_title }));
    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub fn notes_delete_permanently(app: AppHandle, id: String) -> Result<Value, String> {
    crate::validate_safe_id(&id)?;
    let note_title: String;
    if crate::is_sqlite_enabled(&app) && crate::open_db(&app).is_ok() {
        note_title = crate::db_get_by_id("notes", &id)
            .and_then(|v| v["title"].as_str().map(|s| s.to_string()))
            .unwrap_or_default();
        crate::db_delete("notes", &id)?;
    } else {
        ensure_notes_dir(&app);
        let dir = crate::notes_dir(&app);
        let j = dir.join(format!("{}.json", id));
        let m = dir.join(format!("{}.md", id));
        note_title = fs::read_to_string(&j).ok()
            .and_then(|s| serde_json::from_str::<Value>(&s).ok())
            .and_then(|v| v["title"].as_str().map(|s| s.to_string()))
            .unwrap_or_default();
        if j.exists() { fs::remove_file(&j).ok(); }
        if m.exists() { fs::remove_file(&m).ok(); }
    }
    invalidate_notes_cache();
    crate::activity_log(&app, "note.deleted", json!({ "title": note_title }));
    {
        let sync_app = app.clone();
        let sync_id = id.clone();
        tauri::async_runtime::spawn_blocking(move || crate::obsidian::obsidian_delete_from_vault(&sync_app, &sync_id));
    }
    Ok(json!({ "ok": true }))
}

// ─── Todos commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn todos_get_all(app: AppHandle, project_id: Option<String>) -> Vec<Value> {
    let raw: Vec<Value> = read_all_todos_raw(&app);
    let mut todos: Vec<Value> = raw.into_iter().filter(|t| {
        if let Some(ref pid) = project_id {
            t["projectId"].as_str() == Some(pid.as_str())
        } else { true }
    }).collect();
    todos.sort_by(|a, b| {
        let at = a["createdAt"].as_str().unwrap_or("");
        let bt = b["createdAt"].as_str().unwrap_or("");
        bt.cmp(at)
    });
    todos
}

#[tauri::command]
pub fn todos_create(app: AppHandle, data: Value) -> Result<Value, String> {
    let title = data["title"].as_str().ok_or("Title is required")?.trim().to_string();
    if title.is_empty() { return Err("Title is required".into()); }
    let id  = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let todo = json!({
        "id":        id,
        "title":     title,
        "emoji":     data["emoji"],
        "completed": false,
        "priority":  data["priority"].as_str().unwrap_or("med"),
        "projectId": data["projectId"],
        "noteId":    data["noteId"],
        "dueDate":   data["dueDate"],
        "createdAt": now
    });
    if crate::is_sqlite_enabled(&app) && crate::open_db(&app).is_ok() {
        crate::db_upsert("todos", &id, &todo)?;
    } else {
        ensure_todos_dir(&app);
        let todo_json = serde_json::to_string_pretty(&todo).map_err(|e| e.to_string())?;
        fs::write(crate::todos_dir(&app).join(format!("{}.json", id)), todo_json)
            .map_err(|e| e.to_string())?;
    }
    invalidate_todos_cache();
    let project_id = data["projectId"].as_str().unwrap_or("").to_string();
    crate::activity_log(&app, "todo.created", json!({ "projectId": project_id, "title": title }));
    crate::personality::track(&app, "todo_created", json!({ "projectId": project_id }));
    Ok(todo)
}

#[tauri::command]
pub fn todos_toggle(app: AppHandle, id: String) -> Result<Value, String> {
    crate::validate_safe_id(&id)?;
    let mut todo: Value = if crate::is_sqlite_enabled(&app) && crate::open_db(&app).is_ok() {
        crate::db_get_by_id("todos", &id).ok_or(format!("Todo {} not found", id))?
    } else {
        ensure_todos_dir(&app);
        let path = crate::todos_dir(&app).join(format!("{}.json", id));
        if !path.exists() { return Err(format!("Todo {} not found", id)); }
        let Ok(s) = fs::read_to_string(&path) else { return Err("Read error".into()) };
        serde_json::from_str::<Value>(&s).map_err(|_| "Parse error".to_string())?
    };
    let completed = !todo["completed"].as_bool().unwrap_or(false);
    if let Value::Object(ref mut m) = todo {
        m.insert("completed".into(), json!(completed));
        if completed { m.insert("completedAt".into(), json!(chrono::Utc::now().to_rfc3339())); }
        else { m.insert("completedAt".into(), json!(null)); }
    }
    if crate::is_sqlite_enabled(&app) && crate::open_db(&app).is_ok() {
        crate::db_upsert("todos", &id, &todo)?;
    } else {
        let path = crate::todos_dir(&app).join(format!("{}.json", id));
        let todo_json = serde_json::to_string_pretty(&todo).map_err(|e| e.to_string())?;
        fs::write(&path, todo_json).map_err(|e| e.to_string())?;
    }
    invalidate_todos_cache();
    let title      = todo["title"].as_str().unwrap_or("").to_string();
    let project_id = todo["projectId"].as_str().unwrap_or("").to_string();
    if completed {
        crate::activity_log(&app, "todo.completed", json!({ "projectId": project_id, "title": title }));
        crate::personality::track(&app, "todo_completed", json!({}));
        crate::webhook_notify(&app, "Todo completed", &format!("✅ {title}"));
        crate::slack_webhook_notify(&app, &format!("Todo completed: {title}"));
    } else {
        crate::activity_log(&app, "todo.reverted", json!({ "projectId": project_id, "title": title }));
    }
    Ok(todo)
}

#[tauri::command]
pub fn todos_update(app: AppHandle, id: String, changes: Value) -> Result<Value, String> {
    crate::validate_safe_id(&id)?;
    let todo: Value = if crate::is_sqlite_enabled(&app) && crate::open_db(&app).is_ok() {
        crate::db_get_by_id("todos", &id).ok_or(format!("Todo {} not found", id))?
    } else {
        ensure_todos_dir(&app);
        let path = crate::todos_dir(&app).join(format!("{}.json", id));
        if !path.exists() { return Err(format!("Todo {} not found", id)); }
        let Ok(s) = fs::read_to_string(&path) else { return Err("Read error".into()) };
        serde_json::from_str::<Value>(&s).map_err(|_| "Parse error".to_string())?
    };
    let title_changed = changes.get("title").is_some();
    let updated = crate::deep_merge(todo, changes);
    if crate::is_sqlite_enabled(&app) && crate::open_db(&app).is_ok() {
        crate::db_upsert("todos", &id, &updated)?;
    } else {
        let path = crate::todos_dir(&app).join(format!("{}.json", id));
        let updated_json = serde_json::to_string_pretty(&updated).map_err(|e| e.to_string())?;
        fs::write(&path, updated_json).map_err(|e| e.to_string())?;
    }
    invalidate_todos_cache();
    if title_changed {
        let title      = updated["title"].as_str().unwrap_or("").to_string();
        let project_id = updated["projectId"].as_str().unwrap_or("").to_string();
        crate::activity_log(&app, "todo.edited", json!({ "projectId": project_id, "title": title }));
    }
    Ok(updated)
}

// Soft delete: sets trashedAt instead of removing the todo — see
// notes_delete's comment for the reasoning (this command mirrors it).
#[tauri::command]
pub fn todos_delete(app: AppHandle, id: String) -> Result<Value, String> {
    crate::validate_safe_id(&id)?;
    let todo_val = read_all_todos_raw(&app).into_iter().find(|t| t["id"].as_str() == Some(id.as_str())).unwrap_or(json!({}));
    let title      = todo_val["title"].as_str().unwrap_or("").to_string();
    let project_id = todo_val["projectId"].as_str().unwrap_or("").to_string();
    todos_update(app.clone(), id.clone(), json!({ "trashedAt": chrono::Utc::now().to_rfc3339() }))?;
    crate::activity_log(&app, "todo.trashed", json!({ "projectId": project_id, "title": title }));
    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub fn todos_restore(app: AppHandle, id: String) -> Result<Value, String> {
    crate::validate_safe_id(&id)?;
    let todo_val = read_all_todos_raw(&app).into_iter().find(|t| t["id"].as_str() == Some(id.as_str())).unwrap_or(json!({}));
    let title      = todo_val["title"].as_str().unwrap_or("").to_string();
    let project_id = todo_val["projectId"].as_str().unwrap_or("").to_string();
    todos_update(app.clone(), id.clone(), json!({ "trashedAt": null }))?;
    crate::activity_log(&app, "todo.restored", json!({ "projectId": project_id, "title": title }));
    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub fn todos_delete_permanently(app: AppHandle, id: String) -> Result<Value, String> {
    crate::validate_safe_id(&id)?;
    if crate::is_sqlite_enabled(&app) && crate::open_db(&app).is_ok() {
        let todo_val = crate::db_get_by_id("todos", &id).unwrap_or(json!({}));
        let title      = todo_val["title"].as_str().unwrap_or("").to_string();
        let project_id = todo_val["projectId"].as_str().unwrap_or("").to_string();
        crate::db_delete("todos", &id)?;
        crate::activity_log(&app, "todo.deleted", json!({ "projectId": project_id, "title": title }));
    } else {
        ensure_todos_dir(&app);
        let path = crate::todos_dir(&app).join(format!("{}.json", id));
        if path.exists() {
            let todo_val   = fs::read_to_string(&path).ok()
                .and_then(|s| serde_json::from_str::<Value>(&s).ok())
                .unwrap_or(json!({}));
            let title      = todo_val["title"].as_str().unwrap_or("").to_string();
            let project_id = todo_val["projectId"].as_str().unwrap_or("").to_string();
            fs::remove_file(&path).ok();
            crate::activity_log(&app, "todo.deleted", json!({ "projectId": project_id, "title": title }));
        }
    }
    invalidate_todos_cache();
    Ok(json!({ "ok": true }))
}

/// Startup sweep: permanently removes any note/todo trashed more than
/// TRASH_RETENTION_DAYS ago. Called once at launch alongside the other
/// migrate_*/purge_* startup passes — see main.rs's setup_app().
pub fn purge_expired_notes_todos_trash(app: &AppHandle) {
    let now = chrono::Utc::now();
    let is_expired = |v: &Value| -> bool { crate::is_trash_expired(v["trashedAt"].as_str(), now) };
    let expired_notes: Vec<String> = read_all_notes_raw(app).into_iter()
        .filter(is_expired)
        .filter_map(|n| n["id"].as_str().map(|s| s.to_string()))
        .collect();
    for id in expired_notes {
        let _ = notes_delete_permanently(app.clone(), id);
    }
    let expired_todos: Vec<String> = read_all_todos_raw(app).into_iter()
        .filter(is_expired)
        .filter_map(|t| t["id"].as_str().map(|s| s.to_string()))
        .collect();
    for id in expired_todos {
        let _ = todos_delete_permanently(app.clone(), id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snippet_trims_to_surrounding_context_with_ellipses_at_the_cut_points() {
        let content = "a".repeat(100) + "NEEDLE" + &"b".repeat(100);
        let pos = content.find("NEEDLE").unwrap();
        let snippet = note_search_snippet(&content, pos, "NEEDLE".len());
        assert!(snippet.starts_with('…'), "cut before the real start must show a leading ellipsis");
        assert!(snippet.ends_with('…'), "cut before the real end must show a trailing ellipsis");
        assert!(snippet.contains("NEEDLE"), "the match itself must survive the trim");
        assert!(snippet.len() < content.len(), "the snippet must actually be shorter than the full body");
    }

    #[test]
    fn snippet_has_no_ellipsis_when_the_match_is_near_the_edges() {
        let content = "NEEDLE at the very start of a short note";
        let snippet = note_search_snippet(content, 0, "NEEDLE".len());
        assert!(!snippet.starts_with('…'), "nothing was trimmed off the front, so no leading ellipsis");
    }

    #[test]
    fn snippet_does_not_panic_on_a_multibyte_boundary() {
        // "é" is 2 bytes in UTF-8 — a naive byte-offset slice near it could
        // split a character in half and panic. Regression guard.
        let content = format!("{}café{}", "x".repeat(45), "y".repeat(100));
        let pos = content.find("café").unwrap();
        let snippet = note_search_snippet(&content, pos, "café".len());
        assert!(snippet.contains("café"));
    }
}
