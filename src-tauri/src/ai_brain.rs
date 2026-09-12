// The "Storage Brain" — the AI module's persistent local memory layer (see
// docs/modules-plan.md). Every memory/encyclopedia entry is a real `.md`
// file with YAML frontmatter, hand-editable in any text editor, never a
// database blob. `index.json` is a regenerable cache for fast listing —
// the `.md` files are always the source of truth; if the index and the
// files on disk ever disagree, `brain_rebuild_index` wins by rescanning.
//
// Nothing here calls a model — this is pure local storage plus a keyword
// relevance scorer (`assemble_context`) that ai.rs's chat pipeline uses to
// pick which slice of the brain is worth sending with a given request.
// Deliberately no embeddings/vector-DB dependency: keyword + tag overlap is
// enough for a personal-scale brain and keeps the binary lean.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

#[derive(Serialize, Deserialize, Clone)]
struct BrainMeta {
    id: String,
    #[serde(rename = "type")]
    entry_type: String, // "memory" | "encyclopedia"
    title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    project: Option<String>,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default = "default_importance")]
    importance: u8,
    #[serde(rename = "createdAt")]
    created_at: String,
    #[serde(rename = "updatedAt")]
    updated_at: String,
}

fn default_importance() -> u8 { 3 }

// projects_data_dir (not app_data_dir) — respects settings.app.dataPath the
// same way notes/todos/project-details do, so the Brain moves with the
// rest of a user's data if they've pointed dataPath somewhere custom
// (e.g. a synced Dropbox folder) instead of silently staying behind in the
// real app_data_dir.
fn brain_dir(app: &AppHandle) -> PathBuf {
    crate::projects_data_dir(app).join("brain")
}
fn memories_dir(app: &AppHandle) -> PathBuf { brain_dir(app).join("memories") }
fn encyclopedia_dir(app: &AppHandle) -> PathBuf { brain_dir(app).join("encyclopedia") }
fn projects_dir(app: &AppHandle) -> PathBuf { brain_dir(app).join("projects") }
fn conversations_dir(app: &AppHandle) -> PathBuf { brain_dir(app).join("conversations") }
fn index_path(app: &AppHandle) -> PathBuf { brain_dir(app).join("index.json") }

fn ensure_dirs(app: &AppHandle) {
    for d in [memories_dir(app), encyclopedia_dir(app), projects_dir(app), conversations_dir(app)] {
        let _ = fs::create_dir_all(d);
    }
}

// If Obsidian sync is on, mirror the brain into the vault too — same
// one-way, Croco-is-source-of-truth model obsidian.rs uses for notes
// (never read back). Best-effort: a failed mirror write never blocks the
// real (local) write from succeeding.
fn obsidian_mirror_path(app: &AppHandle, entry_type: &str, filename: &str) -> Option<PathBuf> {
    let settings = crate::read_settings(app);
    let obsidian = &settings["app"]["obsidian"];
    if !obsidian["enabled"].as_bool().unwrap_or(false) { return None; }
    let vault = obsidian["vaultPath"].as_str().filter(|s| !s.is_empty())?;
    let sub = match entry_type { "encyclopedia" => "Encyclopedia", _ => "Memories" };
    Some(PathBuf::from(vault).join("Croco Brain").join(sub).join(filename))
}

fn mirror_to_vault(app: &AppHandle, entry_type: &str, filename: &str, content: &str) {
    if let Some(path) = obsidian_mirror_path(app, entry_type, filename) {
        if let Some(parent) = path.parent() { let _ = fs::create_dir_all(parent); }
        let _ = fs::write(path, content);
    }
}

fn remove_from_vault(app: &AppHandle, entry_type: &str, filename: &str) {
    if let Some(path) = obsidian_mirror_path(app, entry_type, filename) {
        let _ = fs::remove_file(path);
    }
}

fn entry_dir(app: &AppHandle, entry_type: &str) -> PathBuf {
    if entry_type == "encyclopedia" { encyclopedia_dir(app) } else { memories_dir(app) }
}

fn serialize_entry(meta: &BrainMeta, body: &str) -> String {
    let yaml = serde_yaml::to_string(meta).unwrap_or_default();
    format!("---\n{yaml}---\n\n{}\n", body.trim())
}

