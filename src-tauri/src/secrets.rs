// Secret storage: the OS credential store (Windows Credential Manager /
// macOS Keychain / Linux Secret Service) via the `keyring` crate, under
// service "xyz.skuller.croco". settings.json never holds a raw secret —
// only booleans like `user.github.tokenStored` so the UI can show connected
// state (see settings.rs::read_settings, which strips any secret field and
// injects those booleans on every read).
//
// Linux has no guaranteed Secret Service (e.g. some window managers, most
// containers/CI images, some minimal DEs). When the OS store is unavailable,
// secrets fall back to a locally AES-256-GCM-encrypted file
// (secrets.enc + secrets.key, both in the app data dir). That protects a
// secret from casual disk access, backups, or being opened in a text editor
// — it does NOT protect it from another process that can read the same app
// data directory, since the key sits right next to the ciphertext. This is
// a materially weaker guarantee than a real OS keyring, so callers should
// surface `fallback_in_use()` to the user rather than let it be silent.

// aes_gcm re-exports its own `Nonce<NonceSize>` (parameterized by the raw
// size type), which shadows aead's cipher-parameterized `Nonce<A>` — pull
// Key/Nonce from `aead` directly so `Nonce::<Aes256Gcm>` resolves correctly.
use aes_gcm::aead::{Aead, Generate, Key, KeyInit, Nonce};
use aes_gcm::Aes256Gcm;
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::AppHandle;

// Keyring service name. Namespaced when CROCO_DATA_DIR is set (see
// main.rs::app_data_dir) so an e2e run that stores a fake webhook URL or AI
// key can never overwrite the user's real credentials, even if it crashes
// before its cleanup.
fn service() -> &'static str {
    if std::env::var("CROCO_DATA_DIR").map(|d| !d.trim().is_empty()).unwrap_or(false) {
        "xyz.skuller.croco.test"
    } else {
        "xyz.skuller.croco"
    }
}

static FALLBACK_ACTIVE: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));

pub fn fallback_in_use() -> bool {
    *FALLBACK_ACTIVE.lock().unwrap()
}

fn mark_fallback() {
    *FALLBACK_ACTIVE.lock().unwrap() = true;
}

fn entry(account: &str) -> Option<keyring::Entry> {
    keyring::Entry::new(service(), account).ok()
}

/// Probes the OS credential store once at startup (rather than waiting for
/// the first real secret access to fail) so the UI's fallback warning is
/// accurate from launch.
pub fn probe_keyring_available() {
    let Some(e) = entry("__croco_probe__") else {
        mark_fallback();
        return;
    };
    if e.set_password("probe").is_err() {
        mark_fallback();
        return;
    }
    let _ = e.delete_credential();
}

pub fn set_secret(app: &AppHandle, account: &str, value: &str) -> Result<(), String> {
    if value.is_empty() {
        return delete_secret(app, account);
    }
    match entry(account) {
        Some(e) => match e.set_password(value) {
            Ok(()) => Ok(()),
            Err(_) => {
                mark_fallback();
                fallback_set(app, account, value)
            }
        },
        None => {
            mark_fallback();
            fallback_set(app, account, value)
        }
    }
}

pub fn get_secret(app: &AppHandle, account: &str) -> Option<String> {
    match entry(account) {
        Some(e) => match e.get_password() {
            Ok(v) => Some(v),
            Err(keyring::Error::NoEntry) => fallback_get(app, account),
            Err(_) => {
                mark_fallback();
                fallback_get(app, account)
            }
        },
        None => {
            mark_fallback();
            fallback_get(app, account)
        }
    }
}

pub fn delete_secret(app: &AppHandle, account: &str) -> Result<(), String> {
    if let Some(e) = entry(account) {
        let _ = e.delete_credential();
    }
    fallback_delete(app, account);
    Ok(())
}

// ─── Local encrypted-file fallback ─────────────────────────────────────────

fn fallback_key_path(app: &AppHandle) -> PathBuf {
    crate::app_data_dir(app).join("secrets.key")
}
fn fallback_store_path(app: &AppHandle) -> PathBuf {
    crate::app_data_dir(app).join("secrets.enc")
}

fn fallback_key(app: &AppHandle) -> [u8; 32] {
    let path = fallback_key_path(app);
    if let Ok(bytes) = fs::read(&path) {
        if bytes.len() == 32 {
            let mut key = [0u8; 32];
            key.copy_from_slice(&bytes);
            return key;
        }
    }
    let key: [u8; 32] = Generate::generate();
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    let _ = fs::write(&path, key);
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = fs::metadata(&path) {
            let mut perms = meta.permissions();
            perms.set_mode(0o600);
            let _ = fs::set_permissions(&path, perms);
        }
    }
    key
}

fn fallback_load(app: &AppHandle) -> HashMap<String, String> {
    let Ok(bytes) = fs::read(fallback_store_path(app)) else {
        return HashMap::new();
    };
    if bytes.len() < 12 {
        return HashMap::new();
    }
    let key = fallback_key(app);
    let cipher = Aes256Gcm::new(&Key::<Aes256Gcm>::from(key));
    let (nonce, ciphertext) = bytes.split_at(12);
    let Ok(nonce) = Nonce::<Aes256Gcm>::try_from(nonce) else {
        return HashMap::new();
    };
    let Ok(plain) = cipher.decrypt(&nonce, ciphertext) else {
        return HashMap::new();
    };
    serde_json::from_slice(&plain).unwrap_or_default()
}

