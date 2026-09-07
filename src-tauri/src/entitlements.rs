// Client-side entitlements. This file is the ENTIRE premium-gating
// surface on the client — there is no local flag, setting, or key format
// a user can edit to grant themselves a capability. Every capability
// comes from a signature this code cannot forge, checked against a
// public key compiled into the binary and issued by croco-server (a
// separate, private repository — see its docs/entitlements.md for the
// full design: token format, key rotation, revocation latency, and
// offline/server-down behavior).
//
// Premium applies only to server-backed features (social features and
// anything else that needs Croco's own infrastructure). Nothing that
// runs purely locally is ever gated by this file.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD as B64, Engine};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::AppHandle;

// Not deployed anywhere yet — see "Decisions made / still open" in
// croco-server's docs/entitlements.md. Update this the moment a real
// deployment exists; nothing else on the client needs to change.
const ENTITLEMENTS_SERVER_URL: &str = "https://entitlements.croco.dev";

// Public key only — never secret, safe to compile in. Must match the
// private key held by croco-server's ENTITLEMENTS_SIGNING_KEY. Generate a
// matching pair with `cargo run --example genkey` in croco-server.
const ENTITLEMENTS_PUBLIC_KEY_B64: &str = "Jp0M0XZXWIuvff-T9cNHDwmYWZ7AYP7c62TvU0PHs48";

#[derive(Deserialize, Serialize, Clone, Debug, PartialEq)]
struct EntitlementPayload {
    sub: String,
    device_id: String,
    capabilities: Vec<String>,
    iat: i64,
    exp: i64,
}

/// Verifies a token's signature against the compiled-in public key and
/// checks it hasn't expired. Returns the payload only if both hold —
/// callers must never branch on an unverified token.
fn verify_token(token: &str) -> Option<EntitlementPayload> {
    verify_token_at(token, chrono::Utc::now().timestamp())
}

/// Clock-injected core of `verify_token`, split out so tests can check
/// expiry handling deterministically against a real, fixed, previously-
/// captured server token — rather than a token minted with `exp` a few
/// seconds from "now" that would flip from valid to expired while CI is
/// still running, or (worse) a fixed historical token whose expiry
/// assertion silently flips true-to-false the moment real wall-clock time
/// crosses its `exp`, forever after.
fn verify_token_at(token: &str, now_unix: i64) -> Option<EntitlementPayload> {
    let (payload_b64, sig_b64) = token.split_once('.')?;
    let vk_bytes: [u8; 32] = B64.decode(ENTITLEMENTS_PUBLIC_KEY_B64).ok()?.try_into().ok()?;
    let vk = VerifyingKey::from_bytes(&vk_bytes).ok()?;
    let sig_bytes: [u8; 64] = B64.decode(sig_b64).ok()?.try_into().ok()?;
    let sig = Signature::from_bytes(&sig_bytes);
    // The server signs the base64 *string* bytes of the payload, not the
    // decoded JSON — verify against payload_b64.as_bytes() first, only
    // decode after the signature checks out.
    vk.verify(payload_b64.as_bytes(), &sig).ok()?;
    let payload_json = B64.decode(payload_b64).ok()?;
    let payload: EntitlementPayload = serde_json::from_slice(&payload_json).ok()?;

    if payload.exp < now_unix {
        return None; // signature-valid but expired — same as no token
    }
    Some(payload)
}

/// Stable per-install identifier, non-secret — used only so the server can
/// flag anomalous device counts on an account, never as a security
/// boundary. Lives in settings.json (not the keyring) since it isn't
/// sensitive, generated once on first use.
fn device_id(app: &AppHandle) -> String {
    let settings = crate::read_settings(app);
    if let Some(id) = settings["app"]["deviceId"].as_str().filter(|s| !s.is_empty()) {
        return id.to_string();
    }
    let id = uuid::Uuid::new_v4().to_string();
    let _ = crate::settings_set(app.clone(), "app.deviceId".into(), json!(id));
    id
}

async fn exchange_for_session(app: &AppHandle, github_token: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{ENTITLEMENTS_SERVER_URL}/v1/auth/exchange"))
        .json(&json!({ "github_token": github_token }))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("auth exchange failed: HTTP {}", resp.status()));
    }
    let body: Value = resp.json().await.map_err(|e| e.to_string())?;
    let session = body["session_token"].as_str().ok_or("no session_token in response")?.to_string();
    crate::set_secret(app, "entitlements_session", &session)?;
    Ok(session)
}

