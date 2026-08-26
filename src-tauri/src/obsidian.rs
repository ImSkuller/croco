// One-way Obsidian vault sync for notes.
//
// Croco is always the source of truth: every note create/update/delete fires
// a background write into the user's Obsidian vault as a markdown file with
// YAML frontmatter. Edits made directly in the vault are never read back —
// that's an explicit, locked scope decision (avoids conflict resolution and
// a file-watcher dependency entirely). Todos are out of scope for this pass.
//
// The `croco_id` frontmatter field (not the filename) is the permanent join
// key back to a Croco note, so renaming a note's title in Croco renames its
// vault file in place instead of creating a duplicate/orphan.

use serde::Serialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use walkdir::WalkDir;

#[derive(Serialize)]
struct NoteFrontmatter {
    croco_id: String,
    title: String,
    tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    project: Option<String>,
    starred: bool,
    archived: bool,
    #[serde(rename = "createdAt")]
    created_at: String,
    #[serde(rename = "updatedAt")]
    updated_at: String,
    #[serde(rename = "formatVersion")]
    format_version: u32,
}

// Returns the vault root only if the feature is enabled and a path is set —
// every other function in this module treats `None` as "do nothing, silently".
fn vault_root(app: &AppHandle) -> Option<PathBuf> {
    let settings = crate::read_settings(app);
    let obsidian = &settings["app"]["obsidian"];
    if !obsidian["enabled"].as_bool().unwrap_or(false) {
        return None;
    }
    let path = obsidian["vaultPath"].as_str().unwrap_or("");
    if path.is_empty() {
        return None;
    }
    Some(PathBuf::from(path))
}

fn extract_croco_id(content: &str) -> Option<String> {
    let mut parts = content.splitn(3, "---\n");
    let before = parts.next()?;
    if !before.trim().is_empty() {
        return None; // frontmatter must start at the top of the file
    }
    let frontmatter = parts.next()?;
    for line in frontmatter.lines() {
        if let Some(rest) = line.strip_prefix("croco_id:") {
            return Some(rest.trim().trim_matches('"').to_string());
        }
    }
    None
}

// Builds a croco_id -> current file path map by scanning every .md file
// already in the vault. Rebuilt fresh each sync pass rather than persisted,
// since the vault can also be reorganized by the user between syncs.
fn scan_existing_vault_map(vault_root: &Path) -> HashMap<String, PathBuf> {
    let mut map = HashMap::new();
    for entry in WalkDir::new(vault_root).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let Ok(content) = fs::read_to_string(path) else { continue };
        if let Some(id) = extract_croco_id(&content) {
            map.insert(id, path.to_path_buf());
        }
    }
    map
}