fn parse_entry(content: &str) -> Option<(BrainMeta, String)> {
    let rest = content.strip_prefix("---\n")?;
    let (yaml, body) = rest.split_once("\n---\n")?;
    let meta: BrainMeta = serde_yaml::from_str(yaml).ok()?;
    Some((meta, body.trim_start_matches('\n').to_string()))
}

fn to_ui(meta: &BrainMeta, body: &str) -> Value {
    json!({
        "id": meta.id, "type": meta.entry_type, "title": meta.title,
        "project": meta.project, "tags": meta.tags, "importance": meta.importance,
        "createdAt": meta.created_at, "updatedAt": meta.updated_at, "body": body,
    })
}

fn write_index(app: &AppHandle, entries: &[BrainMeta]) {
    let _ = fs::write(index_path(app), serde_json::to_string_pretty(entries).unwrap_or_default());
}

fn read_index(app: &AppHandle) -> Vec<BrainMeta> {
    fs::read_to_string(index_path(app))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn upsert_index(app: &AppHandle, meta: &BrainMeta) {
    let mut idx = read_index(app);
    idx.retain(|m| m.id != meta.id);
    idx.push(meta.clone());
    write_index(app, &idx);
}

fn remove_from_index(app: &AppHandle, id: &str) {
    let mut idx = read_index(app);
    idx.retain(|m| m.id != id);
    write_index(app, &idx);
}

/// Rescans memories/ and encyclopedia/ from scratch — the fix for whenever
/// index.json and the files on disk disagree (a hand-edited/deleted file,
/// a mirror conflict, or just distrust). The `.md` files are always the
/// real source of truth; this just rebuilds the cache from them.
#[tauri::command]
pub fn brain_rebuild_index(app: AppHandle) -> Vec<Value> {
    ensure_dirs(&app);
    let mut metas = Vec::new();
    for dir in [memories_dir(&app), encyclopedia_dir(&app)] {
        let Ok(rd) = fs::read_dir(&dir) else { continue };
        for entry in rd.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("md") { continue; }
            if let Ok(content) = fs::read_to_string(&path) {
                if let Some((meta, _)) = parse_entry(&content) { metas.push(meta); }
            }
        }
    }
    write_index(&app, &metas);
    metas.iter().map(|m| json!({
        "id": m.id, "type": m.entry_type, "title": m.title, "project": m.project,
        "tags": m.tags, "importance": m.importance, "createdAt": m.created_at, "updatedAt": m.updated_at,
    })).collect()
}

fn create_entry(app: &AppHandle, entry_type: &str, title: String, body: String, project: Option<String>, tags: Vec<String>, importance: u8) -> Value {
    ensure_dirs(app);
    let now = chrono::Utc::now().to_rfc3339();
    let meta = BrainMeta {
        id: uuid::Uuid::new_v4().to_string(),
        entry_type: entry_type.to_string(),
        title, project, tags, importance: importance.clamp(1, 5),
        created_at: now.clone(), updated_at: now,
    };
    let filename = format!("{}.md", meta.id);
    let content = serialize_entry(&meta, &body);
    let _ = fs::write(entry_dir(app, entry_type).join(&filename), &content);
    mirror_to_vault(app, entry_type, &filename, &content);
    upsert_index(app, &meta);
    to_ui(&meta, &body)
}

fn update_entry(app: &AppHandle, entry_type: &str, id: &str, title: Option<String>, body: Option<String>, tags: Option<Vec<String>>, importance: Option<u8>) -> Result<Value, String> {
    crate::validate_safe_id(id)?;
    let filename = format!("{id}.md");
    let path = entry_dir(app, entry_type).join(&filename);
    let existing = fs::read_to_string(&path).map_err(|_| "Entry not found".to_string())?;
    let (mut meta, mut existing_body) = parse_entry(&existing).ok_or("Corrupt entry file")?;
    if let Some(t) = title { meta.title = t; }
    if let Some(b) = body { existing_body = b; }
    if let Some(tg) = tags { meta.tags = tg; }
    if let Some(imp) = importance { meta.importance = imp.clamp(1, 5); }
    meta.updated_at = chrono::Utc::now().to_rfc3339();
    let content = serialize_entry(&meta, &existing_body);
    fs::write(&path, &content).map_err(|e| e.to_string())?;
    mirror_to_vault(app, entry_type, &filename, &content);
    upsert_index(app, &meta);
    Ok(to_ui(&meta, &existing_body))
}

