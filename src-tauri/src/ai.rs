// AI-generated commit messages (Phase 6 item 6) — strictly opt-in: gated on
// settings.ai.commitMessages.enabled, and only reachable at all once the
// user has pasted a key for their chosen provider (settings_set_ai_key,
// src-tauri/src/settings.rs). The key never leaves the OS keyring except to
// be sent, over HTTPS, directly to that provider's own API — never logged,
// never persisted anywhere else. The generated message is handed back to
// the UI for the user to review/edit before it's ever used in a commit;
// nothing here commits on its own.

use serde_json::{json, Value};
use tauri::AppHandle;

const ANTHROPIC_MODEL: &str = "claude-3-5-haiku-20241022";
const OPENAI_MODEL: &str = "gpt-4o-mini";
const GEMINI_MODEL: &str = "gemini-1.5-flash";

fn build_prompt(diff: &str) -> String {
    format!(
        "You write git commit messages. Given the diff below, output ONLY the commit \
         message text — no quotes, no markdown fences, no explanation. Prefer a single \
         summary line under 72 characters; add a blank line and a couple of short bullet \
         points only if the diff genuinely spans multiple unrelated changes.\n\n\
         Diff:\n{diff}"
    )
}

// Provider responses come back with surrounding whitespace and, sometimes,
// wrapping quotes or a markdown fence a model added despite the prompt —
// strip those defensively rather than trust every provider/model to comply.
fn clean_message(raw: &str) -> String {
    let mut s = raw.trim().to_string();
    for fence in ["```\n", "```"] {
        if s.starts_with(fence) { s = s[fence.len()..].to_string(); }
        if s.ends_with(fence) { s.truncate(s.len() - fence.len()); }
    }
    let s = s.trim();
    let s = s.strip_prefix('"').and_then(|s| s.strip_suffix('"')).unwrap_or(s);
    s.trim().to_string()
}

async fn call_anthropic(key: &str, prompt: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .header("User-Agent", crate::UA)
        .json(&json!({
            "model": ANTHROPIC_MODEL,
            "max_tokens": 200,
            "messages": [{ "role": "user", "content": prompt }],
        }))
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|_| "Could not reach Anthropic's API.".to_string())?;

    let status = resp.status();
    let body: Value = resp.json().await.map_err(|_| "Anthropic returned an unreadable response.".to_string())?;
    if !status.is_success() {
        let msg = body["error"]["message"].as_str().unwrap_or("request failed");
        return Err(format!("Anthropic API error: {msg}"));
    }
    body["content"][0]["text"].as_str()
        .map(str::to_string)
        .ok_or_else(|| "Anthropic's response didn't include a message.".to_string())
}

async fn call_openai(key: &str, prompt: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(key)
        .header("User-Agent", crate::UA)
        .json(&json!({
            "model": OPENAI_MODEL,
            "max_tokens": 200,
            "messages": [{ "role": "user", "content": prompt }],
        }))
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|_| "Could not reach OpenAI's API.".to_string())?;

    let status = resp.status();
    let body: Value = resp.json().await.map_err(|_| "OpenAI returned an unreadable response.".to_string())?;
    if !status.is_success() {
        let msg = body["error"]["message"].as_str().unwrap_or("request failed");
        return Err(format!("OpenAI API error: {msg}"));
    }
    body["choices"][0]["message"]["content"].as_str()
        .map(str::to_string)
        .ok_or_else(|| "OpenAI's response didn't include a message.".to_string())
}

async fn call_gemini(key: &str, prompt: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent");
    let resp = client
        .post(&url)
        .header("x-goog-api-key", key)
        .header("User-Agent", crate::UA)
        .json(&json!({
            "contents": [{ "parts": [{ "text": prompt }] }],
        }))
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|_| "Could not reach Gemini's API.".to_string())?;

    let status = resp.status();
    let body: Value = resp.json().await.map_err(|_| "Gemini returned an unreadable response.".to_string())?;
    if !status.is_success() {
        let msg = body["error"]["message"].as_str().unwrap_or("request failed");
        return Err(format!("Gemini API error: {msg}"));
    }
    body["candidates"][0]["content"]["parts"][0]["text"].as_str()
        .map(str::to_string)
        .ok_or_else(|| "Gemini's response didn't include a message.".to_string())
}

#[tauri::command]
pub async fn ai_generate_commit_message(app: AppHandle, id: String) -> Result<String, String> {
    let settings = crate::read_settings(&app);
    let enabled = settings["ai"]["commitMessages"]["enabled"].as_bool().unwrap_or(false);
    if !enabled {
        return Err("AI commit messages are turned off — enable them in Settings → AI first.".into());
    }
    let provider = settings["ai"]["commitMessages"]["provider"].as_str().unwrap_or("anthropic").to_string();
    let key = crate::get_secret(&app, &format!("ai_key_{provider}"))
        .ok_or_else(|| format!("No API key set for {provider} — add one in Settings → AI."))?;

    let diff = crate::build_commit_diff(&app, &id).await?;
    let prompt = build_prompt(&diff);

    let raw = match provider.as_str() {
        "anthropic" => call_anthropic(&key, &prompt).await?,
        "openai" => call_openai(&key, &prompt).await?,
        "gemini" => call_gemini(&key, &prompt).await?,
        other => return Err(format!("Unknown AI provider: {other}")),
    };

    let message = clean_message(&raw);
    if message.is_empty() {
        return Err("The model returned an empty message — try again.".into());
    }
    crate::activity_log(&app, "git.ai_commit_message_generated", json!({ "projectId": id, "provider": provider }));
    Ok(message)
}
