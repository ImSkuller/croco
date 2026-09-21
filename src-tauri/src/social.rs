// Desktop client for the social layer — thin Tauri-command wrappers over
// croco-server's REST API, mirroring entitlements.rs's exact pattern
// (same base URL, same cached session, no separate login). See
// docs/social/*.md for the phase plans and croco-server/docs/
// social_layer_v1_plan.md for the server-side design this calls into.
//
// Every command here just forwards to the server and lets its response
// be the source of truth — no local caching/business logic lives here,
// matching CLAUDE.md's "server is always the real gate" entitlements
// philosophy extended to social data.

use crate::entitlements::ensure_session_token;
use serde_json::{json, Value};
use tauri::AppHandle;

async fn authed_request(
    app: &AppHandle,
    method: reqwest::Method,
    path: &str,
    body: Option<Value>,
) -> Result<Value, String> {
    let token = ensure_session_token(app).await?;
    let client = reqwest::Client::new();
    let url = format!("{}{}", crate::ENTITLEMENTS_SERVER_URL, path);
    let mut req = client
        .request(method, &url)
        .header("Authorization", format!("Bearer {token}"))
        .timeout(std::time::Duration::from_secs(15));
    if let Some(b) = body {
        req = req.json(&b);
    }
    let resp = req.send().await.map_err(|e| e.to_string())?;
    let status = resp.status();
    let parsed: Value = resp.json().await.unwrap_or(json!({}));
    if status.is_success() {
        Ok(parsed)
    } else {
        Err(parsed["error"].as_str().unwrap_or("Request to the social server failed").to_string())
    }
}

async fn public_request(path: &str) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}{}", crate::ENTITLEMENTS_SERVER_URL, path);
    let resp = client.get(&url).timeout(std::time::Duration::from_secs(15)).send().await.map_err(|e| e.to_string())?;
    let status = resp.status();
    let parsed: Value = resp.json().await.unwrap_or(json!({}));
    if status.is_success() { Ok(parsed) } else { Err(parsed["error"].as_str().unwrap_or("Request failed").to_string()) }
}

// ─── Profile ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn social_get_me(app: AppHandle) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::GET, "/v1/me", None).await
}

#[tauri::command]
pub async fn social_update_me(app: AppHandle, display_name: Option<String>, bio: Option<String>) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::PATCH, "/v1/me", Some(json!({ "display_name": display_name, "bio": bio }))).await
}

#[tauri::command]
pub async fn social_set_field_visibility(app: AppHandle, field: String, visibility: String) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::POST, "/v1/me/visibility", Some(json!({ "field": field, "visibility": visibility }))).await
}

#[tauri::command]
pub async fn social_get_streak(app: AppHandle) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::GET, "/v1/me/streak", None).await
}

/// Opt-in only (settings.modules.social.streak.includeGithubActivity) —
/// the caller must check that setting before invoking this; it isn't
/// checked here since this file has no settings access, deliberately
/// mirroring server's own stance that this is a client-decided,
/// disclosable trade, not a default. Sends the same GitHub token already
/// used for entitlements — croco-server never persists it, only uses it
/// for this one check (see social.rs::github_streak_check server-side).
#[tauri::command]
pub async fn social_check_github_streak(app: AppHandle) -> Result<Value, String> {
    let github_token = crate::stored_github_token(&app)
        .ok_or("Not logged in with GitHub")?;
    authed_request(&app, reqwest::Method::POST, "/v1/me/streak/github-check", Some(json!({ "github_token": github_token }))).await
}

#[tauri::command]
pub async fn social_get_user_profile(app: AppHandle, login: String) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::GET, &format!("/v1/users/{login}"), None).await
}

#[tauri::command]
pub async fn social_get_user_posts(app: AppHandle, login: String) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::GET, &format!("/v1/users/{login}/posts"), None).await
}

// ─── Posts & attachments ─────────────────────────────────────────────

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn social_create_post(
    app: AppHandle,
    body_text: String,
    md_body: Option<String>,
    youtube_url: Option<String>,
    github_repo: Option<String>,
    visibility: Option<String>,
) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::POST, "/v1/posts", Some(json!({
        "body_text": body_text, "md_body": md_body, "youtube_url": youtube_url,
        "github_repo": github_repo, "visibility": visibility,
    }))).await
}

#[tauri::command]
pub async fn social_get_post(app: AppHandle, id: String) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::GET, &format!("/v1/posts/{id}"), None).await
}

#[tauri::command]
pub async fn social_delete_post(app: AppHandle, id: String) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::DELETE, &format!("/v1/posts/{id}"), None).await
}

#[tauri::command]
pub async fn social_like_post(app: AppHandle, id: String) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::POST, &format!("/v1/posts/{id}/like"), None).await
}

#[tauri::command]
pub async fn social_unlike_post(app: AppHandle, id: String) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::DELETE, &format!("/v1/posts/{id}/like"), None).await
}

#[tauri::command]
pub async fn social_vote_post(app: AppHandle, id: String, value: i64) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::POST, &format!("/v1/posts/{id}/vote"), Some(json!({ "value": value }))).await
}

#[tauri::command]
pub async fn social_unvote_post(app: AppHandle, id: String) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::DELETE, &format!("/v1/posts/{id}/vote"), None).await
}

#[tauri::command]
pub async fn social_share_post(app: AppHandle, id: String) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::POST, &format!("/v1/posts/{id}/share"), None).await
}

#[tauri::command]
pub async fn social_post_feedback(app: AppHandle, id: String, signal: String) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::POST, &format!("/v1/posts/{id}/feedback"), Some(json!({ "signal": signal }))).await
}

