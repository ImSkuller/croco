// Discord module (v2.0, beta) — see docs/modules-plan.md. Two independent
// pieces gated behind settings.modules.discord.{richPresence,webhook}.enabled,
// both off unless the user turns the module on in Settings → Modules:
//
// - Rich Presence: a local IPC connection to the user's own running Discord
//   client (no bot, no OAuth, nothing server-side) that shows "Editing
//   <project>" on their profile while Croco is open.
// - Webhooks: fire-and-forget POSTs to a user-supplied Discord webhook URL
//   on a few real events (push, todo completed, project created).
//
// Both must degrade silently — Discord not running, or no webhook URL set,
// are normal states for most users, never a toast-worthy error (same rule
// entitlements.rs follows for its own free-tier degrade path).

use once_cell::sync::Lazy;
use serde_json::{json, Value};
use std::sync::Mutex;
use tauri::AppHandle;

use discord_rich_presence::activity::{Activity, Assets, Button, Timestamps};
use discord_rich_presence::{DiscordIpc, DiscordIpcClient};

// Croco's own Discord application — the same one for every install/user,
// not something each person registers for themselves. Everyone should see
// the same "Croco" identity (name + icon) in Rich Presence, not a Discord
// application they had to go create.
const DISCORD_CLIENT_ID: &str = "1548412009119358997";

static RPC_CLIENT: Lazy<Mutex<Option<DiscordIpcClient>>> = Lazy::new(|| Mutex::new(None));
// Set once per connection (not per activity update) so the "elapsed time"
// Discord shows counts from when Croco connected, not from the last project
// switch.
static CONNECTED_AT: Lazy<Mutex<Option<i64>>> = Lazy::new(|| Mutex::new(None));

fn modules_discord(app: &AppHandle) -> Value {
    crate::read_settings(app)["modules"]["discord"].clone()
}

fn rich_presence_enabled(app: &AppHandle) -> bool {
    let d = modules_discord(app);
    d["enabled"].as_bool().unwrap_or(false) && d["richPresence"]["enabled"].as_bool().unwrap_or(false)
}

fn webhook_enabled(app: &AppHandle) -> bool {
    let d = modules_discord(app);
    d["enabled"].as_bool().unwrap_or(false) && d["webhook"]["enabled"].as_bool().unwrap_or(false)
}

// Connects lazily on first activity update rather than at app launch — most
// users will never enable this module, so there's no reason to touch
// Discord's IPC socket unless/until it's actually needed. Silently returns
// Err (never panics) when Discord isn't running locally; callers treat that
// as a no-op, not a surfaced error.
fn ensure_connected() -> Result<(), String> {
    let mut guard = RPC_CLIENT.lock().unwrap_or_else(|e| e.into_inner());
    if guard.is_some() {
        return Ok(());
    }
    let mut client = DiscordIpcClient::new(DISCORD_CLIENT_ID).map_err(|e| e.to_string())?;
    client.connect().map_err(|e| e.to_string())?;
    *guard = Some(client);
    *CONNECTED_AT.lock().unwrap_or_else(|e| e.into_inner()) = Some(chrono::Utc::now().timestamp());
    Ok(())
}

fn disconnect_locked() {
    let mut guard = RPC_CLIENT.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(mut client) = guard.take() {
        let _ = client.close();
    }
    *CONNECTED_AT.lock().unwrap_or_else(|e| e.into_inner()) = None;
}

