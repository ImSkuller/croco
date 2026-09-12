// Custom tags (v2) — a catalog of colors plus bulk rename / merge / delete
// across every project and note. Tag identity stays the free-text name
// (no id migration): the CLI, export/import bundles, the local HTTP API and
// every existing consumer keep reading `project.tags` / `note.tags` as
// plain strings, and the catalog (settings.tags.catalog: { "<name>":
// { "color": "#hex" } }) only layers color + management on top. A tag with
// no catalog entry is still a perfectly valid tag — it just renders neutral.

use serde_json::{json, Map, Value};
use std::collections::BTreeMap;
use tauri::AppHandle;

fn catalog(app: &AppHandle) -> Map<String, Value> {
    crate::read_settings(app)["tags"]["catalog"].as_object().cloned().unwrap_or_default()
}

// settings_set's dotted-path splitting can't address a tag name containing
// a '.', so the whole catalog object is always written back as one value
// under the (dot-free) "tags.catalog" path.
fn write_catalog(app: &AppHandle, cat: Map<String, Value>) -> Result<(), String> {
    crate::settings_set(app.clone(), "tags.catalog".into(), Value::Object(cat)).map(|_| ())
}

fn tags_of(v: &Value) -> Vec<String> {
    v["tags"].as_array().map(|a| a.iter().filter_map(|t| t.as_str().map(|s| s.to_string())).collect()).unwrap_or_default()
}

/// Every tag in use (non-trashed projects + notes), with usage counts and
/// the catalog color if one is set. Catalog-only entries (a color set for a
/// tag no longer used anywhere) are included with zero counts so they can
/// still be cleaned up from the Tag Manager.
#[tauri::command]
pub fn tags_list(app: AppHandle) -> Vec<Value> {
    let mut usage: BTreeMap<String, (u32, u32)> = BTreeMap::new();
    for p in crate::projects_get_all(app.clone()) {
        if p["trashedAt"].is_string() { continue; }
        for t in tags_of(&p) { usage.entry(t).or_default().0 += 1; }
    }
    for n in crate::notes_get_all(app.clone(), None) {
        if n["trashedAt"].is_string() { continue; }
        for t in tags_of(&n) { usage.entry(t).or_default().1 += 1; }
    }
    let cat = catalog(&app);
    for name in cat.keys() { usage.entry(name.clone()).or_default(); }
    usage.into_iter().map(|(name, (projects, notes))| json!({
        "name": name,
        "projects": projects,
        "notes": notes,
        "color": cat.get(&name).and_then(|c| c["color"].as_str()),
    })).collect()
}

#[tauri::command]
pub fn tags_set_color(app: AppHandle, name: String, color: Option<String>) -> Result<(), String> {
    let name = name.trim().to_string();
    if name.is_empty() { return Err("Tag name is required".into()); }
    let mut cat = catalog(&app);
    match color.filter(|c| !c.trim().is_empty()) {
        Some(c) => { cat.insert(name, json!({ "color": c.trim() })); }
        None => { cat.remove(&name); }
    }
    write_catalog(&app, cat)
}

// Rewrites `from` → `into` on every project and note that carries it,
// deduping if `into` was already present (which is what makes this double
// as "merge"). The catalog color follows: `into` keeps its own color if it
// has one, otherwise inherits `from`'s.
fn retag_everything(app: &AppHandle, from: &str, into: Option<&str>) -> Result<(u32, u32), String> {
    let mut projects_touched = 0;
    for p in crate::projects_get_all(app.clone()) {
        let tags = tags_of(&p);
        if !tags.iter().any(|t| t == from) { continue; }
        let mut next: Vec<String> = Vec::new();
        for t in tags {
            let replacement = if t == from { into.map(|s| s.to_string()) } else { Some(t) };
            if let Some(r) = replacement { if !next.contains(&r) { next.push(r); } }
        }
        if let Some(id) = p["id"].as_str() {
            crate::projects_edit(app.clone(), id.to_string(), json!({ "tags": next }))?;
            projects_touched += 1;
        }
    }
    let mut notes_touched = 0;
    for n in crate::notes_get_all(app.clone(), None) {
        let tags = tags_of(&n);
        if !tags.iter().any(|t| t == from) { continue; }
        let mut next: Vec<String> = Vec::new();
        for t in tags {
            let replacement = if t == from { into.map(|s| s.to_string()) } else { Some(t) };
            if let Some(r) = replacement { if !next.contains(&r) { next.push(r); } }
        }
        if let Some(id) = n["id"].as_str() {
            crate::notes_update(app.clone(), id.to_string(), json!({ "tags": next }))?;
            notes_touched += 1;
        }
    }
    Ok((projects_touched, notes_touched))
}

#[tauri::command]
pub fn tags_rename(app: AppHandle, from: String, into: String) -> Result<Value, String> {
    let from = from.trim().to_string();
    let into = into.trim().to_string();
    if from.is_empty() || into.is_empty() { return Err("Both tag names are required".into()); }
    if from == into { return Ok(json!({ "projects": 0, "notes": 0 })); }
    let (projects, notes) = retag_everything(&app, &from, Some(&into))?;
    let mut cat = catalog(&app);
    if let Some(old) = cat.remove(&from) {
        cat.entry(into.clone()).or_insert(old);
    }
    write_catalog(&app, cat)?;
    crate::activity_log(&app, "tag.renamed", json!({ "from": from, "into": into, "projects": projects, "notes": notes }));
    Ok(json!({ "projects": projects, "notes": notes }))
}

#[tauri::command]
pub fn tags_delete(app: AppHandle, name: String) -> Result<Value, String> {
    let name = name.trim().to_string();
    if name.is_empty() { return Err("Tag name is required".into()); }
    let (projects, notes) = retag_everything(&app, &name, None)?;
    let mut cat = catalog(&app);
    cat.remove(&name);
    write_catalog(&app, cat)?;
    crate::activity_log(&app, "tag.deleted", json!({ "name": name, "projects": projects, "notes": notes }));
    Ok(json!({ "projects": projects, "notes": notes }))
}