fn fallback_save(app: &AppHandle, map: &HashMap<String, String>) {
    let key = fallback_key(app);
    let cipher = Aes256Gcm::new(&Key::<Aes256Gcm>::from(key));
    let nonce_bytes: [u8; 12] = Generate::generate();
    let nonce = Nonce::<Aes256Gcm>::from(nonce_bytes);
    let plain = serde_json::to_vec(map).unwrap_or_default();
    if let Ok(ciphertext) = cipher.encrypt(&nonce, plain.as_ref()) {
        let mut out = nonce_bytes.to_vec();
        out.extend(ciphertext);
        let _ = fs::write(fallback_store_path(app), out);
    }
}

fn fallback_set(app: &AppHandle, account: &str, value: &str) -> Result<(), String> {
    let mut map = fallback_load(app);
    map.insert(account.to_string(), value.to_string());
    fallback_save(app, &map);
    Ok(())
}

fn fallback_get(app: &AppHandle, account: &str) -> Option<String> {
    fallback_load(app).get(account).cloned()
}

fn fallback_delete(app: &AppHandle, account: &str) {
    let mut map = fallback_load(app);
    if map.remove(account).is_some() {
        fallback_save(app, &map);
    }
}

// ─── One-time migration off plaintext settings.json ────────────────────────

const AI_KEY_ACCOUNTS: [(&str, &str); 3] = [
    ("anthropic", "ai_key_anthropic"),
    ("openai", "ai_key_openai"),
    ("gemini", "ai_key_gemini"),
];

/// Sweeps any plaintext secret left in settings.json by a pre-1.14 install
/// into the keyring/fallback store, then blanks it in the file. Idempotent —
/// safe to call on every startup; it's a no-op once nothing plaintext is left.
pub fn migrate_secrets_to_keyring(app: &AppHandle) {
    let path = crate::settings_path(app);
    let Ok(raw) = fs::read_to_string(&path) else { return };
    let Ok(mut v) = serde_json::from_str::<serde_json::Value>(&raw) else { return };
    let mut migrated_any = false;

    if let Some(token) = v["user"]["github"]["token"].as_str().filter(|t| !t.is_empty()) {
        if set_secret(app, "github_token", token).is_ok() {
            migrated_any = true;
        }
    }
    if let Some(token) = v["githubToken"].as_str().filter(|t| !t.is_empty()) {
        if set_secret(app, "github_token", token).is_ok() {
            migrated_any = true;
        }
    }
    for (json_key, account) in AI_KEY_ACCOUNTS {
        if let Some(key) = v["ai"]["keys"][json_key].as_str().filter(|k| !k.is_empty()) {
            if set_secret(app, account, key).is_ok() {
                migrated_any = true;
            }
        }
    }

    if !migrated_any {
        return;
    }

    if let Some(obj) = v.get_mut("user").and_then(|u| u.get_mut("github")).and_then(|g| g.as_object_mut()) {
        obj.insert("token".into(), serde_json::Value::String(String::new()));
    }
    if let Some(obj) = v.as_object_mut() {
        obj.remove("githubToken");
    }
    if let Some(obj) = v.get_mut("ai").and_then(|a| a.get_mut("keys")).and_then(|k| k.as_object_mut()) {
        for (json_key, _) in AI_KEY_ACCOUNTS {
            obj.insert(json_key.into(), serde_json::Value::String(String::new()));
        }
    }

    if let Ok(pretty) = serde_json::to_string_pretty(&v) {
        let _ = fs::write(&path, pretty);
    }
    crate::activity_log(app, "settings.migration.secrets_to_keyring", serde_json::json!({}));
}

#[cfg(test)]
mod tests {
    use super::*;

    // fallback_save/fallback_load need an AppHandle just to resolve file
    // paths — this exercises the actual encrypt/decrypt call shapes those
    // functions use (Key::from/Nonce::from/Nonce::try_from/Generate) against
    // aes-gcm 0.11's API directly, since that's what a dependency bump here
    // would silently break without any other test coverage.
    #[test]
    fn fallback_cipher_round_trips() {
        let key: [u8; 32] = Generate::generate();
        let cipher = Aes256Gcm::new(&Key::<Aes256Gcm>::from(key));

        let nonce_bytes: [u8; 12] = Generate::generate();
        let nonce = Nonce::<Aes256Gcm>::from(nonce_bytes);
        let plain = b"super-secret-token".to_vec();
        let ciphertext = cipher.encrypt(&nonce, plain.as_ref()).unwrap();

        let mut stored = nonce_bytes.to_vec();
        stored.extend(ciphertext);

        let cipher2 = Aes256Gcm::new(&Key::<Aes256Gcm>::from(key));
        let (nonce_read, ciphertext_read) = stored.split_at(12);
        let nonce_read = Nonce::<Aes256Gcm>::try_from(nonce_read).unwrap();
        let decrypted = cipher2.decrypt(&nonce_read, ciphertext_read).unwrap();

        assert_eq!(decrypted, plain);
    }

    #[test]
    fn fallback_cipher_rejects_wrong_key() {
        let key: [u8; 32] = Generate::generate();
        let wrong_key: [u8; 32] = Generate::generate();
        let cipher = Aes256Gcm::new(&Key::<Aes256Gcm>::from(key));
        let nonce_bytes: [u8; 12] = Generate::generate();
        let nonce = Nonce::<Aes256Gcm>::from(nonce_bytes);
        let ciphertext = cipher.encrypt(&nonce, b"payload".as_ref()).unwrap();

        let cipher2 = Aes256Gcm::new(&Key::<Aes256Gcm>::from(wrong_key));
        assert!(cipher2.decrypt(&nonce, ciphertext.as_ref()).is_err());
    }
}