/// Sets the two-line Rich Presence text — `details` (top line, what the
/// user is doing: "Editing Croco", "Using the IDE", "Idle", ...) and
/// `state` (second line, further detail: a tab name, an open file, an AI
/// mode, ...). The frontend owns all of the "what page/context am I in"
/// logic (see `useDiscordPresence` + `DiscordPresenceManager`, which also
/// handles idle detection) — this command just relays whatever it's given
/// to Discord. A silent no-op (Ok) whenever the module/sub-toggle is off
/// or Discord isn't reachable — Rich Presence is cosmetic, never worth an
/// error toast.
///
/// `github_url` (the project's real html_url, not the "owner/repo" string
/// — see project.githubUrl) adds a "View on GitHub" button when present.
/// Discord never shows a viewer their own activity's buttons back to
/// them — only other people looking at the profile see it — so this is
/// unverifiable by testing solo; that's a Discord client behavior, not a
/// bug here.
#[tauri::command]
pub async fn discord_set_presence(app: AppHandle, details: String, state: Option<String>, github_url: Option<String>) -> Result<(), String> {
    if !rich_presence_enabled(&app) {
        return Ok(());
    }
    tauri::async_runtime::spawn_blocking(move || {
        if ensure_connected().is_err() {
            return; // Discord not running — nothing to do
        }
        let started_at = CONNECTED_AT.lock().unwrap_or_else(|e| e.into_inner()).unwrap_or_else(|| chrono::Utc::now().timestamp());
        let mut guard = RPC_CLIENT.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(client) = guard.as_mut() {
            let mut activity = Activity::new()
                .details(&details)
                .timestamps(Timestamps::new().start(started_at))
                .assets(Assets::new().large_image("croco_logo").large_text("Croco"));
            if let Some(s) = state.as_deref().filter(|s| !s.is_empty()) {
                activity = activity.state(s);
            }
            if let Some(url) = github_url.as_deref().filter(|u| !u.is_empty()) {
                activity = activity.buttons(vec![Button::new("View on GitHub", url)]);
            }
            // A failed set_activity almost always means the connection died
            // underneath us (Discord closed) — drop it so the next call
            // reconnects from scratch instead of retrying a dead socket.
            if client.set_activity(activity).is_err() {
                drop(guard);
                disconnect_locked();
            }
        }
    })
    .await
    .map_err(|e| e.to_string())
}

/// Clears the active presence (module disabled, or no project focused
/// anymore) without dropping the underlying connection.
#[tauri::command]
pub async fn discord_clear_activity() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut guard = RPC_CLIENT.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(client) = guard.as_mut() {
            let _ = client.clear_activity();
        }
    })
    .await
    .map_err(|e| e.to_string())
}

/// Stores the webhook URL in the OS keyring (never in settings.json — same
/// treatment as the GitHub token / AI provider keys). Passing an empty
/// string clears it.
#[tauri::command]
pub fn settings_set_discord_webhook(app: AppHandle, url: String) -> Result<(), String> {
    crate::set_secret(&app, "discord_webhook_url", &url)?;
    crate::activity_log(&app, "setting.discord_webhook", json!({}));
    Ok(())
}

async fn post_webhook(app: &AppHandle, title: &str, description: &str, color: u32) -> Result<(), String> {
    let url = crate::get_secret(app, "discord_webhook_url")
        .filter(|u| !u.is_empty())
        .ok_or("No Discord webhook URL is set — add one in Settings → Modules.")?;
    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&json!({
            "embeds": [{ "title": title, "description": description, "color": color }],
        }))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|_| "Could not reach Discord.".to_string())?;
    if !resp.status().is_success() {
        // Never echo the URL itself back into an error string — same
        // token-scrubbing discipline push_with_auth_fallback applies to a
        // GitHub remote URL with an embedded credential.
        return Err(format!("Discord rejected the webhook (HTTP {}).", resp.status()));
    }
    Ok(())
}

#[tauri::command]
pub async fn discord_webhook_test(app: AppHandle) -> Result<(), String> {
    post_webhook(&app, "Croco", "This is a test message from Croco's Discord module.", 0xE8E4DC).await
}

// Internal, fire-and-forget — never awaited by the caller, never surfaced
// as a toast. Called from the existing mutation points (git push, todo
// completed, project created) only once modules.discord.webhook is on.
pub fn webhook_notify(app: &AppHandle, title: &str, description: &str) {
    if !webhook_enabled(app) {
        return;
    }
    let app = app.clone();
    let title = title.to_string();
    let description = description.to_string();
    tauri::async_runtime::spawn(async move {
        let _ = post_webhook(&app, &title, &description, 0x4A9EFF).await;
    });
}