fn delete_entry(app: &AppHandle, entry_type: &str, id: &str) -> Result<(), String> {
    crate::validate_safe_id(id)?;
    let filename = format!("{id}.md");
    let _ = fs::remove_file(entry_dir(app, entry_type).join(&filename));
    remove_from_vault(app, entry_type, &filename);
    remove_from_index(app, id);
    Ok(())
}

fn get_entry(app: &AppHandle, entry_type: &str, id: &str) -> Result<Value, String> {
    crate::validate_safe_id(id)?;
    let path = entry_dir(app, entry_type).join(format!("{id}.md"));
    let content = fs::read_to_string(&path).map_err(|_| "Entry not found".to_string())?;
    let (meta, body) = parse_entry(&content).ok_or("Corrupt entry file")?;
    Ok(to_ui(&meta, &body))
}

fn list_entries(app: &AppHandle, entry_type: &str) -> Vec<Value> {
    read_index(app).into_iter()
        .filter(|m| m.entry_type == entry_type)
        .map(|m| json!({
            "id": m.id, "type": m.entry_type, "title": m.title, "project": m.project,
            "tags": m.tags, "importance": m.importance, "createdAt": m.created_at, "updatedAt": m.updated_at,
        }))
        .collect()
}

// ─── Memories ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn brain_memory_create(app: AppHandle, title: String, body: String, project: Option<String>, tags: Vec<String>, importance: u8) -> Value {
    create_entry(&app, "memory", title, body, project, tags, importance)
}
#[tauri::command]
pub fn brain_memory_update(app: AppHandle, id: String, title: Option<String>, body: Option<String>, tags: Option<Vec<String>>, importance: Option<u8>) -> Result<Value, String> {
    update_entry(&app, "memory", &id, title, body, tags, importance)
}
#[tauri::command]
pub fn brain_memory_delete(app: AppHandle, id: String) -> Result<(), String> { delete_entry(&app, "memory", &id) }
#[tauri::command]
pub fn brain_memory_get(app: AppHandle, id: String) -> Result<Value, String> { get_entry(&app, "memory", &id) }
#[tauri::command]
pub fn brain_memory_list(app: AppHandle) -> Vec<Value> { list_entries(&app, "memory") }

// ─── Encyclopedia ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn brain_encyclopedia_create(app: AppHandle, title: String, body: String, tags: Vec<String>, importance: u8) -> Value {
    create_entry(&app, "encyclopedia", title, body, None, tags, importance)
}
#[tauri::command]
pub fn brain_encyclopedia_update(app: AppHandle, id: String, title: Option<String>, body: Option<String>, tags: Option<Vec<String>>, importance: Option<u8>) -> Result<Value, String> {
    update_entry(&app, "encyclopedia", &id, title, body, tags, importance)
}
#[tauri::command]
pub fn brain_encyclopedia_delete(app: AppHandle, id: String) -> Result<(), String> { delete_entry(&app, "encyclopedia", &id) }
#[tauri::command]
pub fn brain_encyclopedia_get(app: AppHandle, id: String) -> Result<Value, String> { get_entry(&app, "encyclopedia", &id) }
#[tauri::command]
pub fn brain_encyclopedia_list(app: AppHandle) -> Vec<Value> { list_entries(&app, "encyclopedia") }

// ─── Search & context assembly ──────────────────────────────────────────────

fn keyword_score(text: &str, terms: &[String]) -> f64 {
    if terms.is_empty() { return 0.0; }
    let lower = text.to_lowercase();
    terms.iter().filter(|t| !t.is_empty() && lower.contains(t.as_str())).count() as f64 / terms.len() as f64
}

fn query_terms(query: &str) -> Vec<String> {
    query.to_lowercase().split_whitespace().filter(|w| w.len() > 2).map(|w| w.to_string()).collect()
}

