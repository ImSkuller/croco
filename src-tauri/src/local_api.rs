// Local HTTP API (Phase 6 item 7) — lets an editor extension or a shell
// script drive a *running* Croco instance: list/create projects, notes and
// todos, start/stop a project's run command. Strictly opt-in
// (settings.api.enabled, default false), loopback-only (never binds
// anything but 127.0.0.1 — there is no setting to change that), and every
// route but /health requires `Authorization: Bearer <token>` where the
// token is a 32-byte random value minted on first enable and stored in the
// OS keyring under "local_api_token" (see secrets.rs) — never in
// settings.json, never logged.
//
// This is deliberately a hand-rolled minimal HTTP/1.1 server over
// `tokio::net::TcpListener` rather than pulling in axum/warp/hyper: tokio's
// "full" feature set (networking included) is already a dependency for
// Tauri itself, so this adds zero new crates for what is a handful of
// simple JSON routes — see CLAUDE.md's "keep the binary small" rule. No
// keep-alive, no chunked transfer-encoding, no CORS headers: each
// connection handles exactly one request and closes, and the deliberate
// absence of CORS headers means a browser tab on some other site can never
// read a response even if it could get a request to fire (the classic
// "malicious webpage hits your localhost dev server" attack this guards
// against by simply never opting in to being readable cross-origin).

use once_cell::sync::Lazy;
use serde_json::{json, Value};
use std::sync::{Mutex, PoisonError};
use tauri::AppHandle;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};

const MAX_HEADER_BYTES: usize = 8 * 1024;
const MAX_BODY_BYTES: usize = 1024 * 1024;
const REQUEST_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);

static SERVER_TASK: Lazy<Mutex<Option<tauri::async_runtime::JoinHandle<()>>>> = Lazy::new(|| Mutex::new(None));
// Separate from SERVER_TASK: that holds a handle the instant a task is
// spawned, before it has actually bound the port, so it can't answer "is a
// listener really up" on its own — this flips true only after a real
// successful bind (see run_server) and back to false on stop/bind failure.
static SERVER_RUNNING: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));

fn set_running(v: bool) { *SERVER_RUNNING.lock().unwrap_or_else(PoisonError::into_inner) = v; }

fn stop_running_server() {
    if let Some(handle) = SERVER_TASK.lock().unwrap_or_else(PoisonError::into_inner).take() {
        handle.abort();
    }
    set_running(false);
}

/// Reflects live state (a bound listener actually running), not just the
/// `api.enabled` setting — the two can disagree if the configured port was
/// already taken by something else (see run_server's bind failure path).
pub fn local_api_is_running() -> bool {
    *SERVER_RUNNING.lock().unwrap_or_else(PoisonError::into_inner)
}

// Plain equality on token strings would short-circuit on the first
// mismatched byte, which leaks timing information about how many
// characters were guessed correctly. Loopback-only makes this a fairly
// low-value target, but the fix costs nothing.
fn tokens_match(a: &str, b: &str) -> bool {
    if a.len() != b.len() { return false; }
    let mut diff = 0u8;
    for (x, y) in a.bytes().zip(b.bytes()) { diff |= x ^ y; }
    diff == 0
}

