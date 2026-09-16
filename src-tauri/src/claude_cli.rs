// Embedded Claude Code CLI panel (v2.0, beta) — shells out to the user's own
// locally-installed `claude` CLI in non-interactive "print" mode
// (`claude -p --output-format stream-json`), the same headless mode the
// Claude Code VS Code extension and the Agent SDK are built on. This is
// deliberately NOT a terminal emulator (no pty crate, no raw TTY) — the CLI
// emits one JSON object per line describing each turn (system init,
// assistant text/tool-use, tool results, final result), which the frontend
// panel renders as a structured transcript, same shape as src/components/
// AI/ChatPanel.jsx already renders for the direct-API "Ask AI" panel.
//
// The prompt is sent over the child's stdin, never as a CLI argument — this
// sidesteps Windows `cmd /c` argv-quoting/metacharacter risk entirely (see
// open_claude_code_cli below for why GUI-editor-style argv passing needs
// `cmd /c` in the first place). Every other argument passed to the process is
// either a fixed literal or a session id *we* generated/captured from the
// CLI's own prior output — never raw user text — so there is no shell-
// injection surface here at all.

#![deny(clippy::unwrap_used)]

use once_cell::sync::Lazy;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use std::sync::{Mutex, PoisonError};
use std::thread;
use tauri::{AppHandle, Emitter};

static CLAUDE_CLI_PIDS: Lazy<Mutex<HashMap<String, u32>>> = Lazy::new(|| Mutex::new(HashMap::new()));

fn claude_cli_pids() -> std::sync::MutexGuard<'static, HashMap<String, u32>> {
    CLAUDE_CLI_PIDS.lock().unwrap_or_else(PoisonError::into_inner)
}

// True only while `pid` is still the pid tracked for `project_id` — see the
// stop-then-resend race explained where this is used in claude_cli_send.
fn is_current_pid(project_id: &str, pid: u32) -> bool {
    claude_cli_pids().get(project_id).copied() == Some(pid)
}

// Permission modes the panel is allowed to request. "auto" and
// "bypassPermissions" are deliberately never accepted here — those let the
// CLI run arbitrary tools (including Bash) with zero confirmation, which is
// fine for a sandboxed CI-style invocation but not for a default-reachable
// panel inside a general-purpose desktop app. "plan" (read-only) is the
// module's own default (see settings.rs); "manual"/"dontAsk"/"acceptEdits"
// are offered as explicit escalations the user picks per-session.
const ALLOWED_PERMISSION_MODES: [&str; 4] = ["plan", "manual", "dontAsk", "acceptEdits"];

fn claude_cmd() -> Command {
    // On Windows, `claude` is an npm shim (.cmd/.ps1), not a real .exe —
    // CreateProcess (what Command::new talks to) doesn't consult PATHEXT the
    // way cmd.exe's own command resolution does, so it has to be routed
    // through cmd.exe, exactly like open_in_ide already does for `code`/
    // `cursor`/etc. On other platforms a native/Homebrew/curl install is
    // normally a real executable on PATH already.
    #[cfg(windows)]
    {
        let mut c = Command::new("cmd");
        c.arg("/c").arg("claude");
        c
    }
    #[cfg(not(windows))]
    {
        Command::new("claude")
    }
}

#[tauri::command]
pub async fn claude_cli_check() -> Value {
    let mut c = claude_cmd();
    c.arg("--version");
    #[cfg(windows)]
    crate::no_window(&mut c);
    match c.output() {
        Ok(out) if out.status.success() => {
            let version = String::from_utf8_lossy(&out.stdout).trim().to_string();
            json!({ "available": true, "version": version })
        }
        _ => json!({ "available": false, "version": null }),
    }
}

