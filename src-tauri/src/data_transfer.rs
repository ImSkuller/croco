// Bulk data movement: the one-time JSON→SQLite migration, switching
// storage backends back and forth after that, and the full-app
// export/import backup format (a single JSON bundle covering projects,
// notes, and todos — settings are deliberately excluded from import since
// they carry machine-specific paths/secrets).

use serde_json::{json, Value};
use std::fs;
use tauri::AppHandle;

#[tauri::command]
pub async fn migrate_to_sqlite(app: AppHandle) -> Result<Value, String> {
    crate::open_db(&app)?;

    // Migrate projects
    let proj_dir = crate::project_details_dir(&app);
    let mut n_projects = 0u32;
    if proj_dir.exists() {
        if let Ok(rd) = fs::read_dir(&proj_dir) {
            for e in rd.flatten() {
                let path = e.path();
                if path.extension().and_then(|e| e.to_str()) != Some("json") { continue; }
                if let Ok(s) = fs::read_to_string(&path) {
                    if let Ok(v) = serde_json::from_str::<Value>(&s) {
                        if let Some(id) = v["id"].as_str() {
                            crate::db_upsert("projects", id, &v)?;
                            n_projects += 1;
                        }
                    }
                }
            }
        }
    }

    // Migrate notes (combine .json meta + .md content)
    let notes_d = crate::notes_dir(&app);
    let mut n_notes = 0u32;
    if notes_d.exists() {
        if let Ok(rd) = fs::read_dir(&notes_d) {
            for e in rd.flatten() {
                let path = e.path();
                if path.extension().and_then(|e| e.to_str()) != Some("json") { continue; }
                if let Ok(s) = fs::read_to_string(&path) {
                    if let Ok(mut v) = serde_json::from_str::<Value>(&s) {
                        if let Some(id) = v["id"].as_str().map(|s| s.to_string()) {
                            let md_path = notes_d.join(format!("{}.md", id));
                            let content = fs::read_to_string(&md_path).unwrap_or_default();
                            if let Value::Object(ref mut m) = v {
                                m.insert("_content".into(), json!(content));
                            }
                            crate::db_upsert("notes", &id, &v)?;
                            n_notes += 1;
                        }
                    }
                }
            }
        }
    }

    // Migrate todos
    let todos_d = crate::todos_dir(&app);
    let mut n_todos = 0u32;
    if todos_d.exists() {
        if let Ok(rd) = fs::read_dir(&todos_d) {
            for e in rd.flatten() {
                let path = e.path();
                if path.extension().and_then(|e| e.to_str()) != Some("json") { continue; }
                if let Ok(s) = fs::read_to_string(&path) {
                    if let Ok(v) = serde_json::from_str::<Value>(&s) {
                        if let Some(id) = v["id"].as_str() {
                            crate::db_upsert("todos", id, &v)?;
                            n_todos += 1;
                        }
                    }
                }
            }
        }
    }

    // Migrate schedules
    let schedules_d = crate::schedules_dir(&app);
    let mut n_schedules = 0u32;
    if schedules_d.exists() {
        if let Ok(rd) = fs::read_dir(&schedules_d) {
            for e in rd.flatten() {
                let path = e.path();
                if path.extension().and_then(|e| e.to_str()) != Some("json") { continue; }
                if let Ok(s) = fs::read_to_string(&path) {
                    if let Ok(v) = serde_json::from_str::<Value>(&s) {
                        if let Some(id) = v["id"].as_str() {
                            crate::db_upsert("schedules", id, &v)?;
                            n_schedules += 1;
                        }
                    }
                }
            }
        }
    }

    // Migrate activity
    let act_path = crate::activity_file(&app);
    let mut n_activity = 0u32;
    if act_path.exists() {
        if let Ok(s) = fs::read_to_string(&act_path) {
            if let Ok(entries) = serde_json::from_str::<Vec<Value>>(&s) {
                // Insert in reverse order so newest ends up last (DB orders by id DESC)
                for entry in entries.iter().rev() {
                    crate::db_activity_insert(entry)?;
                    n_activity += 1;
                }
            }
        }
    }

    // Update settings to switch backend
    let mut s = crate::read_settings(&app);
    if let Value::Object(ref mut m) = s {
        let app_obj = m.entry("app").or_insert(json!({}));
        if let Value::Object(ref mut am) = app_obj {
            am.insert("storageBackend".into(), json!("sqlite"));
        }
    }
    crate::write_settings(&app, &s)?;

    // Invalidate in-memory caches so next read comes from DB
    crate::invalidate_projects_cache();
    crate::invalidate_notes_cache();
    crate::invalidate_todos_cache();
    crate::invalidate_schedules_cache();

    Ok(json!({
        "ok": true,
        "migrated": {
            "projects": n_projects,
            "notes": n_notes,
            "todos": n_todos,
            "schedules": n_schedules,
            "activity": n_activity
        }
    }))
}

