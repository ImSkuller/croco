// Slack module (v2.0, beta) — see docs/modules-plan.md. Webhook
// notifications only; there's no Slack equivalent of Discord's Rich
// Presence (no "currently editing" concept exposed to third-party apps
// without a much heavier OAuth app + user token setup), so there's no
// first half to add here.

use serde_json::json;
use tauri::AppHandle;

fn webhook_enabled(app: &AppHandle) -> bool {
    let s = &crate::read_settings(app)["modules"]["slack"];
    s["enabled"].as_bool().unwrap_or(false) && s["webhook"]["enabled"].as_bool().unwrap_or(false)
}

async fn post_webhook(app: &AppHandle, text: &str) -> Result<(), String> {
    let url = crate::get_secret(app, "slack_webhook_url")
        .filter(|u| !u.is_empty())
        .ok_or("No Slack webhook URL is set — add one in Settings → Modules.")?;
    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&json!({ "text": text }))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|_| "Could not reach Slack.".to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Slack rejected the webhook (HTTP {}).", resp.status()));
    }
    Ok(())
}

/// Stores the webhook URL in the OS keyring (never in settings.json — same
/// treatment as the Discord webhook URL / GitHub token / AI keys).
#[tauri::command]
pub fn settings_set_slack_webhook(app: AppHandle, url: String) -> Result<(), String> {
    crate::set_secret(&app, "slack_webhook_url", &url)?;
    crate::activity_log(&app, "setting.slack_webhook", json!({}));
    Ok(())
}

#[tauri::command]
pub async fn slack_webhook_test(app: AppHandle) -> Result<(), String> {
    post_webhook(&app, "This is a test message from Croco's Slack module.").await
}

// Internal, fire-and-forget — mirrors discord.rs::webhook_notify exactly,
// just a plain-text payload instead of an embed (Slack's incoming-webhook
// format has no embed concept as simple as Discord's). Named distinctly
// (not webhook_notify) because both modules are glob-re-exported at the
// crate root (`pub(crate) use slack::*` alongside `use discord::*` in
// main.rs) — two same-named functions there would collide.
pub fn slack_webhook_notify(app: &AppHandle, text: &str) {
    if !webhook_enabled(app) {
        return;
    }
    let app = app.clone();
    let text = text.to_string();
    tauri::async_runtime::spawn(async move {
        let _ = post_webhook(&app, &text).await;
    });
}