fn note_to_markdown(note: &Value, project_name: Option<&str>) -> String {
    let tags: Vec<String> = note["tags"]
        .as_array()
        .map(|a| a.iter().filter_map(|t| t.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();

    let fm = NoteFrontmatter {
        croco_id: note["id"].as_str().unwrap_or("").to_string(),
        title: note["title"].as_str().unwrap_or("Untitled Note").to_string(),
        tags,
        project: project_name.map(|s| s.to_string()),
        starred: note["starred"].as_bool().unwrap_or(false),
        archived: note["archived"].as_bool().unwrap_or(false),
        created_at: note["createdAt"].as_str().unwrap_or("").to_string(),
        updated_at: note["updatedAt"].as_str().unwrap_or("").to_string(),
        format_version: 1,
    };

    let yaml = serde_yaml::to_string(&fm).unwrap_or_default();
    let content = note["_content"].as_str().unwrap_or("");
    format!("---\n{}---\n{}", yaml, content)
}

fn target_dir_for_note(vault_root: &Path, project_name: Option<&str>) -> PathBuf {
    match project_name {
        Some(name) => vault_root.join(crate::slugify(name)),
        None => vault_root.join("_global"),
    }
}

// Picks a filename for `base_slug` in `dir`, deduping against files already
// there — except `skip` (the note's own current path), so a note whose
// title/project didn't change resolves back to its own existing file
// instead of being treated as a collision with itself.
fn unique_filename(dir: &Path, base_slug: &str, skip: Option<&Path>) -> PathBuf {
    let mut candidate = dir.join(format!("{}.md", base_slug));
    let mut i = 2;
    loop {
        let is_self = skip.map_or(false, |s| s == candidate);
        if is_self || !candidate.exists() {
            return candidate;
        }
        candidate = dir.join(format!("{}-{}.md", base_slug, i));
        i += 1;
    }
}

fn sync_one_note(app: &AppHandle, note: &Value, id_map: &mut HashMap<String, PathBuf>) -> Result<(), String> {
    let vault = vault_root(app).ok_or("Obsidian sync isn't enabled or configured")?;
    let id = note["id"].as_str().ok_or("Note is missing an id")?;
    crate::validate_safe_id(id)?;

    let project_id = note["projectId"].as_str();
    let project_name = project_id.and_then(|pid| {
        crate::read_all_projects(app)
            .into_iter()
            .find(|p| p["id"].as_str() == Some(pid))
            .and_then(|p| p["name"].as_str().map(|s| s.to_string()))
    });

    let dir = target_dir_for_note(&vault, project_name.as_deref());
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let base_slug = crate::slugify(note["title"].as_str().unwrap_or("Untitled Note"));
    let existing_path = id_map.get(id).cloned();
    let target_path = unique_filename(&dir, &base_slug, existing_path.as_deref());

    if let Some(ref old_path) = existing_path {
        if old_path != &target_path {
            fs::rename(old_path, &target_path).map_err(|e| e.to_string())?;
        }
    }

    let markdown = note_to_markdown(note, project_name.as_deref());
    fs::write(&target_path, markdown).map_err(|e| e.to_string())?;

    id_map.insert(id.to_string(), target_path);
    Ok(())
}

// Fire-and-forget entry point — called from a spawned task right after a
// note mutation. Errors can't flow back through the mutation's own Result,
// so failures surface via toast + activity log instead; success is silent
// (no toast spam on every keystroke-triggered autosave).
pub fn sync_note_to_vault(app: &AppHandle, note_id: &str) {
    let Some(vault) = vault_root(app) else { return };
    let notes = crate::read_all_notes_raw(app);
    let Some(note) = notes.into_iter().find(|n| n["id"].as_str() == Some(note_id)) else { return };
    let mut id_map = scan_existing_vault_map(&vault);
    if let Err(err_msg) = sync_one_note(app, &note, &mut id_map) {
        crate::emit_toast(app, "Obsidian sync failed", &err_msg, "warning");
        crate::activity_log(app, "obsidian.sync_failed", json!({ "noteId": note_id, "error": err_msg }));
    }
}

pub fn obsidian_delete_from_vault(app: &AppHandle, note_id: &str) {
    let Some(vault) = vault_root(app) else { return };
    let id_map = scan_existing_vault_map(&vault);
    if let Some(path) = id_map.get(note_id) {
        if let Err(e) = fs::remove_file(path) {
            crate::emit_toast(app, "Obsidian sync failed", &e.to_string(), "warning");
            crate::activity_log(app, "obsidian.sync_failed", json!({ "noteId": note_id, "error": e.to_string() }));
        }
    }
}

#[tauri::command]
pub async fn obsidian_sync_all(app: AppHandle) -> Result<Value, String> {
    let vault = vault_root(&app)
        .ok_or("Obsidian sync isn't enabled, or no vault path is set. Configure it in Settings first.")?;
    fs::create_dir_all(&vault).map_err(|e| e.to_string())?;

    let notes = crate::read_all_notes_raw(&app);
    let mut id_map = scan_existing_vault_map(&vault);
    let mut synced = 0u32;
    let mut errors: Vec<Value> = vec![];

    for note in &notes {
        match sync_one_note(&app, note, &mut id_map) {
            Ok(()) => synced += 1,
            Err(e) => errors.push(json!({ "noteId": note["id"], "title": note["title"], "error": e })),
        }
    }

    let mut settings = crate::read_settings(&app);
    crate::set_nested(&mut settings, &["app", "obsidian", "lastSyncAt"], json!(chrono::Utc::now().to_rfc3339()));
    crate::write_settings(&app, &settings)?;

    let failed = errors.len();
    crate::activity_log(&app, "obsidian.sync_all", json!({ "synced": synced, "failed": failed }));
    Ok(json!({ "synced": synced, "failed": failed, "errors": errors }))
}

#[tauri::command]
pub fn obsidian_test_vault_path(path: String) -> Result<Value, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Ok(json!({ "valid": false, "message": "Folder doesn't exist" }));
    }
    if !p.is_dir() {
        return Ok(json!({ "valid": false, "message": "Path is not a folder" }));
    }
    let probe = p.join(".croco-write-test");
    match fs::write(&probe, b"") {
        Ok(()) => {
            fs::remove_file(&probe).ok();
            Ok(json!({ "valid": true }))
        }
        Err(e) => Ok(json!({ "valid": false, "message": format!("Folder isn't writable: {}", e) })),
    }
}

#[cfg(test)]
mod tests {
    use super::extract_croco_id;

    #[test]
    fn finds_croco_id_in_valid_frontmatter() {
        let content = "---\ncroco_id: abc-123\ntitle: Hello\n---\nBody text\n";
        assert_eq!(extract_croco_id(content), Some("abc-123".to_string()));
    }

    #[test]
    fn strips_quotes_around_the_id() {
        let content = "---\ncroco_id: \"abc-123\"\n---\nBody\n";
        assert_eq!(extract_croco_id(content), Some("abc-123".to_string()));
    }

    #[test]
    fn returns_none_when_no_frontmatter_present() {
        let content = "Just a plain markdown file, no frontmatter.\n";
        assert_eq!(extract_croco_id(content), None);
    }

    #[test]
    fn returns_none_when_frontmatter_lacks_croco_id() {
        let content = "---\ntitle: No id here\n---\nBody\n";
        assert_eq!(extract_croco_id(content), None);
    }

    #[test]
    fn does_not_match_frontmatter_that_does_not_start_the_file() {
        let content = "Some prose first\n---\ncroco_id: abc-123\n---\nBody\n";
        assert_eq!(extract_croco_id(content), None);
    }
}