#[tauri::command]
pub fn brain_search(app: AppHandle, query: String) -> Vec<Value> {
    let terms = query_terms(&query);
    let mut scored: Vec<(f64, Value)> = read_index(&app).into_iter().filter_map(|m| {
        let path = entry_dir(&app, &m.entry_type).join(format!("{}.md", m.id));
        let body = fs::read_to_string(&path).ok().and_then(|c| parse_entry(&c).map(|(_, b)| b)).unwrap_or_default();
        let haystack = format!("{} {} {}", m.title, m.tags.join(" "), body);
        let score = keyword_score(&haystack, &terms);
        if score <= 0.0 { return None; }
        Some((score, to_ui(&m, &body)))
    }).collect();
    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    scored.into_iter().take(20).map(|(_, v)| v).collect()
}

const CONTEXT_CHAR_BUDGET: usize = 6000; // roughly a couple thousand tokens

/// The "compress, don't dump everything" step: scores every memory +
/// encyclopedia entry by keyword-overlap-with-query + recency + importance,
/// takes the top entries within a fixed character budget, and always
/// leaves the rest of the brain untouched on disk. A project's own
/// brain/projects/<id>.md (if it exists) is always included first, since
/// it's already curated for that exact project.
///
/// This is also what makes provider "context switching" work: every call
/// rebuilds context fresh from here rather than depending on a provider's
/// own chat history, so swapping the active provider mid-task loses
/// nothing — the state was never inside either provider to begin with.
pub fn assemble_context(app: &AppHandle, project_id: Option<&str>, query: &str) -> String {
    let mut out = String::new();
    let mut budget = CONTEXT_CHAR_BUDGET;

    if let Some(pid) = project_id {
        if crate::validate_safe_id(pid).is_ok() {
            if let Ok(summary) = fs::read_to_string(projects_dir(app).join(format!("{pid}.md"))) {
                let (_, body) = parse_entry(&summary).unwrap_or((
                    BrainMeta { id: pid.into(), entry_type: "project".into(), title: String::new(), project: None, tags: vec![], importance: 5, created_at: String::new(), updated_at: String::new() },
                    summary.clone(),
                ));
                let chunk = format!("## Project context\n{}\n\n", body.chars().take(2000).collect::<String>());
                budget = budget.saturating_sub(chunk.len());
                out.push_str(&chunk);
            }
        }
    }

    let terms = query_terms(query);
    let now = chrono::Utc::now();
    let mut scored: Vec<(f64, BrainMeta, String)> = read_index(app).into_iter().filter_map(|m| {
        let path = entry_dir(app, &m.entry_type).join(format!("{}.md", m.id));
        let body = fs::read_to_string(&path).ok().and_then(|c| parse_entry(&c).map(|(_, b)| b))?;
        let haystack = format!("{} {} {}", m.title, m.tags.join(" "), body);
        let relevance = keyword_score(&haystack, &terms);
        let project_match = project_id.is_some() && m.project.as_deref() == project_id;
        let age_days = chrono::DateTime::parse_from_rfc3339(&m.updated_at)
            .map(|d| (now.signed_duration_since(d)).num_days() as f64)
            .unwrap_or(365.0);
        let recency = 1.0 / (1.0 + age_days / 30.0);
        let score = relevance * 3.0 + (m.importance as f64 / 5.0) + recency * 0.5 + if project_match { 1.0 } else { 0.0 };
        // Always-relevant memories (importance 5) surface even with no
        // keyword overlap and no query; everything else needs some signal.
        if score <= (m.importance as f64 / 5.0) + 0.01 && m.importance < 5 { return None; }
        Some((score, m, body))
    }).collect();
    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

    if !scored.is_empty() {
        out.push_str("## Relevant memories\n");
        for (_, meta, body) in scored {
            if budget == 0 { break; }
            let snippet = body.chars().take(500).collect::<String>();
            let chunk = format!("- **{}** ({}, importance {}/5): {}\n", meta.title, meta.entry_type, meta.importance, snippet.replace('\n', " "));
            if chunk.len() > budget { break; }
            budget -= chunk.len();
            out.push_str(&chunk);
        }
    }

    out
}

