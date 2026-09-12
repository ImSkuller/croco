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
// gemini-1.5-* was retired in 2025; 2.0-flash is the GA equivalent and is
// also the first tier where Google's hosted search tool is plain
// `google_search` (1.5 used the older `google_search_retrieval` shape).
const GEMINI_MODEL: &str = "gemini-2.0-flash";

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

// ─── AI module chat (beta) — see docs/modules-plan.md ──────────────────────
//
// Shared by all four AI-page modes (Chat/Research/Plan/Code): one pipeline,
// mode-specific system prompt only. Conversation history lives in the
// Storage Brain (ai_brain.rs), not in any provider's own session — every
// call rebuilds it fresh via assemble_context, which is what makes
// switching the active provider mid-conversation lose nothing.

fn build_system_prompt(mode: &str, brain_context: &str) -> String {
    let mode_instruction = match mode {
        "research" => "You are in Research mode. Prioritize accuracy over speed — use web search when available rather than guessing at anything time-sensitive or uncertain, and say so when you're not sure.",
        "plan"     => "You are in Plan mode. Think in concrete, ordered steps. Surface trade-offs and risks; don't just produce a single confident plan when there's a real decision to be made.",
        "code"     => "You are in Code mode. Focus on the project's actual files and conventions from the context below rather than generic advice. Propose changes clearly enough that the user can review before applying them — never claim to have applied anything yourself.",
        _          => "You are in Chat mode — a general assistant with persistent memory of this user's projects and preferences.",
    };
    if brain_context.trim().is_empty() {
        format!("{mode_instruction}\n\nYou have no stored memories relevant to this yet.")
    } else {
        format!("{mode_instruction}\n\nRelevant context from the user's local memory (only the relevant, compressed subset — there is more on disk than this):\n\n{brain_context}")
    }
}

fn anthropic_role(role: &str) -> &str { if role == "assistant" { "assistant" } else { "user" } }
fn gemini_role(role: &str) -> &str { if role == "assistant" { "model" } else { "user" } }

async fn call_anthropic_chat(key: &str, system: &str, history: &[Value], web_search: bool) -> Result<String, String> {
    let messages: Vec<Value> = history.iter()
        .map(|m| json!({ "role": anthropic_role(m["role"].as_str().unwrap_or("user")), "content": m["text"].as_str().unwrap_or("") }))
        .collect();
    let mut body = json!({
        "model": ANTHROPIC_MODEL,
        "max_tokens": 1500,
        "system": system,
        "messages": messages,
    });
    if web_search {
        // Anthropic's server-side web search tool — verify this shape
        // against current API docs if it starts failing; tool schemas
        // like this have drifted before across model/API versions.
        body["tools"] = json!([{ "type": "web_search_20250305", "name": "web_search" }]);
    }
    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .header("User-Agent", crate::UA)
        .json(&body)
        .timeout(std::time::Duration::from_secs(60))
        .send()
        .await
        .map_err(|_| "Could not reach Anthropic's API.".to_string())?;
    let status = resp.status();
    let body: Value = resp.json().await.map_err(|_| "Anthropic returned an unreadable response.".to_string())?;
    if !status.is_success() {
        let msg = body["error"]["message"].as_str().unwrap_or("request failed");
        return Err(format!("Anthropic API error: {msg}"));
    }
    // With tool use, the response can contain multiple content blocks
    // (tool_use / tool_result / text interleaved) — concatenate every text
    // block rather than assuming index 0 is the whole reply.
    let text = body["content"].as_array()
        .map(|blocks| blocks.iter().filter_map(|b| b["text"].as_str()).collect::<Vec<_>>().join("\n"))
        .unwrap_or_default();
    if text.is_empty() { return Err("Anthropic's response didn't include a message.".into()); }
    Ok(text)
}