#[tauri::command]
pub async fn claude_cli_send(
    app: AppHandle,
    project_id: String,
    message: String,
    session_id: Option<String>,
    permission_mode: String,
) -> Result<Value, String> {
    // Check-and-reserve under one lock acquisition — checking with
    // contains_key() and inserting separately (after the spawn below, which
    // itself isn't instant) left a window where two near-simultaneous calls
    // (e.g. a rapid stop-then-resend, or a fast double-click before the
    // Send button's own disabled state took effect) could both see no
    // in-flight request and both spawn a `claude` process for the same
    // project, defeating the single-in-flight guard entirely. Reserve the
    // slot with a placeholder pid immediately; it's replaced with the real
    // pid once spawn succeeds, or released if anything below fails.
    {
        let mut guard = claude_cli_pids();
        if guard.contains_key(&project_id) {
            return Err("Claude Code is already working on a message for this project. Wait for it to finish, or stop it first.".into());
        }
        guard.insert(project_id.clone(), 0);
    }
    if !ALLOWED_PERMISSION_MODES.contains(&permission_mode.as_str()) {
        return Err(format!("Unsupported permission mode: {permission_mode}"));
    }
    if message.trim().is_empty() {
        return Err("Message is empty".into());
    }

    // From here on, every early return must release the reservation made
    // above — otherwise a validation failure or a spawn error would leave
    // the project permanently stuck looking "busy".
    if let Err(e) = crate::validate_safe_id(&project_id) {
        claude_cli_pids().remove(&project_id);
        return Err(e);
    }
    let project = match crate::get_project(&app, &project_id) {
        Some(p) => p,
        None => {
            claude_cli_pids().remove(&project_id);
            return Err("Project not found".into());
        }
    };
    let cwd = crate::project_root_str(&project);

    let mut cmd = claude_cmd();
    cmd.args(["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", &permission_mode]);
    if let Some(sid) = session_id.as_ref().filter(|s| !s.is_empty()) {
        cmd.args(["--resume", sid]);
    }
    cmd.current_dir(&cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    crate::no_window(&mut cmd);

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            claude_cli_pids().remove(&project_id);
            return Err(format!("Could not start the `claude` CLI — is it installed and on PATH? ({e})"));
        }
    };

    // Write the prompt to stdin and close it immediately (drop the handle)
    // so `claude -p`'s stdin read sees EOF and proceeds — it isn't a
    // conversational stdin stream (that's --input-format stream-json, a
    // separate, unused mode here), just a one-shot prompt delivery.
    if let Some(mut stdin) = child.stdin.take() {
        if let Err(e) = stdin.write_all(message.as_bytes()) {
            claude_cli_pids().remove(&project_id);
            let _ = child.kill();
            return Err(e.to_string());
        }
    }

    let child_pid = child.id();
    claude_cli_pids().insert(project_id.clone(), child_pid); // replace the placeholder with the real pid
    app.emit("claudecode:started", json!({ "projectId": project_id })).ok();

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    // A stop() immediately followed by a new send() for the same project
    // races this (now-being-killed) process's own background threads
    // against the fresh request: the map entry gets overwritten with the
    // new child's pid almost immediately, but this process's stdout/stderr
    // readers and exit-wait thread are still unwinding in the background.
    // Every thread below checks the map still points at *its own* pid
    // before emitting anything — without that, the old process's eventual
    // exit would remove the new request's still-running guard and fire a
    // claudecode:done for it, silently ending the new turn in the UI while
    // the real one keeps streaming.
    {
        let app = app.clone();
        let proj = project_id.clone();
        thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                if line.trim().is_empty() { continue; }
                if !is_current_pid(&proj, child_pid) { continue; }
                match serde_json::from_str::<Value>(&line) {
                    Ok(parsed) => { app.emit("claudecode:event", json!({ "projectId": proj, "event": parsed })).ok(); }
                    // Not every line is guaranteed structured JSON (e.g. a
                    // stray warning printed before the CLI settles into
                    // stream-json mode) — surface it as raw text rather
                    // than silently dropping it.
                    Err(_) => { app.emit("claudecode:raw", json!({ "projectId": proj, "text": line })).ok(); }
                }
            }
        });
    }
    {
        let app = app.clone();
        let proj = project_id.clone();
        thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                if !is_current_pid(&proj, child_pid) { continue; }
                app.emit("claudecode:stderr", json!({ "projectId": proj, "text": line })).ok();
            }
        });
    }
    {
        let app = app.clone();
        let proj = project_id.clone();
        thread::spawn(move || {
            let code = child.wait().map(|s| s.code().unwrap_or(0)).unwrap_or(-1);
            let mut guard = claude_cli_pids();
            if guard.get(&proj).copied() == Some(child_pid) {
                guard.remove(&proj);
                drop(guard);
                app.emit("claudecode:done", json!({ "projectId": proj, "exitCode": code })).ok();
            }
        });
    }

    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub async fn claude_cli_stop(project_id: String) -> Result<Value, String> {
    let pid = claude_cli_pids().remove(&project_id);
    if let Some(pid) = pid {
        #[cfg(windows)]
        {
            let pid_str = pid.to_string();
            let mut c = Command::new("taskkill");
            c.args(["/PID", &pid_str, "/F", "/T"]);
            crate::no_window(&mut c);
            c.output().ok();
        }
        #[cfg(not(windows))]
        {
            Command::new("kill").args(["-TERM", &pid.to_string()]).output().ok();
        }
        Ok(json!({ "ok": true }))
    } else {
        Ok(json!({ "ok": false, "message": "Not running" }))
    }
}

