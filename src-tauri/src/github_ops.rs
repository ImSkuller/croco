// GitHub REST API calls — repo metadata + releases for the GitHub page's
// Overview and Releases tabs. Distinct from git_ops.rs, which only shells out
// to the local `git` binary; everything here talks to api.github.com.

use serde_json::{json, Value};
use tauri::AppHandle;

fn owner_repo(app: &AppHandle, id: &str) -> Result<String, String> {
    crate::get_project(app, id)
        .and_then(|p| p["github"].as_str().map(|s| s.to_string()))
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "Project has no linked GitHub repository".to_string())
}

// GET a path under /repos/{owner}/{repo} — token attached only if one is
// configured (public repos work fine without it, just more rate-limited).
async fn github_get(app: &AppHandle, id: &str, path: &str) -> Result<Value, String> {
    let repo = owner_repo(app, id)?;
    let url = format!("https://api.github.com/repos/{}{}", repo, path);
    let client = reqwest::Client::new();
    let mut req = client.get(&url)
        .header("User-Agent", crate::UA)
        .header("Accept", "application/vnd.github.v3+json");
    if let Some(t) = crate::stored_github_token(app).filter(|t| !t.is_empty()) {
        req = req.header("Authorization", format!("token {}", t));
    }
    let resp = req.send().await.map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let body: Value = resp.json().await.unwrap_or(json!({}));
    if (200..300).contains(&status) {
        Ok(body)
    } else {
        let msg = body["message"].as_str().unwrap_or("GitHub API request failed").to_string();
        Err(format!("{} ({})", msg, status))
    }
}

// GitHub paginates list endpoints — a plain per_page=100 fetch silently caps
// out (and undercounts) for repos with more open PRs than that (not rare;
// e.g. octocat/Hello-World has several hundred). Instead fetch just 1 page
// item and read the last-page number off the response's `Link` header, the
// standard trick for getting an accurate total without downloading every page.
async fn count_open_prs(app: &AppHandle, id: &str) -> i64 {
    let Ok(repo) = owner_repo(app, id) else { return -1 };
    let url = format!("https://api.github.com/repos/{}/pulls?state=open&per_page=1", repo);
    let client = reqwest::Client::new();
    let mut req = client.get(&url)
        .header("User-Agent", crate::UA)
        .header("Accept", "application/vnd.github.v3+json");
    if let Some(t) = crate::stored_github_token(app).filter(|t| !t.is_empty()) {
        req = req.header("Authorization", format!("token {}", t));
    }
    let Ok(resp) = req.send().await else { return -1 };
    if !resp.status().is_success() { return -1 }
    let last_page = resp.headers().get("link")
        .and_then(|v| v.to_str().ok())
        .and_then(|link| link.split(',').find_map(|part| {
            if !part.contains("rel=\"last\"") { return None; }
            let start = part.find("page=")? + 5;
            let rest = &part[start..];
            let end = rest.find(|c: char| !c.is_ascii_digit()).unwrap_or(rest.len());
            rest[..end].parse::<i64>().ok()
        }));
    if let Some(last) = last_page { return last; }
    // No Link header means everything fit on one page.
    let body: Value = resp.json().await.unwrap_or(json!([]));
    body.as_array().map(|a| a.len() as i64).unwrap_or(-1)
}

#[tauri::command]
pub async fn github_get_repo_info(app: AppHandle, id: String) -> Result<Value, String> {
    let info = github_get(&app, &id, "").await?;
    // GitHub's open_issues_count includes open PRs — fetch PRs separately so
    // the UI can show accurate "issues" vs "PRs" counts instead of one
    // conflated number.
    let open_prs = count_open_prs(&app, &id).await;
    let open_issues_total = info["open_issues_count"].as_i64().unwrap_or(0);
    let open_issues = if open_prs >= 0 { (open_issues_total - open_prs).max(0) } else { open_issues_total };
    let visibility = info["visibility"].as_str().map(|s| s.to_string())
        .unwrap_or_else(|| if info["private"].as_bool().unwrap_or(false) { "private".into() } else { "public".into() });
    Ok(json!({
        "stars": info["stargazers_count"].as_i64().unwrap_or(0),
        "forks": info["forks_count"].as_i64().unwrap_or(0),
        "watchers": info["subscribers_count"].as_i64().unwrap_or(0),
        "openIssues": open_issues,
        "openPRs": open_prs,
        "defaultBranch": info["default_branch"].as_str().unwrap_or("main"),
        "license": info["license"]["name"].as_str(),
        "description": info["description"].as_str(),
        "language": info["language"].as_str(),
        "htmlUrl": info["html_url"].as_str().unwrap_or(""),
        "pushedAt": info["pushed_at"].as_str(),
        "visibility": visibility,
        "archived": info["archived"].as_bool().unwrap_or(false),
    }))
}

#[tauri::command]
pub async fn github_list_releases(app: AppHandle, id: String) -> Result<Vec<Value>, String> {
    let body = github_get(&app, &id, "/releases?per_page=30").await?;
    let arr = body.as_array().cloned().unwrap_or_default();
    Ok(arr.into_iter().map(|r| json!({
        "id": r["id"],
        "tagName": r["tag_name"],
        "name": r["name"],
        "body": r["body"],
        "draft": r["draft"].as_bool().unwrap_or(false),
        "prerelease": r["prerelease"].as_bool().unwrap_or(false),
        "htmlUrl": r["html_url"],
        "publishedAt": r["published_at"],
        "author": r["author"]["login"],
    })).collect())
}

#[tauri::command]
pub async fn github_create_release(
    app: AppHandle,
    id: String,
    tag_name: String,
    target: String,
    name: String,
    body: String,
    draft: bool,
    prerelease: bool,
) -> Result<Value, String> {
    let repo  = owner_repo(&app, &id)?;
    let token = crate::stored_github_token(&app).filter(|t| !t.is_empty())
        .ok_or("No GitHub token — add one in Settings → User")?;
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("https://api.github.com/repos/{}/releases", repo))
        .header("Authorization", format!("token {}", token))
        .header("User-Agent", crate::UA)
        .header("Accept", "application/vnd.github.v3+json")
        .json(&json!({
            "tag_name": tag_name,
            "target_commitish": target,
            "name": name,
            "body": body,
            "draft": draft,
            "prerelease": prerelease,
        }))
        .send().await.map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let response: Value = resp.json().await.unwrap_or(json!({}));
    if status != 201 {
        let msg = response["message"].as_str().unwrap_or("Failed to create release").to_string();
        return Err(msg);
    }
    // Best-effort: pull the new remote tag down locally so git_list_tags
    // reflects it immediately without a manual fetch.
    if let Ok(cwd) = crate::project_root(&app, &id) {
        crate::run_git(&["fetch", "--tags", "--quiet"], &cwd).ok();
    }
    crate::activity_log(&app, "github.release_created", json!({ "projectId": id, "tag": tag_name }));
    crate::emit_toast(&app, "Release published", &tag_name, "success");
    Ok(json!({ "ok": true, "url": response["html_url"] }))
}