/// Fetches fresh entitlements from the server, verifies the signature,
/// and caches the raw token. Call on launch and every few hours — never
/// on a hot path, since this always hits the network.
#[tauri::command]
pub async fn entitlements_refresh(app: AppHandle) -> Result<Value, String> {
    let Some(github_token) = crate::stored_github_token(&app) else {
        // No GitHub login at all — nothing to check entitlements for.
        // Not an error: this is the normal state for most users, most of
        // the time, and must resolve to free tier, not a failure toast.
        return Ok(json!({ "capabilities": [], "source": "no-github-login" }));
    };

    let mut session = crate::get_secret(&app, "entitlements_session");
    if session.is_none() {
        session = exchange_for_session(&app, &github_token).await.ok();
    }
    let Some(session_token) = session else {
        return Err("Could not reach the entitlements server".into());
    };

    let device = device_id(&app);
    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{ENTITLEMENTS_SERVER_URL}/v1/entitlements?device_id={device}"))
        .header("Authorization", format!("Bearer {session_token}"))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    // Session expired/invalid server-side — re-exchange once and retry,
    // rather than surfacing a confusing auth error for something the user
    // never has to think about (sessions just quietly renew).
    let resp = if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
        let fresh_session = exchange_for_session(&app, &github_token).await?;
        client
            .get(format!("{ENTITLEMENTS_SERVER_URL}/v1/entitlements?device_id={device}"))
            .header("Authorization", format!("Bearer {fresh_session}"))
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await
            .map_err(|e| e.to_string())?
    } else {
        resp
    };

    if !resp.status().is_success() {
        return Err(format!("entitlements fetch failed: HTTP {}", resp.status()));
    }
    let body: Value = resp.json().await.map_err(|e| e.to_string())?;
    let token = body["token"].as_str().ok_or("no token in response")?;

    // Verify our own server's signature before trusting anything it sent
    // — belt-and-suspenders against a compromised or misconfigured
    // connection that isn't actually croco-server (TLS should already
    // prevent this, but the token is meaningless without a valid
    // signature regardless of transport).
    let payload = verify_token(token).ok_or("server returned a token that failed signature verification")?;

    crate::set_secret(&app, "entitlements_token", token)?;
    Ok(json!({ "capabilities": payload.capabilities, "source": "network" }))
}

/// Local-only: returns whatever capabilities the last verified, unexpired
/// cached token grants. Never touches the network — safe to call on every
/// render. Degrades to an empty capability list (free tier) whenever
/// there's no cached token, it's expired, or it fails verification —
/// never fails the call itself, since "no premium" must never look like
/// an error to the rest of the app.
#[tauri::command]
pub fn entitlements_get(app: AppHandle) -> Value {
    let capabilities = crate::get_secret(&app, "entitlements_token")
        .and_then(|t| verify_token(&t))
        .map(|p| p.capabilities)
        .unwrap_or_default();
    json!({ "capabilities": capabilities })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Real token minted by a real croco-server instance using the
    // matching private key — not a token this file constructed itself,
    // so this actually exercises client/server wire compatibility rather
    // than just testing this file against its own logic twice.
    // iat=1788795326, exp=1788881726 (exactly +24h, the server's TTL).
    const REAL_SERVER_TOKEN: &str = "eyJzdWIiOiI3NzY1ODQzMCIsImRldmljZV9pZCI6ImludGVyb3AtdGVzdC1kZXZpY2UiLCJjYXBhYmlsaXRpZXMiOlsic29jaWFsLnBpbmciXSwiaWF0IjoxNzg4Nzk1MzI2LCJleHAiOjE3ODg4ODE3MjZ9.YmUNJxSgSGqtb5I7HNGPRMOPboLhKrrMjUUJcM47EbfhxnnBR3xEKZE4HsWW2s-8ZMGsB869kHovrOzLjZZpBg";
    const REAL_TOKEN_IAT: i64 = 1788795326;
    const REAL_TOKEN_EXP: i64 = 1788881726;

    #[test]
    fn accepts_a_real_token_from_croco_server_when_not_yet_expired() {
        // Clock injected at just after iat — deterministic regardless of
        // when this test actually runs, unlike asserting against
        // chrono::Utc::now() against a fixed historical fixture (which
        // would silently flip from "valid" to "expired" forever, the
        // instant real wall-clock time crossed this token's real exp).
        let payload = verify_token_at(REAL_SERVER_TOKEN, REAL_TOKEN_IAT + 60).expect("should verify and accept — signature-valid, not yet expired");
        assert_eq!(payload.capabilities, vec!["social.ping".to_string()]);
        assert_eq!(payload.device_id, "interop-test-device");
        assert_eq!(payload.sub, "77658430");
    }

    #[test]
    fn rejects_a_real_token_from_croco_server_once_expired() {
        assert!(verify_token_at(REAL_SERVER_TOKEN, REAL_TOKEN_EXP + 1).is_none());
    }

    #[test]
    fn accepts_at_the_exact_expiry_boundary() {
        // exp is inclusive — a token is still good in the same instant it expires.
        assert!(verify_token_at(REAL_SERVER_TOKEN, REAL_TOKEN_EXP).is_some());
        assert!(verify_token_at(REAL_SERVER_TOKEN, REAL_TOKEN_EXP + 1).is_none());
    }

    #[test]
    fn rejects_a_token_with_a_tampered_capabilities_list() {
        let (_, sig_b64) = REAL_SERVER_TOKEN.split_once('.').unwrap();
        let forged_payload = EntitlementPayload {
            sub: "77658430".into(),
            device_id: "interop-test-device".into(),
            capabilities: vec!["admin".into()],
            iat: 1788795326,
            exp: 9999999999,
        };
        let forged_b64 = B64.encode(serde_json::to_vec(&forged_payload).unwrap());
        let forged_token = format!("{forged_b64}.{sig_b64}");
        assert!(verify_token(&forged_token).is_none());
    }

    #[test]
    fn rejects_malformed_tokens_without_panicking() {
        assert!(verify_token("").is_none());
        assert!(verify_token("not-a-token").is_none());
        assert!(verify_token("a.b.c").is_none());
        assert!(verify_token(".").is_none());
    }
}