/// Deterministic, zero-cost per-project digest — no model call. Pulls
/// recent git commits, open todos, and recent activity for the project
/// into brain/projects/<id>.md, which assemble_context always includes
/// first for that project. User-triggered from the AI page for now; a
/// scheduled background regeneration is a later pass (see
/// docs/modules-plan.md's "explicitly deferred" list).
#[tauri::command]
pub async fn brain_project_summary_generate(app: AppHandle, project_id: String) -> Result<Value, String> {
    crate::validate_safe_id(&project_id)?;
    let project = crate::get_project(&app, &project_id).ok_or("Project not found")?;
    let name = project["name"].as_str().unwrap_or("Unknown").to_string();

    let commits = crate::git_get_log(app.clone(), project_id.clone(), Some(10)).await.unwrap_or_default();
    let todos: Vec<Value> = crate::todos_get_all(app.clone(), Some(project_id.clone()))
        .into_iter().filter(|t| !t["completed"].as_bool().unwrap_or(false)).collect();
    let activity: Vec<Value> = crate::activity_get_all(app.clone(), Some(200))
        .into_iter().filter(|e| e["projectId"].as_str() == Some(project_id.as_str())).take(15).collect();

    let mut body = format!("# {name}\n\n");
    body.push_str("## Recent commits\n");
    if commits.is_empty() { body.push_str("_none_\n"); }
    for c in &commits {
        body.push_str(&format!("- {} ({})\n", c["message"].as_str().unwrap_or(""), c["date"].as_str().unwrap_or("")));
    }
    body.push_str("\n## Open todos\n");
    if todos.is_empty() { body.push_str("_none_\n"); }
    for t in &todos {
        body.push_str(&format!("- [{}] {}\n", t["priority"].as_str().unwrap_or("med"), t["title"].as_str().unwrap_or("")));
    }
    body.push_str("\n## Recent activity\n");
    if activity.is_empty() { body.push_str("_none_\n"); }
    for a in &activity {
        body.push_str(&format!("- {} — {}\n", a["type"].as_str().unwrap_or(""), a["timestamp"].as_str().unwrap_or("")));
    }

    ensure_dirs(&app);
    let now = chrono::Utc::now().to_rfc3339();
    let meta = BrainMeta {
        id: project_id.clone(), entry_type: "project".into(), title: name,
        project: Some(project_id.clone()), tags: vec![], importance: 5,
        created_at: now.clone(), updated_at: now,
    };
    let content = serialize_entry(&meta, &body);
    fs::write(projects_dir(&app).join(format!("{project_id}.md")), &content).map_err(|e| e.to_string())?;
    Ok(to_ui(&meta, &body))
}

#[tauri::command]
pub fn brain_project_summary_get(app: AppHandle, project_id: String) -> Option<Value> {
    if crate::validate_safe_id(&project_id).is_err() { return None; }
    let content = fs::read_to_string(projects_dir(&app).join(format!("{project_id}.md"))).ok()?;
    let (meta, body) = parse_entry(&content)?;
    Some(to_ui(&meta, &body))
}

// ─── Conversations (chat transcripts) ───────────────────────────────────────
// Kept as part of the Brain (not a separate store) so a conversation's
// history is just more local markdown, editable/deletable the same way as
// anything else here.

pub fn conversation_path(app: &AppHandle, id: &str) -> PathBuf {
    // Structured role/text/timestamp data, not prose — .json here (not
    // .md) is deliberate; the .md-file rule in docs/modules-plan.md is
    // about memories/encyclopedia entries, which are actual documents.
    conversations_dir(app).join(format!("{id}.json"))
}

pub fn read_conversation(app: &AppHandle, id: &str) -> Vec<Value> {
    if crate::validate_safe_id(id).is_err() { return vec![]; }
    let Ok(content) = fs::read_to_string(conversation_path(app, id)) else { return vec![] };
    serde_json::from_str(&content).unwrap_or_default()
}

pub fn append_conversation(app: &AppHandle, id: &str, role: &str, text: &str) {
    if crate::validate_safe_id(id).is_err() { return; }
    ensure_dirs(app);
    let mut messages = read_conversation(app, id);
    messages.push(json!({ "role": role, "text": text, "at": chrono::Utc::now().to_rfc3339() }));
    let _ = fs::write(conversation_path(app, id), serde_json::to_string_pretty(&messages).unwrap_or_default());
}

#[tauri::command]
pub fn brain_conversation_get(app: AppHandle, id: String) -> Vec<Value> { read_conversation(&app, &id) }

#[tauri::command]
pub fn brain_conversation_delete(app: AppHandle, id: String) -> Result<(), String> {
    crate::validate_safe_id(&id)?;
    let _ = fs::remove_file(conversation_path(&app, &id));
    Ok(())
}