fn generate_token() -> String {
    let bytes: [u8; 32] = aes_gcm::aead::Generate::generate();
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

struct ParsedRequest {
    method: String,
    path: String,
    query: std::collections::HashMap<String, String>,
    auth_header: Option<String>,
    body: Vec<u8>,
}

fn parse_query(raw: &str) -> std::collections::HashMap<String, String> {
    raw.split('&')
        .filter(|s| !s.is_empty())
        .filter_map(|pair| {
            let mut it = pair.splitn(2, '=');
            let k = it.next()?;
            let v = it.next().unwrap_or("");
            Some((
                urlencoding::decode(k).ok()?.into_owned(),
                urlencoding::decode(v).ok()?.into_owned(),
            ))
        })
        .collect()
}

async fn read_request(stream: &mut TcpStream) -> Option<ParsedRequest> {
    let mut reader = BufReader::new(stream);
    let mut line = String::new();
    let mut total_header_bytes = 0usize;

    if reader.read_line(&mut line).await.ok()? == 0 { return None; }
    total_header_bytes += line.len();
    let mut parts = line.trim_end().splitn(3, ' ');
    let method = parts.next()?.to_string();
    let full_path = parts.next()?.to_string();
    let (path, query_str) = match full_path.split_once('?') {
        Some((p, q)) => (p.to_string(), q.to_string()),
        None => (full_path, String::new()),
    };

    let mut content_length = 0usize;
    let mut auth_header = None;
    loop {
        let mut hline = String::new();
        let n = reader.read_line(&mut hline).await.ok()?;
        if n == 0 { return None; }
        total_header_bytes += n;
        if total_header_bytes > MAX_HEADER_BYTES { return None; }
        let trimmed = hline.trim_end();
        if trimmed.is_empty() { break; }
        if let Some((k, v)) = trimmed.split_once(':') {
            let k = k.trim().to_ascii_lowercase();
            let v = v.trim().to_string();
            match k.as_str() {
                "content-length" => content_length = v.parse().unwrap_or(0),
                "authorization" => auth_header = Some(v),
                _ => {}
            }
        }
    }

    if content_length > MAX_BODY_BYTES { return None; }
    let mut body = vec![0u8; content_length];
    if content_length > 0 && reader.read_exact(&mut body).await.is_err() { return None; }

    Some(ParsedRequest { method, path, query: parse_query(&query_str), auth_header, body })
}

async fn write_json(stream: &mut TcpStream, status: u16, status_text: &str, body: &Value) {
    let payload = serde_json::to_vec(body).unwrap_or_default();
    let head = format!(
        "HTTP/1.1 {status} {status_text}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        payload.len()
    );
    let _ = stream.write_all(head.as_bytes()).await;
    let _ = stream.write_all(&payload).await;
    let _ = stream.shutdown().await;
}

fn err(msg: impl Into<String>) -> Value { json!({ "error": msg.into() }) }

async fn handle_connection(mut stream: TcpStream, app: AppHandle, token: String) {
    let req = match tokio::time::timeout(REQUEST_TIMEOUT, read_request(&mut stream)).await {
        Ok(Some(r)) => r,
        _ => { write_json(&mut stream, 400, "Bad Request", &err("Malformed request")).await; return; }
    };

    let segments: Vec<&str> = req.path.trim_matches('/').split('/').filter(|s| !s.is_empty()).collect();

    if req.method == "GET" && segments == ["health"] {
        write_json(&mut stream, 200, "OK", &json!({ "ok": true, "version": env!("CARGO_PKG_VERSION") })).await;
        return;
    }

    let provided = req.auth_header.as_deref().and_then(|h| h.strip_prefix("Bearer "));
    let authorized = provided.map(|p| tokens_match(p, &token)).unwrap_or(false);
    if !authorized {
        write_json(&mut stream, 401, "Unauthorized", &err("Missing or invalid Authorization: Bearer <token>")).await;
        return;
    }

    let result: Result<Value, (u16, String)> = route(&app, &req, &segments).await;
    match result {
        Ok(v) => write_json(&mut stream, 200, "OK", &v).await,
        Err((404, msg)) => write_json(&mut stream, 404, "Not Found", &err(msg)).await,
        Err((_, msg)) => write_json(&mut stream, 400, "Bad Request", &err(msg)).await,
    }
}

async fn route(app: &AppHandle, req: &ParsedRequest, segments: &[&str]) -> Result<Value, (u16, String)> {
    match (req.method.as_str(), segments) {
        ("GET", ["projects"]) => Ok(json!(crate::projects_get_all(app.clone()))),
        ("GET", ["projects", id]) => crate::projects_get_by_id(app.clone(), id.to_string())
            .ok_or((404, format!("Project {id} not found"))),

        ("GET", ["notes"]) => {
            let project_id = req.query.get("projectId").cloned();
            Ok(json!(crate::notes_get_all(app.clone(), project_id)))
        }
        ("POST", ["notes"]) => {
            let data: Value = serde_json::from_slice(&req.body).map_err(|e| (400, format!("Invalid JSON body: {e}")))?;
            crate::notes_create(app.clone(), data).map_err(|e| (400, e))
        }

        ("GET", ["todos"]) => {
            let project_id = req.query.get("projectId").cloned();
            Ok(json!(crate::todos_get_all(app.clone(), project_id)))
        }
        ("POST", ["todos"]) => {
            let data: Value = serde_json::from_slice(&req.body).map_err(|e| (400, format!("Invalid JSON body: {e}")))?;
            crate::todos_create(app.clone(), data).map_err(|e| (400, e))
        }
        ("POST", ["todos", id, "toggle"]) => crate::todos_toggle(app.clone(), id.to_string()).map_err(|e| (400, e)),

        ("POST", ["run", project_id, "stop"]) => {
            crate::run_stop(project_id.to_string()).await.map_err(|e| (400, e))
        }
        ("POST", ["run", project_id, command_type]) => {
            crate::run_start(app.clone(), project_id.to_string(), command_type.to_string(), None, Some(true))
                .await
                .map_err(|e| (400, e))
        }
        ("GET", ["run", project_id]) => Ok(json!({ "running": crate::run_is_running(project_id.to_string()) })),

        _ => Err((404, format!("No route for {} {}", req.method, req.path))),
    }
}

async fn run_server(app: AppHandle, port: u16, token: String) {
    let listener = match TcpListener::bind(("127.0.0.1", port)).await {
        Ok(l) => l,
        Err(e) => {
            crate::emit_toast(&app, "Local API failed to start", &format!("Port {port}: {e}"), "error");
            return;
        }
    };
    set_running(true);
    crate::activity_log(&app, "settings.local_api_started", json!({ "port": port }));
    loop {
        let Ok((stream, _)) = listener.accept().await else { continue };
        let app = app.clone();
        let token = token.clone();
        tauri::async_runtime::spawn(async move {
            handle_connection(stream, app, token).await;
        });
    }
}

/// Applies the current settings.api.{enabled,port}: stops any running
/// server, and if enabled, mints a token (if one doesn't already exist)
/// and starts a fresh listener on the configured port. Called once at
/// startup (if enabled) and again every time the UI changes either field,
/// so toggling it on/off or changing the port never needs an app restart.
#[tauri::command]
pub async fn local_api_apply(app: AppHandle) -> Result<Value, String> {
    stop_running_server();

    let settings = crate::read_settings(&app);
    let enabled = settings["api"]["enabled"].as_bool().unwrap_or(false);
    let port = settings["api"]["port"].as_u64().unwrap_or(3131) as u16;
    if !enabled {
        return Ok(json!({ "running": false }));
    }

    let mut token_just_generated = None;
    let token = match crate::get_secret(&app, "local_api_token") {
        Some(t) => t,
        None => {
            let t = generate_token();
            crate::set_secret(&app, "local_api_token", &t)?;
            token_just_generated = Some(t.clone());
            t
        }
    };

    let handle = tauri::async_runtime::spawn(run_server(app.clone(), port, token));
    *SERVER_TASK.lock().unwrap_or_else(PoisonError::into_inner) = Some(handle);

    Ok(json!({ "running": true, "port": port, "tokenJustGenerated": token_just_generated }))
}

#[tauri::command]
pub async fn local_api_regenerate_token(app: AppHandle) -> Result<String, String> {
    let token = generate_token();
    crate::set_secret(&app, "local_api_token", &token)?;
    // Restart so the already-running listener picks up the new token
    // immediately instead of continuing to accept the old one.
    local_api_apply(app).await?;
    Ok(token)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokens_match_identical_strings() {
        assert!(tokens_match("abc123", "abc123"));
    }

    #[test]
    fn tokens_match_rejects_different_strings_of_the_same_length() {
        assert!(!tokens_match("abc123", "abc124"));
    }

    #[test]
    fn tokens_match_rejects_different_lengths_without_panicking() {
        assert!(!tokens_match("short", "a-lot-longer-string"));
        assert!(!tokens_match("", "nonempty"));
    }

    #[test]
    fn tokens_match_treats_two_empty_strings_as_equal() {
        assert!(tokens_match("", ""));
    }

    #[test]
    fn generate_token_produces_64_lowercase_hex_chars() {
        let t = generate_token();
        assert_eq!(t.len(), 64);
        assert!(t.chars().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase()));
    }

    #[test]
    fn generate_token_is_not_deterministic() {
        assert_ne!(generate_token(), generate_token());
    }

    #[test]
    fn parse_query_decodes_and_splits_pairs() {
        let q = parse_query("projectId=abc%20123&other=1");
        assert_eq!(q.get("projectId"), Some(&"abc 123".to_string()));
        assert_eq!(q.get("other"), Some(&"1".to_string()));
    }

    #[test]
    fn parse_query_on_empty_string_is_empty() {
        assert!(parse_query("").is_empty());
    }
}