async fn call_openai_chat(key: &str, system: &str, history: &[Value], web_search: bool) -> Result<String, String> {
    let client = reqwest::Client::new();
    if web_search {
        // OpenAI's hosted web search only exists on the Responses API (Chat
        // Completions has no equivalent), so Research mode with web access
        // takes this path and everything else stays on chat/completions.
        // Same caveat as the Anthropic tool: verify `web_search_preview`
        // against current docs if it starts failing.
        let input: Vec<Value> = history.iter()
            .map(|m| json!({ "role": anthropic_role(m["role"].as_str().unwrap_or("user")), "content": m["text"].as_str().unwrap_or("") }))
            .collect();
        let resp = client
            .post("https://api.openai.com/v1/responses")
            .bearer_auth(key)
            .header("User-Agent", crate::UA)
            .json(&json!({ "model": OPENAI_MODEL, "instructions": system, "input": input, "tools": [{ "type": "web_search_preview" }] }))
            .timeout(std::time::Duration::from_secs(90))
            .send()
            .await
            .map_err(|_| "Could not reach OpenAI's API.".to_string())?;
        let status = resp.status();
        let body: Value = resp.json().await.map_err(|_| "OpenAI returned an unreadable response.".to_string())?;
        if !status.is_success() {
            let msg = body["error"]["message"].as_str().unwrap_or("request failed");
            return Err(format!("OpenAI API error: {msg}"));
        }
        // `output` interleaves web_search_call items with message items;
        // collect every output_text block from the message ones.
        let text = body["output"].as_array()
            .map(|items| items.iter()
                .filter(|i| i["type"] == "message")
                .flat_map(|i| i["content"].as_array().cloned().unwrap_or_default())
                .filter_map(|c| c["text"].as_str().map(str::to_string))
                .collect::<Vec<_>>()
                .join("\n"))
            .unwrap_or_default();
        if text.is_empty() { return Err("OpenAI's response didn't include a message.".into()); }
        return Ok(text);
    }
    let mut messages = vec![json!({ "role": "system", "content": system })];
    for m in history {
        messages.push(json!({ "role": anthropic_role(m["role"].as_str().unwrap_or("user")), "content": m["text"].as_str().unwrap_or("") }));
    }
    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(key)
        .header("User-Agent", crate::UA)
        .json(&json!({ "model": OPENAI_MODEL, "max_tokens": 1500, "messages": messages }))
        .timeout(std::time::Duration::from_secs(60))
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

async fn call_gemini_chat(key: &str, system: &str, history: &[Value], web_search: bool) -> Result<String, String> {
    let contents: Vec<Value> = history.iter()
        .map(|m| json!({ "role": gemini_role(m["role"].as_str().unwrap_or("user")), "parts": [{ "text": m["text"].as_str().unwrap_or("") }] }))
        .collect();
    let client = reqwest::Client::new();
    let url = format!("https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent");
    let resp = client
        .post(&url)
        .header("x-goog-api-key", key)
        .header("User-Agent", crate::UA)
        .json(&{
            let mut body = json!({
                "systemInstruction": { "parts": [{ "text": system }] },
                "contents": contents,
            });
            // Google's hosted search grounding — 2.0+ tool shape.
            if web_search { body["tools"] = json!([{ "google_search": {} }]); }
            body
        })
        .timeout(std::time::Duration::from_secs(60))
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

// Ollama runs entirely on the user's own machine (or LAN) — no key, no
// third party ever sees the request. Same chat-completions shape as the
// other providers' history mapping, just a different local endpoint.
async fn call_ollama_chat(host: &str, model: &str, system: &str, history: &[Value]) -> Result<String, String> {
    if model.is_empty() {
        return Err("No Ollama model selected — choose one in Settings → Modules → AI.".into());
    }
    let mut messages = vec![json!({ "role": "system", "content": system })];
    for m in history {
        messages.push(json!({ "role": anthropic_role(m["role"].as_str().unwrap_or("user")), "content": m["text"].as_str().unwrap_or("") }));
    }
    let client = reqwest::Client::new();
    let url = format!("{}/api/chat", host.trim_end_matches('/'));
    let resp = client
        .post(&url)
        .json(&json!({ "model": model, "messages": messages, "stream": false }))
        .timeout(std::time::Duration::from_secs(120))
        .send()
        .await
        .map_err(|_| format!("Could not reach Ollama at {host} — is it running? (`ollama serve`)"))?;
    let status = resp.status();
    let body: Value = resp.json().await.map_err(|_| "Ollama returned an unreadable response.".to_string())?;
    if !status.is_success() {
        let msg = body["error"].as_str().unwrap_or("request failed");
        return Err(format!("Ollama error: {msg}"));
    }
    body["message"]["content"].as_str()
        .map(str::to_string)
        .ok_or_else(|| "Ollama's response didn't include a message.".to_string())
}

/// Lists locally-installed Ollama models (`ollama pull`ed already) so the
/// Settings UI can offer a picker instead of a free-text model name.
#[tauri::command]
pub async fn ollama_list_models(host: String) -> Result<Vec<String>, String> {
    let host = if host.is_empty() { "http://localhost:11434".to_string() } else { host };
    let client = reqwest::Client::new();
    let url = format!("{}/api/tags", host.trim_end_matches('/'));
    let resp = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|_| format!("Could not reach Ollama at {host} — is it running? (`ollama serve`)"))?;
    if !resp.status().is_success() {
        return Err(format!("Ollama returned HTTP {}", resp.status()));
    }
    let body: Value = resp.json().await.map_err(|_| "Ollama returned an unreadable response.".to_string())?;
    Ok(body["models"].as_array()
        .map(|arr| arr.iter().filter_map(|m| m["name"].as_str().map(str::to_string)).collect())
        .unwrap_or_default())
}

#[tauri::command]
pub async fn ai_chat(app: AppHandle, mode: String, provider: String, project_id: Option<String>, conversation_id: String, message: String) -> Result<String, String> {
    let settings = crate::read_settings(&app);
    if !settings["modules"]["ai"]["enabled"].as_bool().unwrap_or(false) {
        return Err("The AI module is off — enable it in Settings → Modules.".into());
    }
    crate::validate_safe_id(&conversation_id)?;

    let web_access = settings["modules"]["ai"]["webAccess"]["enabled"].as_bool().unwrap_or(false);
    let brain_context = crate::assemble_context(&app, project_id.as_deref(), &message);
    let system_prompt = build_system_prompt(&mode, &brain_context);

    let mut outgoing = crate::brain_conversation_get(app.clone(), conversation_id.clone());
    outgoing.push(json!({ "role": "user", "text": message }));

    // Ollama is the one provider with no keyring key to look up — it's a
    // local server, gated only on module+enabled above.
    let reply = if provider == "ollama" {
        let ollama = &settings["modules"]["ai"]["ollama"];
        let host = ollama["host"].as_str().filter(|h| !h.is_empty()).unwrap_or("http://localhost:11434");
        let model = ollama["model"].as_str().unwrap_or("");
        call_ollama_chat(host, model, &system_prompt, &outgoing).await?
    } else {
        let key = crate::get_secret(&app, &format!("ai_key_{provider}"))
            .ok_or_else(|| format!("No API key set for {provider} — add one in Settings → AI."))?;
        let search = mode == "research" && web_access;
        match provider.as_str() {
            "anthropic" => call_anthropic_chat(&key, &system_prompt, &outgoing, search).await?,
            "openai"    => call_openai_chat(&key, &system_prompt, &outgoing, search).await?,
            "gemini"    => call_gemini_chat(&key, &system_prompt, &outgoing, search).await?,
            other => return Err(format!("Unknown AI provider: {other}")),
        }
    };

    crate::append_conversation(&app, &conversation_id, "user", &message);
    crate::append_conversation(&app, &conversation_id, "assistant", &reply);
    // Only when Croco isn't the foreground window — if the user is sitting
    // on the AI page watching, a desktop toast on top is just noise.
    let preview: String = reply.chars().take(120).collect();
    crate::notify_event(&app, "aiReply", "AI reply ready", &preview, true);
    crate::activity_log(&app, "ai.chat_message", json!({ "mode": mode, "provider": provider }));
    Ok(reply)
}
