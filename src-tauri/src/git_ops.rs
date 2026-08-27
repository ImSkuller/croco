// Git integration — status/commit/push/pull/branches/log for a single
// project, plus repo-creation/publish flows that talk to the GitHub API.
//
// Auth: push/pull/fetch each try the plain command first (works when the
// user has a system credential helper configured) and fall back to a
// token-authenticated URL built from settings.user.github.token when that
// fails — see *_with_auth_fallback below. Tokens are always scrubbed from
// error strings before they reach the UI.

use serde_json::{json, Value};
use std::fs;
use std::path::Path;
use std::process::Command;
use tauri::AppHandle;

pub fn run_git(args: &[&str], cwd: &str) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.args(args).current_dir(cwd);
    crate::no_window(&mut cmd);
    let out = cmd.output().map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

pub fn project_root(app: &AppHandle, id: &str) -> Result<String, String> {
    crate::get_project(app, id)
        .map(|p| crate::project_root_str(&p))
        .filter(|r| !r.is_empty())
        .ok_or_else(|| format!("Project {} not found", id))
}

// Real last-commit timestamp for a repo, regardless of what tool made the
// commit (Croco, terminal, another IDE) — used to keep project.lastCommit
// accurate instead of only reflecting commits made through Croco's own UI.
fn latest_commit_iso(cwd: &str) -> Option<String> {
    run_git(&["log", "-1", "--format=%cI"], cwd).ok().filter(|s| !s.is_empty())
}

// Refreshes a single project's meta.lastCommitAt from its actual git log.
// Cheap (one `git log -1`) and safe to call on every status check.
fn sync_last_commit_date(app: &AppHandle, id: &str, cwd: &str) {
    if let Some(iso) = latest_commit_iso(cwd) {
        let current = crate::get_project(app, id)
            .and_then(|p| p["meta"]["lastCommitAt"].as_str().map(|s| s.to_string()));
        if current.as_deref() != Some(iso.as_str()) {
            let _ = crate::projects_edit(app.clone(), id.to_string(), json!({ "meta": { "lastCommitAt": iso } }));
        }
    }
}

#[tauri::command]
pub async fn git_status(app: AppHandle, id: String) -> Result<Value, String> {
    let cwd = project_root(&app, &id)?;
    sync_last_commit_date(&app, &id, &cwd);
    let status_out = run_git(&["status", "--short"], &cwd)?;
    let branch = run_git(&["rev-parse", "--abbrev-ref", "HEAD"], &cwd)
        .unwrap_or_else(|_| "main".into());
    let lines: Vec<&str> = status_out.lines().filter(|l| l.len() >= 3).collect();
    // Porcelain format: XY <path> — X = staged state, Y = worktree state
    fn file<'a>(l: &&'a str) -> &'a str { l.get(3..).unwrap_or("").trim() }
    let modified:  Vec<&str> = lines.iter()
        .filter(|l| matches!(l.chars().nth(1), Some('M') | Some('D') | Some('T')))
        .map(file).collect();
    let untracked: Vec<&str> = lines.iter().filter(|l| l.starts_with("??")).map(file).collect();
    let staged:    Vec<&str> = lines.iter()
        .filter(|l| l.chars().next().map(|c| "MADRCT".contains(c)).unwrap_or(false))
        .map(file).collect();
    Ok(json!({ "branch": branch, "modified": modified, "untracked": untracked, "staged": staged, "clean": lines.is_empty(), "total": lines.len() }))
}

