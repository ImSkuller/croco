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

// GitHub's /issues endpoint returns both issues AND pull requests (a PR is
// a superset of an issue in their data model) — distinguished only by the
// presence of a `pull_request` field. Filter those out so "Issues" doesn't
// silently double up with the dedicated /pulls list below.
#[tauri::command]
pub async fn github_list_issues(app: AppHandle, id: String, state: Option<String>) -> Result<Vec<Value>, String> {
    let state = state.unwrap_or_else(|| "open".to_string());
    let body = github_get(&app, &id, &format!("/issues?state={state}&per_page=30")).await?;
    let arr = body.as_array().cloned().unwrap_or_default();
    Ok(arr.into_iter()
        .filter(|i| i.get("pull_request").is_none())
        .map(|i| json!({
            "id": i["id"],
            "number": i["number"],
            "title": i["title"],
            "state": i["state"],
            "htmlUrl": i["html_url"],
            "author": i["user"]["login"],
            "createdAt": i["created_at"],
            "updatedAt": i["updated_at"],
            "comments": i["comments"],
            "labels": (i["labels"].as_array().cloned().unwrap_or_default())
                .into_iter().map(|l| json!({ "name": l["name"], "color": l["color"] })).collect::<Vec<_>>(),
        }))
        .collect())
}

#[tauri::command]
pub async fn github_list_pull_requests(app: AppHandle, id: String, state: Option<String>) -> Result<Vec<Value>, String> {
    let state = state.unwrap_or_else(|| "open".to_string());
    let body = github_get(&app, &id, &format!("/pulls?state={state}&per_page=30")).await?;
    let arr = body.as_array().cloned().unwrap_or_default();
    Ok(arr.into_iter().map(|p| json!({
        "id": p["id"],
        "number": p["number"],
        "title": p["title"],
        "state": p["state"],
        "draft": p["draft"].as_bool().unwrap_or(false),
        "merged": p["merged_at"].is_string(),
        "htmlUrl": p["html_url"],
        "author": p["user"]["login"],
        "createdAt": p["created_at"],
        "updatedAt": p["updated_at"],
        "baseBranch": p["base"]["ref"],
        "headBranch": p["head"]["ref"],
    })).collect())
}

#[tauri::command]
pub async fn github_create_issue(app: AppHandle, id: String, title: String, body: String) -> Result<Value, String> {
    let repo  = owner_repo(&app, &id)?;
    let title = title.trim().to_string();
    if title.is_empty() { return Err("Title is required".into()); }
    let token = crate::stored_github_token(&app).filter(|t| !t.is_empty())
        .ok_or("No GitHub token — add one in Settings → User")?;
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("https://api.github.com/repos/{}/issues", repo))
        .header("Authorization", format!("token {}", token))
        .header("User-Agent", crate::UA)
        .header("Accept", "application/vnd.github.v3+json")
        .json(&json!({ "title": title, "body": body }))
        .send().await.map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let response: Value = resp.json().await.unwrap_or(json!({}));
    if status != 201 {
        let msg = response["message"].as_str().unwrap_or("Failed to create issue").to_string();
        return Err(msg);
    }
    crate::activity_log(&app, "github.issue_created", json!({ "projectId": id, "number": response["number"] }));
    crate::emit_toast(&app, "Issue created", &title, "success");
    Ok(json!({ "ok": true, "url": response["html_url"], "number": response["number"] }))
}

#[tauri::command]
pub async fn github_set_issue_state(app: AppHandle, id: String, number: i64, state: String) -> Result<Value, String> {
    if state != "open" && state != "closed" { return Err("state must be open or closed".into()); }
    let repo  = owner_repo(&app, &id)?;
    let token = crate::stored_github_token(&app).filter(|t| !t.is_empty())
        .ok_or("No GitHub token — add one in Settings → User")?;
    let client = reqwest::Client::new();
    let resp = client
        .patch(format!("https://api.github.com/repos/{}/issues/{}", repo, number))
        .header("Authorization", format!("token {}", token))
        .header("User-Agent", crate::UA)
        .header("Accept", "application/vnd.github.v3+json")
        .json(&json!({ "state": state }))
        .send().await.map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let response: Value = resp.json().await.unwrap_or(json!({}));
    if status != 200 {
        return Err(response["message"].as_str().unwrap_or("Failed to update issue").to_string());
    }
    crate::activity_log(&app, "github.issue_state_changed", json!({ "projectId": id, "number": number, "state": state }));
    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub async fn github_comment_on_issue(app: AppHandle, id: String, number: i64, body: String) -> Result<Value, String> {
    let body = body.trim().to_string();
    if body.is_empty() { return Err("Comment cannot be empty".into()); }
    let repo  = owner_repo(&app, &id)?;
    let token = crate::stored_github_token(&app).filter(|t| !t.is_empty())
        .ok_or("No GitHub token — add one in Settings → User")?;
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("https://api.github.com/repos/{}/issues/{}/comments", repo, number))
        .header("Authorization", format!("token {}", token))
        .header("User-Agent", crate::UA)
        .header("Accept", "application/vnd.github.v3+json")
        .json(&json!({ "body": body }))
        .send().await.map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let response: Value = resp.json().await.unwrap_or(json!({}));
    if status != 201 {
        return Err(response["message"].as_str().unwrap_or("Failed to post comment").to_string());
    }
    crate::activity_log(&app, "github.comment_posted", json!({ "projectId": id, "number": number }));
    Ok(json!({ "ok": true, "url": response["html_url"] }))
}