#[tauri::command]
pub async fn switch_storage_backend(app: AppHandle, backend: String) -> Result<Value, String> {
    if backend != "json" && backend != "sqlite" {
        return Err(format!("Unknown backend: {}", backend));
    }
    let current = crate::read_settings(&app)["app"]["storageBackend"]
        .as_str().unwrap_or("json").to_string();
    if current == backend { return Ok(json!({ "ok": true, "changed": false })); }

    if backend == "sqlite" {
        // JSON → SQLite: reuse migrate logic (opens DB, copies all data, sets backend)
        // We just call the migration directly.
        crate::open_db(&app)?;
        let proj_dir = crate::project_details_dir(&app);
        if proj_dir.exists() {
            if let Ok(rd) = fs::read_dir(&proj_dir) {
                for e in rd.flatten() {
                    let path = e.path();
                    if path.extension().and_then(|e| e.to_str()) != Some("json") { continue; }
                    if let Ok(s) = fs::read_to_string(&path) {
                        if let Ok(v) = serde_json::from_str::<Value>(&s) {
                            if let Some(id) = v["id"].as_str() {
                                crate::db_upsert("projects", id, &v)?;
                            }
                        }
                    }
                }
            }
        }
        let notes_d = crate::notes_dir(&app);
        if notes_d.exists() {
            if let Ok(rd) = fs::read_dir(&notes_d) {
                for e in rd.flatten() {
                    let path = e.path();
                    if path.extension().and_then(|e| e.to_str()) != Some("json") { continue; }
                    if let Ok(s) = fs::read_to_string(&path) {
                        if let Ok(mut v) = serde_json::from_str::<Value>(&s) {
                            if let Some(id) = v["id"].as_str().map(|s| s.to_string()) {
                                let md_path = notes_d.join(format!("{}.md", id));
                                let content = fs::read_to_string(&md_path).unwrap_or_default();
                                if let Value::Object(ref mut m) = v {
                                    m.insert("_content".into(), json!(content));
                                }
                                crate::db_upsert("notes", &id, &v)?;
                            }
                        }
                    }
                }
            }
        }
        let todos_d = crate::todos_dir(&app);
        if todos_d.exists() {
            if let Ok(rd) = fs::read_dir(&todos_d) {
                for e in rd.flatten() {
                    let path = e.path();
                    if path.extension().and_then(|e| e.to_str()) != Some("json") { continue; }
                    if let Ok(s) = fs::read_to_string(&path) {
                        if let Ok(v) = serde_json::from_str::<Value>(&s) {
                            if let Some(id) = v["id"].as_str() {
                                crate::db_upsert("todos", id, &v)?;
                            }
                        }
                    }
                }
            }
        }
        let schedules_d = crate::schedules_dir(&app);
        if schedules_d.exists() {
            if let Ok(rd) = fs::read_dir(&schedules_d) {
                for e in rd.flatten() {
                    let path = e.path();
                    if path.extension().and_then(|e| e.to_str()) != Some("json") { continue; }
                    if let Ok(s) = fs::read_to_string(&path) {
                        if let Ok(v) = serde_json::from_str::<Value>(&s) {
                            if let Some(id) = v["id"].as_str() {
                                crate::db_upsert("schedules", id, &v)?;
                            }
                        }
                    }
                }
            }
        }
    } else {
        // SQLite → JSON: export tables back to files
        crate::open_db(&app)?;
        let projects = crate::db_get_all("projects");
        for p in &projects {
            if let Some(id) = p["id"].as_str() {
                let dir = crate::project_details_dir(&app);
                fs::create_dir_all(&dir).ok();
                let path = dir.join(format!("{}.json", id));
                fs::write(&path, serde_json::to_string_pretty(p).unwrap()).ok();
            }
        }
        let notes = crate::db_get_all("notes");
        for n in &notes {
            if let Some(id) = n["id"].as_str() {
                let dir = crate::notes_dir(&app);
                fs::create_dir_all(&dir).ok();
                let mut meta = n.clone();
                let content = meta.as_object_mut()
                    .and_then(|m| m.remove("_content"))
                    .and_then(|v| v.as_str().map(|s| s.to_string()))
                    .unwrap_or_default();
                fs::write(dir.join(format!("{}.json", id)), serde_json::to_string_pretty(&meta).unwrap()).ok();
                fs::write(dir.join(format!("{}.md", id)), content).ok();
            }
        }
        let todos = crate::db_get_all("todos");
        for t in &todos {
            if let Some(id) = t["id"].as_str() {
                let dir = crate::todos_dir(&app);
                fs::create_dir_all(&dir).ok();
                fs::write(dir.join(format!("{}.json", id)), serde_json::to_string_pretty(t).unwrap()).ok();
            }
        }
        let schedules = crate::db_get_all("schedules");
        for s in &schedules {
            if let Some(id) = s["id"].as_str() {
                let dir = crate::schedules_dir(&app);
                fs::create_dir_all(&dir).ok();
                fs::write(dir.join(format!("{}.json", id)), serde_json::to_string_pretty(s).unwrap()).ok();
            }
        }
    }

    let mut s = crate::read_settings(&app);
    if let Value::Object(ref mut m) = s {
        let app_obj = m.entry("app").or_insert(json!({}));
        if let Value::Object(ref mut am) = app_obj {
            am.insert("storageBackend".into(), json!(backend));
        }
    }
    crate::write_settings(&app, &s)?;
    crate::invalidate_projects_cache();
    crate::invalidate_notes_cache();
    crate::invalidate_todos_cache();
    crate::invalidate_schedules_cache();
    Ok(json!({ "ok": true, "changed": true }))
}