// Push to origin; if that fails with an auth-style error and a GitHub token is
// configured, retry with a token-authenticated URL so pushes work even when no
// system credential helper is set up.
fn push_with_auth_fallback(app: &AppHandle, id: &str, cwd: &str, branch: &str) -> Result<String, String> {
    match run_git(&["push", "origin", branch], cwd) {
        Ok(out) => Ok(out),
        Err(first_err) => {
            let token = crate::stored_github_token(app).unwrap_or_default();
            let gh = crate::get_project(app, id)
                .and_then(|p| p["github"].as_str().map(|s| s.to_string()))
                .unwrap_or_default();
            if token.is_empty() || gh.is_empty() {
                return Err(first_err);
            }
            let authed = format!("https://{}@github.com/{}.git", token, gh);
            // Scrub every error path, not just the retry's — the first
            // attempt uses the `origin` remote as configured, which could
            // itself have a token embedded outside Croco (e.g. a user-set
            // remote URL), and git sometimes echoes the remote URL back in
            // its own error text.
            let first_err = first_err.replace(&token, "***");
            run_git(&["push", &authed, &format!("HEAD:{}", branch)], cwd)
                .map_err(|e| e.replace(&token, "***"))
                .map_err(|e| format!("{} (token retry: {})", first_err, e))
        }
    }
}

// Pull from origin; if that fails (commonly because a private repo has no
// system credential helper configured, so plain `git pull` errors out
// instead of prompting) and a GitHub token is configured, retry with a
// token-authenticated URL — mirrors push_with_auth_fallback above.
fn pull_with_auth_fallback(app: &AppHandle, id: &str, cwd: &str, branch: &str) -> Result<String, String> {
    match run_git(&["pull", "origin", branch], cwd) {
        Ok(out) => Ok(out),
        Err(first_err) => {
            let token = crate::stored_github_token(app).unwrap_or_default();
            let gh = crate::get_project(app, id)
                .and_then(|p| p["github"].as_str().map(|s| s.to_string()))
                .unwrap_or_default();
            if token.is_empty() || gh.is_empty() {
                return Err(first_err);
            }
            let authed = format!("https://{}@github.com/{}.git", token, gh);
            let first_err = first_err.replace(&token, "***");
            run_git(&["pull", &authed, branch], cwd)
                .map_err(|e| e.replace(&token, "***"))
                .map_err(|e| format!("{} (token retry: {})", first_err, e))
        }
    }
}

// Fetch from origin with the same token fallback as pull/push. Used by
// git_get_ahead_behind — without this, a private repo with no credential
// helper silently fails the fetch, ahead/behind stays stuck at 0, and the
// Pull button in the UI stays permanently disabled even though the remote
// has new commits.
fn fetch_with_auth_fallback(app: &AppHandle, id: &str, cwd: &str) -> Result<String, String> {
    match run_git(&["fetch", "--quiet"], cwd) {
        Ok(out) => Ok(out),
        Err(first_err) => {
            let token = crate::stored_github_token(app).unwrap_or_default();
            let gh = crate::get_project(app, id)
                .and_then(|p| p["github"].as_str().map(|s| s.to_string()))
                .unwrap_or_default();
            if token.is_empty() || gh.is_empty() {
                return Err(first_err);
            }
            let authed = format!("https://{}@github.com/{}.git", token, gh);
            let first_err = first_err.replace(&token, "***");
            run_git(&["fetch", "--quiet", &authed], cwd)
                .map_err(|e| e.replace(&token, "***"))
                .map_err(|e| format!("{} (token retry: {})", first_err, e))
        }
    }
}

// Like run_git, but for `git diff` — exit code 1 just means "differences
// found" (not an error); only other codes are real failures.
fn run_git_diff(args: &[&str], cwd: &str) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.args(args).current_dir(cwd);
    crate::no_window(&mut cmd);
    let out = cmd.output().map_err(|e| e.to_string())?;
    match out.status.code() {
        Some(0) | Some(1) => Ok(String::from_utf8_lossy(&out.stdout).to_string()),
        _ => Err(String::from_utf8_lossy(&out.stderr).trim().to_string()),
    }
}

#[tauri::command]
pub async fn git_diff_file(app: AppHandle, id: String, path: String, kind: String) -> Result<Value, String> {
    let cwd = project_root(&app, &id)?;
    let diff = match kind.as_str() {
        "staged" => run_git_diff(&["diff", "--cached", "--", &path], &cwd)?,
        "untracked" => {
            // Untracked files have nothing in the index to diff against —
            // diff against the OS null device to get a normal unified diff
            // (all lines added) instead of a special-cased raw-content view.
            #[cfg(windows)]
            let null = "NUL";
            #[cfg(not(windows))]
            let null = "/dev/null";
            run_git_diff(&["diff", "--no-index", "--", null, &path], &cwd)?
        }
        _ => run_git_diff(&["diff", "--", &path], &cwd)?, // "modified"
    };
    Ok(json!({ "diff": diff }))
}

