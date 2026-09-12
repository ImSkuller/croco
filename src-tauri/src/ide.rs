// IDE module (v2.0, beta) — see docs/modules-plan.md. An embedded Monaco
// editor needs to read/write arbitrary files inside a project root by
// relative path (from a file-tree click, not an OS file picker), which is a
// trust boundary neither system_read_text_file nor system_write_bytes
// covers — those trust the picker dialog itself as the boundary. Here the
// path traversal guard has to live in this module.

use std::path::PathBuf;
use tauri::AppHandle;

const MAX_FILE_BYTES: u64 = 4 * 1024 * 1024; // same cap as system_read_text_file

// Resolves `rel_path` against the project's root and rejects anything that
// canonicalizes outside it (a `../../` escape, or a symlink pointing out of
// the tree) — the same discipline validate_safe_id applies to ids, applied
// here to a path instead. Requires the target to already exist, which is
// always true for a file opened from projects_get_file_tree; the IDE module
// doesn't support creating new files in this pass.
fn resolve_in_project(app: &AppHandle, project_id: &str, rel_path: &str) -> Result<PathBuf, String> {
    crate::validate_safe_id(project_id)?;
    let project = crate::get_project(app, project_id).ok_or("Project not found")?;
    let root = PathBuf::from(crate::project_root_str(&project));
    let root_canon = root.canonicalize().map_err(|e| e.to_string())?;
    let candidate = root.join(rel_path);
    let candidate_canon = candidate.canonicalize().map_err(|_| "File not found".to_string())?;
    if !candidate_canon.starts_with(&root_canon) {
        return Err("That path is outside the project.".into());
    }
    Ok(candidate_canon)
}

#[tauri::command]
pub fn ide_read_file(app: AppHandle, project_id: String, rel_path: String) -> Result<String, String> {
    let path = resolve_in_project(&app, &project_id, &rel_path)?;
    let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    if metadata.len() > MAX_FILE_BYTES {
        return Err(format!("File is too large to edit (over {}MB).", MAX_FILE_BYTES / 1024 / 1024));
    }
    std::fs::read_to_string(&path).map_err(|_| "Could not read this file as text — it may be binary.".to_string())
}

#[tauri::command]
pub fn ide_write_file(app: AppHandle, project_id: String, rel_path: String, content: String) -> Result<(), String> {
    let path = resolve_in_project(&app, &project_id, &rel_path)?;
    std::fs::write(&path, content).map_err(|e| e.to_string())
}