// ─── Data backup / restore ─────────────────────────────────────────────────────

#[tauri::command]
pub async fn data_export_all(app: AppHandle, dest_path: String) -> Result<Value, String> {
    let projects  = crate::read_all_projects(&app);
    let notes     = crate::read_all_notes_raw(&app);
    let todos     = crate::read_all_todos_raw(&app);
    let schedules = crate::read_all_schedules_raw(&app);
    let settings  = crate::read_settings(&app);
    let counts = (projects.len(), notes.len(), todos.len(), schedules.len());
    let bundle = json!({
        "app":           "croco",
        "formatVersion": 2,
        "appVersion":    env!("CARGO_PKG_VERSION"),
        "exportedAt":    chrono::Utc::now().to_rfc3339(),
        "settings":      settings,
        "projects":      projects,
        "notes":         notes,
        "todos":         todos,
        "schedules":     schedules,
    });
    fs::write(&dest_path, serde_json::to_string_pretty(&bundle).unwrap())
        .map_err(|e| e.to_string())?;
    crate::activity_log(&app, "data.exported", json!({ "path": dest_path }));
    Ok(json!({ "ok": true, "projects": counts.0, "notes": counts.1, "todos": counts.2, "schedules": counts.3 }))
}

#[tauri::command]
pub async fn data_import_all(app: AppHandle, src_path: String) -> Result<Value, String> {
    let s = fs::read_to_string(&src_path).map_err(|e| e.to_string())?;
    let bundle: Value = serde_json::from_str(&s)
        .map_err(|_| "Not a valid Croco backup file".to_string())?;
    if bundle["app"].as_str() != Some("croco") {
        return Err("Not a valid Croco backup file".into());
    }

    let mut n_projects = 0usize;
    if let Some(ps) = bundle["projects"].as_array() {
        for p in ps {
            if p["id"].as_str().is_some() {
                crate::upsert_project(&app, p.clone())?;
                n_projects += 1;
            }
        }
    }

    let sqlite = crate::is_sqlite_enabled(&app) && crate::open_db(&app).is_ok();

    let mut n_notes = 0usize;
    if let Some(ns) = bundle["notes"].as_array() {
        for n in ns {
            let Some(id) = n["id"].as_str().map(|s| s.to_string()) else { continue };
            if sqlite {
                crate::db_upsert("notes", &id, n)?;
            } else {
                crate::ensure_notes_dir(&app);
                let dir = crate::notes_dir(&app);
                let mut meta = n.clone();
                let content = meta.as_object_mut()
                    .and_then(|m| m.remove("_content"))
                    .and_then(|v| v.as_str().map(|s| s.to_string()))
                    .unwrap_or_default();
                fs::write(dir.join(format!("{}.json", id)),
                    serde_json::to_string_pretty(&meta).unwrap()).map_err(|e| e.to_string())?;
                fs::write(dir.join(format!("{}.md", id)), content).map_err(|e| e.to_string())?;
            }
            n_notes += 1;
        }
    }

    let mut n_todos = 0usize;
    if let Some(ts) = bundle["todos"].as_array() {
        for t in ts {
            let Some(id) = t["id"].as_str().map(|s| s.to_string()) else { continue };
            if sqlite {
                crate::db_upsert("todos", &id, t)?;
            } else {
                crate::ensure_todos_dir(&app);
                fs::write(crate::todos_dir(&app).join(format!("{}.json", id)),
                    serde_json::to_string_pretty(t).unwrap()).map_err(|e| e.to_string())?;
            }
            n_todos += 1;
        }
    }

    let mut n_schedules = 0usize;
    if let Some(ss) = bundle["schedules"].as_array() {
        for s in ss {
            let Some(id) = s["id"].as_str().map(|s| s.to_string()) else { continue };
            if sqlite {
                crate::db_upsert("schedules", &id, s)?;
            } else {
                crate::ensure_schedules_dir(&app);
                fs::write(crate::schedules_dir(&app).join(format!("{}.json", id)),
                    serde_json::to_string_pretty(s).unwrap()).map_err(|e| e.to_string())?;
            }
            n_schedules += 1;
        }
    }

    // Settings are intentionally NOT restored — they contain machine-specific
    // paths and secrets that may not apply on this machine.
    crate::invalidate_notes_cache();
    crate::invalidate_todos_cache();
    crate::invalidate_projects_cache();
    crate::invalidate_schedules_cache();
    crate::activity_log(&app, "data.imported", json!({ "projects": n_projects, "notes": n_notes, "todos": n_todos, "schedules": n_schedules }));
    Ok(json!({ "ok": true, "projects": n_projects, "notes": n_notes, "todos": n_todos, "schedules": n_schedules }))
}