#[tauri::command]
pub async fn github_close_pull_request(app: AppHandle, id: String, number: i64) -> Result<Value, String> {
    let repo  = owner_repo(&app, &id)?;
    let token = crate::stored_github_token(&app).filter(|t| !t.is_empty())
        .ok_or("No GitHub token — add one in Settings → User")?;
    let client = reqwest::Client::new();
    let resp = client
        .patch(format!("https://api.github.com/repos/{}/pulls/{}", repo, number))
        .header("Authorization", format!("token {}", token))
        .header("User-Agent", crate::UA)
        .header("Accept", "application/vnd.github.v3+json")
        .json(&json!({ "state": "closed" }))
        .send().await.map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let response: Value = resp.json().await.unwrap_or(json!({}));
    if status != 200 {
        return Err(response["message"].as_str().unwrap_or("Failed to close pull request").to_string());
    }
    crate::activity_log(&app, "github.pr_closed", json!({ "projectId": id, "number": number }));
    Ok(json!({ "ok": true }))
}

// merge_method: "merge" | "squash" | "rebase" — mirrors GitHub's own three
// options exactly, validated here rather than left to the API to reject.
#[tauri::command]
pub async fn github_merge_pull_request(app: AppHandle, id: String, number: i64, merge_method: String) -> Result<Value, String> {
    if !["merge", "squash", "rebase"].contains(&merge_method.as_str()) {
        return Err("merge_method must be merge, squash, or rebase".into());
    }
    let repo  = owner_repo(&app, &id)?;
    let token = crate::stored_github_token(&app).filter(|t| !t.is_empty())
        .ok_or("No GitHub token — add one in Settings → User")?;
    let client = reqwest::Client::new();
    let resp = client
        .put(format!("https://api.github.com/repos/{}/pulls/{}/merge", repo, number))
        .header("Authorization", format!("token {}", token))
        .header("User-Agent", crate::UA)
        .header("Accept", "application/vnd.github.v3+json")
        .json(&json!({ "merge_method": merge_method }))
        .send().await.map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let response: Value = resp.json().await.unwrap_or(json!({}));
    if status != 200 {
        let msg = response["message"].as_str().unwrap_or("Failed to merge pull request").to_string();
        return Err(msg);
    }
    crate::activity_log(&app, "github.pr_merged", json!({ "projectId": id, "number": number, "method": merge_method }));
    crate::emit_toast(&app, "Pull request merged", &format!("#{number}"), "success");
    Ok(json!({ "ok": true }))
}

// Every field the "new PR" modal needs — draft PRs need `draft: true`, and
// GitHub requires head/base branch names, not full refs.
#[tauri::command]
pub async fn github_create_pull_request(app: AppHandle, id: String, title: String, head: String, base: String, body: String, draft: bool) -> Result<Value, String> {
    let title = title.trim().to_string();
    if title.is_empty() { return Err("Title is required".into()); }
    let repo  = owner_repo(&app, &id)?;
    let token = crate::stored_github_token(&app).filter(|t| !t.is_empty())
        .ok_or("No GitHub token — add one in Settings → User")?;
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("https://api.github.com/repos/{}/pulls", repo))
        .header("Authorization", format!("token {}", token))
        .header("User-Agent", crate::UA)
        .header("Accept", "application/vnd.github.v3+json")
        .json(&json!({ "title": title, "head": head, "base": base, "body": body, "draft": draft }))
        .send().await.map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let response: Value = resp.json().await.unwrap_or(json!({}));
    if status != 201 {
        let msg = response["message"].as_str().unwrap_or("Failed to create pull request").to_string();
        return Err(msg);
    }
    crate::activity_log(&app, "github.pr_created", json!({ "projectId": id, "number": response["number"] }));
    crate::emit_toast(&app, "Pull request opened", &title, "success");
    Ok(json!({ "ok": true, "url": response["html_url"], "number": response["number"] }))
}

/// Recent GitHub Actions workflow runs (CI status) — read-only.
/// `conclusion` is null while a run is still queued/in progress.
#[tauri::command]
pub async fn github_list_workflow_runs(app: AppHandle, id: String, limit: Option<u32>) -> Result<Vec<Value>, String> {
    let limit = limit.unwrap_or(15).clamp(1, 50);
    let body = github_get(&app, &id, &format!("/actions/runs?per_page={limit}")).await?;
    let arr = body["workflow_runs"].as_array().cloned().unwrap_or_default();
    Ok(arr.into_iter().map(|r| json!({
        "id": r["id"],
        "name": r["name"],
        "displayTitle": r["display_title"],
        "status": r["status"],           // queued | in_progress | completed
        "conclusion": r["conclusion"],   // success | failure | cancelled | skipped | timed_out | null
        "branch": r["head_branch"],
        "event": r["event"],
        "runNumber": r["run_number"],
        "htmlUrl": r["html_url"],
        "createdAt": r["created_at"],
        "updatedAt": r["updated_at"],
        "headSha": r["head_sha"].as_str().map(|s| s.chars().take(7).collect::<String>()),
    })).collect())
}

// Each parameter is one field of the IPC payload the frontend sends for
// this command — grouping them into a struct would just move the same
// count into a nested object without reducing real complexity.
#[allow(clippy::too_many_arguments)]
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