// ─── Comments ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn social_create_comment(app: AppHandle, post_id: String, body_text: String, parent_id: Option<String>) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::POST, &format!("/v1/posts/{post_id}/comments"), Some(json!({ "body_text": body_text, "parent_id": parent_id }))).await
}

#[tauri::command]
pub async fn social_list_comments(app: AppHandle, post_id: String) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::GET, &format!("/v1/posts/{post_id}/comments"), None).await
}

#[tauri::command]
pub async fn social_delete_comment(app: AppHandle, id: String) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::DELETE, &format!("/v1/comments/{id}"), None).await
}

// ─── Social graph ────────────────────────────────────────────────────

#[tauri::command]
pub async fn social_follow(app: AppHandle, login: String) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::POST, &format!("/v1/users/{login}/follow"), None).await
}

#[tauri::command]
pub async fn social_unfollow(app: AppHandle, login: String) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::DELETE, &format!("/v1/users/{login}/follow"), None).await
}

#[tauri::command]
pub async fn social_block(app: AppHandle, login: String) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::POST, &format!("/v1/users/{login}/block"), None).await
}

#[tauri::command]
pub async fn social_unblock(app: AppHandle, login: String) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::DELETE, &format!("/v1/users/{login}/block"), None).await
}

#[tauri::command]
pub async fn social_mute(app: AppHandle, login: String) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::POST, &format!("/v1/users/{login}/mute"), None).await
}

#[tauri::command]
pub async fn social_unmute(app: AppHandle, login: String) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::DELETE, &format!("/v1/users/{login}/mute"), None).await
}

// ─── Notifications ───────────────────────────────────────────────────

#[tauri::command]
pub async fn social_list_notifications(app: AppHandle) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::GET, "/v1/notifications", None).await
}

#[tauri::command]
pub async fn social_mark_notification_read(app: AppHandle, id: String) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::POST, &format!("/v1/notifications/{id}/read"), None).await
}

#[tauri::command]
pub async fn social_mark_all_notifications_read(app: AppHandle) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::POST, "/v1/notifications/read-all", None).await
}

// ─── Feed, search, discovery ───────────────────────────────────────────

#[tauri::command]
pub async fn social_get_feed(app: AppHandle, feed_type: String, sort: Option<String>, cursor: Option<String>) -> Result<Value, String> {
    let sort_qs = sort.map(|s| format!("&sort={s}")).unwrap_or_default();
    // Only the `following` feed's cursor is honored server-side today —
    // see FeedQuery::cursor's doc comment in croco-server/src/social.rs
    // for why the ranked discover feed isn't paginated the same way yet.
    let cursor_qs = cursor.map(|c| format!("&cursor={}", urlencoding::encode(&c))).unwrap_or_default();
    authed_request(&app, reqwest::Method::GET, &format!("/v1/feed?type={feed_type}{sort_qs}{cursor_qs}"), None).await
}

#[tauri::command]
pub async fn social_search(app: AppHandle, query: String, search_type: Option<String>) -> Result<Value, String> {
    let t = search_type.unwrap_or_else(|| "all".into());
    authed_request(&app, reqwest::Method::GET, &format!("/v1/search?q={}&type={t}", urlencoding::encode(&query)), None).await
}

#[tauri::command]
pub async fn social_suggested_users(app: AppHandle) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::GET, "/v1/discover/suggested-users", None).await
}

// ─── Moderation ──────────────────────────────────────────────────────

#[tauri::command]
pub async fn social_create_report(app: AppHandle, target_type: String, target_id: String, reason: String, detail: Option<String>) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::POST, "/v1/reports", Some(json!({
        "target_type": target_type, "target_id": target_id, "reason": reason, "detail": detail,
    }))).await
}

// ─── Launchpad ───────────────────────────────────────────────────────

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn social_create_launch(
    app: AppHandle,
    tagline: String,
    description: Option<String>,
    cover_image_url: Option<String>,
    category: String,
    github_repo: Option<String>,
    external_url: Option<String>,
) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::POST, "/v1/launches", Some(json!({
        "tagline": tagline, "description": description, "cover_image_url": cover_image_url,
        "category": category, "github_repo": github_repo, "external_url": external_url,
    }))).await
}

#[tauri::command]
pub async fn social_get_launch(app: AppHandle, id: String) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::GET, &format!("/v1/launches/{id}"), None).await
}

#[tauri::command]
pub async fn social_list_launches(app: AppHandle, sort: Option<String>) -> Result<Value, String> {
    let sort = sort.unwrap_or_else(|| "trending".into());
    authed_request(&app, reqwest::Method::GET, &format!("/v1/launches?sort={sort}"), None).await
}

#[tauri::command]
pub async fn social_upvote_launch(app: AppHandle, id: String) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::POST, &format!("/v1/launches/{id}/upvote"), None).await
}

#[tauri::command]
pub async fn social_create_launch_comment(app: AppHandle, launch_id: String, body_text: String, parent_id: Option<String>) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::POST, &format!("/v1/launches/{launch_id}/comments"), Some(json!({ "body_text": body_text, "parent_id": parent_id }))).await
}

#[tauri::command]
pub async fn social_list_launch_comments(app: AppHandle, launch_id: String) -> Result<Value, String> {
    authed_request(&app, reqwest::Method::GET, &format!("/v1/launches/{launch_id}/comments"), None).await
}

// ─── Public reads (unauthenticated — used by e.g. a future in-app
// "preview how my public profile looks" surface; the real public reader
// is the croco-website web surface, not this desktop client) ───────────

#[tauri::command]
pub async fn social_get_public_profile(login: String) -> Result<Value, String> {
    public_request(&format!("/v1/public/users/{login}")).await
}