// Stage/unstage individual files — lets the UI offer selective staging
// instead of git_commit always sweeping in every change with `git add .`.
#[tauri::command]
pub async fn git_stage_files(app: AppHandle, id: String, paths: Vec<String>) -> Result<Value, String> {
    let cwd = project_root(&app, &id)?;
    if paths.is_empty() { return Ok(json!({ "ok": true })); }
    let mut args = vec!["add", "--"];
    args.extend(paths.iter().map(|p| p.as_str()));
    run_git(&args, &cwd)?;
    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub async fn git_unstage_files(app: AppHandle, id: String, paths: Vec<String>) -> Result<Value, String> {
    let cwd = project_root(&app, &id)?;
    if paths.is_empty() { return Ok(json!({ "ok": true })); }
    let mut args = vec!["reset", "--"];
    args.extend(paths.iter().map(|p| p.as_str()));
    run_git(&args, &cwd)?;
    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub async fn git_commit(app: AppHandle, id: String, msg: String) -> Result<Value, String> {
    let cwd     = project_root(&app, &id)?;
    let status  = git_status(app.clone(), id.clone()).await?;
    if status["clean"].as_bool().unwrap_or(false) {
        return Ok(json!({ "ok": false, "message": "Nothing to commit" }));
    }
    let message = msg.trim().to_string();
    if message.is_empty() { return Err("Commit message cannot be empty".into()); }
    // If the user has already staged specific files, commit exactly those.
    // Otherwise fall back to staging everything (preserves the one-click
    // "commit all" flow for anyone who doesn't bother with per-file staging).
    let has_staged = status["staged"].as_array().map(|a| !a.is_empty()).unwrap_or(false);
    if !has_staged {
        run_git(&["add", "."], &cwd)?;
    }
    run_git(&["commit", "-m", &message], &cwd)?;
    sync_last_commit_date(&app, &id, &cwd);
    let branch = status["branch"].as_str().unwrap_or("main").to_string();
    match push_with_auth_fallback(&app, &id, &cwd, &branch) {
        Ok(_) => {
            crate::activity_log(&app, "git.committed", json!({ "projectId": id, "message": message, "pushed": true }));
            crate::personality::track(&app, "commit", json!({ "projectId": id }));
            crate::emit_toast(&app, "Committed & pushed", &message, "success");
            Ok(json!({ "ok": true, "pushed": true }))
        }
        Err(e) => {
            crate::activity_log(&app, "git.committed", json!({ "projectId": id, "message": message, "pushed": false }));
            crate::personality::track(&app, "commit", json!({ "projectId": id }));
            crate::emit_toast(&app, "Committed (push failed)", &e, "warning");
            Ok(json!({ "ok": true, "pushed": false, "pushError": e }))
        }
    }
}

#[tauri::command]
pub async fn git_get_log(app: AppHandle, id: String, limit: Option<u32>) -> Result<Vec<Value>, String> {
    let cwd   = project_root(&app, &id)?;
    let limit = limit.unwrap_or(10);
    let out   = run_git(&["log", &format!("--oneline"), &format!("-{}", limit), "--format=%H|%s|%ar|%an"], &cwd)?;
    Ok(out.lines().filter(|l| !l.is_empty()).map(|line| {
        let parts: Vec<&str> = line.splitn(4, '|').collect();
        let hash    = parts.first().map(|h| &h[..h.len().min(7)]).unwrap_or("");
        let message = parts.get(1).unwrap_or(&"");
        let date    = parts.get(2).unwrap_or(&"");
        let author  = parts.get(3).unwrap_or(&"");
        json!({ "hash": hash, "message": message.trim(), "date": date, "author": author })
    }).collect())
}

#[tauri::command]
pub fn git_is_repo(root: String) -> bool {
    Path::new(&root).join(".git").exists()
}

#[tauri::command]
pub async fn git_get_branches(app: AppHandle, id: String) -> Result<Vec<Value>, String> {
    let cwd = project_root(&app, &id)?;
    let out = run_git(&["branch"], &cwd)?;
    Ok(out.lines().filter(|l| !l.trim().is_empty()).map(|b| {
        let current = b.starts_with('*');
        let name = b.trim_start_matches('*').trim().to_string();
        json!({ "name": name, "current": current })
    }).collect())
}

#[tauri::command]
pub async fn git_switch_branch(app: AppHandle, id: String, branch: String) -> Result<Value, String> {
    run_git(&["checkout", &branch], &project_root(&app, &id)?)?;
    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub async fn git_create_branch(app: AppHandle, id: String, branch: String) -> Result<Value, String> {
    run_git(&["checkout", "-b", &branch], &project_root(&app, &id)?)?;
    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub async fn git_push(app: AppHandle, id: String) -> Result<Value, String> {
    let cwd    = project_root(&app, &id)?;
    let status = git_status(app.clone(), id.clone()).await?;
    let branch = status["branch"].as_str().unwrap_or("main").to_string();
    match push_with_auth_fallback(&app, &id, &cwd, &branch) {
        Ok(_) => {
            let name = crate::get_project(&app, &id).and_then(|p| p["name"].as_str().map(|s| s.to_string())).unwrap_or_default();
            crate::emit_toast(&app, "Pushed to remote", &name, "success");
            Ok(json!({ "ok": true }))
        }
        Err(e) => Ok(json!({ "ok": false, "message": e }))
    }
}

#[tauri::command]
pub async fn git_get_readme(app: AppHandle, id: String) -> Result<Value, String> {
    let cwd = project_root(&app, &id)?;
    for name in &["README.md", "readme.md", "README.MD", "README", "readme.txt"] {
        let p = Path::new(&cwd).join(name);
        if p.exists() {
            let content = fs::read_to_string(&p).map_err(|e| e.to_string())?;
            return Ok(json!({ "ok": true, "content": content, "filename": name }));
        }
    }
    Ok(json!({ "ok": false, "content": null }))
}

#[tauri::command]
pub async fn git_pull(app: AppHandle, id: String) -> Result<Value, String> {
    let cwd = project_root(&app, &id)?;
    let status = git_status(app.clone(), id.clone()).await?;
    let branch = status["branch"].as_str().unwrap_or("main").to_string();
    let out = pull_with_auth_fallback(&app, &id, &cwd, &branch)?;
    crate::activity_log(&app, "git.pulled", json!({ "projectId": id }));
    Ok(json!({ "ok": true, "output": out }))
}

#[tauri::command]
pub async fn git_get_ahead_behind(app: AppHandle, id: String) -> Result<Value, String> {
    let cwd = project_root(&app, &id)?;
    if let Err(_) = fetch_with_auth_fallback(&app, &id, &cwd) {
        return Ok(json!({ "ahead": 0, "behind": 0, "unavailable": true }));
    }
    match run_git(&["rev-list", "--left-right", "--count", "HEAD...@{u}"], &cwd) {
        Ok(out) => {
            let parts: Vec<&str> = out.split('\t').collect();
            let ahead  = parts.first().and_then(|s| s.parse::<i64>().ok()).unwrap_or(0);
            let behind = parts.get(1).and_then(|s| s.parse::<i64>().ok()).unwrap_or(0);
            Ok(json!({ "ahead": ahead, "behind": behind }))
        }
        Err(_) => Ok(json!({ "ahead": 0, "behind": 0, "unavailable": true }))
    }
}

#[tauri::command]
pub async fn git_init_repo(app: AppHandle, id: String) -> Result<(), String> {
    crate::validate_safe_id(&id)?;
    let project = crate::get_project(&app, &id).ok_or("Project not found")?;
    let root = crate::project_root_str(&project);
    let settings = crate::read_settings(&app);
    let name  = settings["user"]["name"].as_str().unwrap_or("Developer").to_string();
    let email = settings["user"]["github"]["username"].as_str()
        .map(|u| format!("{}@users.noreply.github.com", u))
        .unwrap_or_else(|| "dev@example.com".to_string());
    crate::git_init(&root, &name, &email)?;
    crate::activity_log(&app, "git.init", json!({ "projectId": id }));
    Ok(())
}

#[tauri::command]
pub fn git_add_to_gitignore(app: AppHandle, id: String, entry: String) -> Result<(), String> {
    crate::validate_safe_id(&id)?;
    if entry.contains('\n') || entry.contains('\r') { return Err("Invalid gitignore entry".into()); }
    let project = crate::get_project(&app, &id).ok_or("Project not found")?;
    let root = crate::project_root_str(&project);
    let gi_path = Path::new(&root).join(".gitignore");
    let existing = fs::read_to_string(&gi_path).unwrap_or_default();
    if existing.lines().any(|l| l.trim() == entry.trim()) { return Ok(()); }
    let new = if existing.ends_with('\n') || existing.is_empty() {
        format!("{}{}\n", existing, entry)
    } else {
        format!("{}\n{}\n", existing, entry)
    };
    fs::write(&gi_path, new).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn projects_publish_to_github(
    app: AppHandle,
    id: String,
    repo_name: String,
    description: String,
    private: bool,
) -> Result<Value, String> {
    crate::validate_safe_id(&id)?;
    let settings = crate::read_settings(&app);
    let token = settings["user"]["github"]["token"].as_str().unwrap_or("").to_string();
    if token.is_empty() { return Err("No GitHub token — add one in Settings → User".into()); }

    let repo = crate::create_github_repo(&repo_name, private, &token).await?;
    let clone_url = repo["clone_url"].as_str().unwrap_or("").to_string();
    if clone_url.is_empty() { return Err("GitHub returned no clone URL".into()); }

    let project = crate::get_project(&app, &id).ok_or("Project not found")?;
    let root = crate::project_root_str(&project);

    // Init git if not already a repo
    let is_repo = {
        let mut c = Command::new("git");
        c.args(["rev-parse", "--is-inside-work-tree"]).current_dir(&root);
        crate::no_window(&mut c);
        c.output().map(|o| o.status.success()).unwrap_or(false)
    };
    if !is_repo {
        let name  = settings["user"]["name"].as_str().unwrap_or("Developer").to_string();
        let email = settings["user"]["github"]["username"].as_str()
            .map(|u| format!("{}@users.noreply.github.com", u))
            .unwrap_or_else(|| "dev@example.com".to_string());
        crate::git_init(&root, &name, &email)?;
    }

    // Set remote (add, or update if origin already exists) and push
    if run_git(&["remote", "add", "origin", &clone_url], &root).is_err() {
        run_git(&["remote", "set-url", "origin", &clone_url], &root)?;
    }

    // Push with an authenticated URL — reliable regardless of credential helpers
    let owner_repo = repo["full_name"].as_str()
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            let owner = repo["owner"]["login"].as_str().unwrap_or("");
            format!("{}/{}", owner, repo["name"].as_str().unwrap_or(&repo_name))
        });
    let authed = format!("https://{}@github.com/{}.git", token, owner_repo);
    run_git(&["push", "-u", &authed, "HEAD"], &root)
        .map_err(|e| e.replace(&token, "***"))?;
    // Point origin back at the clean URL (never persist the token on disk)
    run_git(&["remote", "set-url", "origin", &clone_url], &root).ok();

    // Update project with the linked repo ("owner/repo" — the format the rest
    // of the app uses for project.github)
    if let Some(mut p) = crate::get_project(&app, &id) {
        if let Value::Object(ref mut m) = p {
            m.insert("github".into(), json!(owner_repo));
            m.insert("githubUrl".into(), json!(repo["html_url"]));
            if !description.is_empty() {
                m.insert("description".into(), json!(description));
            }
        }
        crate::upsert_project(&app, p)?;
    }

    crate::activity_log(&app, "project.published", json!({ "projectId": id, "repo": repo_name }));
    Ok(json!({ "ok": true, "url": repo["html_url"] }))
}

#[tauri::command]
pub async fn git_get_all_recent_commits(app: AppHandle, limit: Option<u32>) -> Vec<Value> {
    let per = limit.unwrap_or(5) as usize;
    let projects = crate::projects_get_all(app);
    let mut all: Vec<(i64, Value)> = projects.iter()
        .filter(|p| !p["archived"].as_bool().unwrap_or(false))
        .filter_map(|p| {
            let root = crate::project_root_str(p);
            if root.is_empty() || !Path::new(&root).exists() { return None; }
            let id    = p["id"].as_str()?;
            let name  = p["name"].as_str().unwrap_or("Unknown");
            let emoji = p["emoji"].as_str().unwrap_or("📁");
            let out = run_git(&["log", &format!("-{}", per),
                "--format=%ct|%H|%s|%ar|%an"], &root).ok()?;
            let items: Vec<(i64, Value)> = out.lines().filter(|l| !l.is_empty()).filter_map(|line| {
                let parts: Vec<&str> = line.splitn(5, '|').collect();
                let ts  = parts.first().and_then(|s| s.parse::<i64>().ok()).unwrap_or(0);
                let hash    = parts.get(1).map(|h| &h[..h.len().min(7)]).unwrap_or("");
                let message = parts.get(2).copied().unwrap_or("");
                let date    = parts.get(3).copied().unwrap_or("");
                let author  = parts.get(4).copied().unwrap_or("");
                Some((ts, json!({
                    "hash": hash, "message": message.trim(), "date": date, "author": author,
                    "projectId": id, "projectName": name, "projectEmoji": emoji,
                })))
            }).collect();
            Some(items)
        })
        .flatten()
        .collect();
    all.sort_by(|a, b| b.0.cmp(&a.0));
    all.truncate(40);
    all.into_iter().map(|(_, v)| v).collect()
}

// Refreshes lastCommitAt for every tracked project from its real git log, so
// "Last commit" reflects reality across the app (Projects list, Favourites,
// ProjectDetail) even for commits made outside Croco (terminal, another IDE)
// — not just commits made through Croco's own commit UI. Called on Dashboard/
// Projects mount rather than per-project, since visiting a project's Git tab
// alone wouldn't reach projects the user hasn't opened yet.
#[tauri::command]
pub async fn git_sync_all_last_commit_dates(app: AppHandle) -> Result<Value, String> {
    let projects = crate::projects_get_all(app.clone());
    let mut synced = 0;
    for p in &projects {
        if p["archived"].as_bool().unwrap_or(false) { continue; }
        let root = crate::project_root_str(p);
        if root.is_empty() || !Path::new(&root).exists() { continue; }
        let Some(id) = p["id"].as_str() else { continue };
        if let Some(iso) = latest_commit_iso(&root) {
            let current = p["meta"]["lastCommitAt"].as_str();
            if current != Some(iso.as_str()) {
                let _ = crate::projects_edit(app.clone(), id.to_string(), json!({ "meta": { "lastCommitAt": iso } }));
                synced += 1;
            }
        }
    }
    Ok(json!({ "ok": true, "synced": synced }))
}

// ─── Tags & version-diffing (feeds the GitHub page's Releases and Changelog
// tabs) ──────────────────────────────────────────────────────────────────────

// Push a single tag to origin; same auth-fallback shape as
// push_with_auth_fallback above, but for a tag ref instead of a branch.
fn push_tag_with_auth_fallback(app: &AppHandle, id: &str, cwd: &str, tag_name: &str) -> Result<String, String> {
    let refspec = format!("refs/tags/{}", tag_name);
    match run_git(&["push", "origin", &refspec], cwd) {
        Ok(out) => Ok(out),
        Err(first_err) => {
            let token = crate::stored_github_token(app).unwrap_or_default();
            let gh = crate::get_project(app, id)
                .and_then(|p| p["github"].as_str().map(|s| s.to_string()))
                .unwrap_or_default();
            if token.is_empty() || gh.is_empty() {
                return Err(first_err);
            }
            let authed = format!("https://{}@github.com/{}.git", token, gh);
            run_git(&["push", &authed, &refspec], cwd)
                .map_err(|e| e.replace(&token, "***"))
                .map_err(|e| format!("{} (token retry: {})", first_err, e))
        }
    }
}

#[tauri::command]
pub async fn git_list_tags(app: AppHandle, id: String) -> Result<Vec<Value>, String> {
    let cwd = project_root(&app, &id)?;
    let out = run_git(&["tag", "-l", "--sort=-creatordate",
        "--format=%(refname:short)|%(creatordate:iso8601)"], &cwd)?;
    Ok(out.lines().filter(|l| !l.is_empty()).map(|line| {
        let parts: Vec<&str> = line.splitn(2, '|').collect();
        let name = parts.first().copied().unwrap_or("");
        let date = parts.get(1).copied().unwrap_or("");
        json!({ "name": name, "date": date })
    }).collect())
}

#[tauri::command]
pub async fn git_create_tag(app: AppHandle, id: String, tag_name: String, message: String) -> Result<Value, String> {
    let cwd  = project_root(&app, &id)?;
    let name = tag_name.trim();
    if name.is_empty() { return Err("Tag name cannot be empty".into()); }
    let msg = if message.trim().is_empty() { name.to_string() } else { message.trim().to_string() };
    run_git(&["tag", "-a", name, "-m", &msg], &cwd)?;
    match push_tag_with_auth_fallback(&app, &id, &cwd, name) {
        Ok(_) => {
            crate::activity_log(&app, "git.tag_created", json!({ "projectId": id, "tag": name }));
            crate::emit_toast(&app, "Tag created & pushed", name, "success");
            Ok(json!({ "ok": true, "pushed": true }))
        }
        Err(e) => {
            crate::activity_log(&app, "git.tag_created", json!({ "projectId": id, "tag": name }));
            crate::emit_toast(&app, "Tag created (push failed)", &e, "warning");
            Ok(json!({ "ok": true, "pushed": false, "pushError": e }))
        }
    }
}

#[tauri::command]
pub async fn git_get_commits_between(app: AppHandle, id: String, from_ref: Option<String>, to_ref: String) -> Result<Vec<Value>, String> {
    let cwd = project_root(&app, &id)?;
    let range = match from_ref.as_deref() {
        Some(f) if !f.is_empty() => format!("{}..{}", f, to_ref),
        _ => to_ref.clone(),
    };
    let out = run_git(&["log", &range, "--format=%H|%s|%ar|%an"], &cwd)?;
    Ok(out.lines().filter(|l| !l.is_empty()).map(|line| {
        let parts: Vec<&str> = line.splitn(4, '|').collect();
        let hash    = parts.first().map(|h| &h[..h.len().min(7)]).unwrap_or("");
        let message = parts.get(1).unwrap_or(&"");
        let date    = parts.get(2).unwrap_or(&"");
        let author  = parts.get(3).unwrap_or(&"");
        json!({ "hash": hash, "message": message.trim(), "date": date, "author": author })
    }).collect())
}

#[tauri::command]
pub async fn git_diff_between_refs(app: AppHandle, id: String, from_ref: String, to_ref: String) -> Result<Value, String> {
    let cwd = project_root(&app, &id)?;
    let range = format!("{}..{}", from_ref, to_ref);
    let diff = run_git_diff(&["diff", &range], &cwd)?;
    Ok(json!({ "diff": diff }))
}

// Plain YYYY-MM-DD commit dates for a single project — bucketed client-side
// by habitInsights.js into weekly/monthly/yearly trends for the GitHub page's
// Insights tab (per-project view; "Overall" instead reuses the already
// cross-project-aggregated commitDates from the personality profile).
#[tauri::command]
pub async fn git_get_commit_dates(app: AppHandle, id: String, limit: Option<u32>) -> Result<Vec<String>, String> {
    let cwd   = project_root(&app, &id)?;
    let limit = limit.unwrap_or(1000);
    let out   = run_git(&["log", &format!("-{}", limit), "--format=%cs"], &cwd)?;
    Ok(out.lines().filter(|l| !l.is_empty()).map(|s| s.to_string()).collect())
}