#[tauri::command]
pub fn claude_cli_is_running(project_id: String) -> bool {
    claude_cli_pids().contains_key(&project_id)
}

// External "open in Claude Code" launcher (Settings → Defaults → Default
// IDE, and every per-project "Open in IDE" button — see open_in_ide in
// projects.rs) — unlike a GUI editor, `claude` is an interactive TUI, so it
// needs a real visible terminal attached, not a piped/no_window spawn like
// every other entry in that match arm. Opens (or focuses) a terminal window
// at the project root running `claude` interactively, exactly like a
// developer would launch it by hand.
pub fn open_claude_code_terminal(path: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        // `start` opens a new console window; `cmd /k` keeps it open and
        // running `claude` interactively inside it, with the window's own
        // cwd set via `/d`.
        let mut c = Command::new("cmd");
        c.args(["/c", "start", "Claude Code", "cmd", "/k", &format!("cd /d \"{path}\" && claude")]);
        c.spawn().map_err(|e| format!("Failed to launch Claude Code — is it installed and in PATH? ({e})"))?;
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        let script = format!(
            "tell application \"Terminal\" to do script \"cd {} && claude\"",
            shell_quote_applescript(path)
        );
        Command::new("osascript").args(["-e", &script])
            .spawn().map_err(|e| format!("Failed to launch Claude Code — is it installed and in PATH? ({e})"))?;
        Ok(())
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        // No single standard terminal on Linux — try common emulators in
        // order and use whichever spawns successfully. Not field-tested on
        // real Linux hardware yet (see CLAUDE.md's cross-platform note).
        let candidates: [(&str, Vec<&str>); 4] = [
            ("x-terminal-emulator", vec!["-e", "sh", "-c"]),
            ("gnome-terminal",      vec!["--", "sh", "-c"]),
            ("konsole",             vec!["-e", "sh", "-c"]),
            ("xterm",               vec!["-e", "sh", "-c"]),
        ];
        let inner = format!("cd '{}' && claude; exec $SHELL", path.replace('\'', "'\\''"));
        for (term, mut args) in candidates {
            args.push(&inner);
            if Command::new(term).args(&args).spawn().is_ok() {
                return Ok(());
            }
        }
        Err("Could not find a terminal emulator to launch Claude Code in.".into())
    }
}

#[cfg(target_os = "macos")]
fn shell_quote_applescript(path: &str) -> String {
    format!("\"{}\"", path.replace('\\', "\\\\").replace('"', "\\\""))
}
