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

use once_cell::sync::{Lazy, OnceCell};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::sync::{Mutex, PoisonError};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

static CLAUDE_CLI_PIDS: Lazy<Mutex<HashMap<String, u32>>> = Lazy::new(|| Mutex::new(HashMap::new()));

fn claude_cli_pids() -> std::sync::MutexGuard<'static, HashMap<String, u32>> {
    CLAUDE_CLI_PIDS.lock().unwrap_or_else(PoisonError::into_inner)
}

// request_id -> (project_id, channel to deliver the Accept/Reject decision
// to the thread blocked on that hook's TCP connection). See
// start_permission_hook_server below for the full design.
type PendingMap = HashMap<String, (String, mpsc::Sender<Value>)>;

static PENDING_PERMISSIONS: Lazy<Mutex<PendingMap>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

fn pending_permissions() -> std::sync::MutexGuard<'static, PendingMap> {
    PENDING_PERMISSIONS.lock().unwrap_or_else(PoisonError::into_inner)
}

static PERMISSION_HOOK_PORT: OnceCell<u16> = OnceCell::new();

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

// Real tool-use gating for "manual" mode. The CLI's own `--permission-mode
// manual` has no non-interactive prompt channel at all (a `-p` session just
// auto-denies every tool), which is why the panel used to describe this mode
// as "denied automatically — no prompt UI in this panel yet". This replaces
// that with a genuine Accept/Reject flow using Claude Code's PreToolUse hook:
// the CLI is actually spawned with `--permission-mode acceptEdits` (so its
// own built-in gate stays out of the way) plus an inline `--settings` JSON
// (never written into the project's own .claude/settings.json) registering a
// PreToolUse hook with no matcher, i.e. it fires for every tool. The hook is
// this small bundled Node script — Node is already guaranteed present
// because the `claude` CLI itself is an npm package — which phones home over
// a loopback TCP socket to the listener started below, blocks for the user's
// decision, and prints the exact JSON contract Claude Code expects back on
// its own stdout. All of this was verified against the real installed CLI
// (manual testing, not assumed from docs) before writing this.
//
// The same script also serves a second, unrelated hook event — PostToolUse
// on Bash — used to mirror a real Bash call's actual output into the
// project's own terminal pane (see pty.rs::mirror_bash_to_project_sessions).
// PostToolUse can't change what already happened (the tool already ran by
// the time it fires), so there's no allow/deny branching for it: send the
// real tool_response Claude Code already captured, get back an immediate
// ack, exit. This was a deliberate choice over the alternative of denying
// the PreToolUse call and substituting captured output as the denial
// reason — verified empirically that the `is_error: true` a denial carries
// leaks into the model's own read of the result (it misreported real
// stdout as having "come through on stderr" in testing), which would
// quietly corrupt a multi-step agent's judgment of what actually
// succeeded. Letting the real Bash tool run and only *observing* its
// result afterward avoids that entirely.
const PERMISSION_HOOK_JS: &str = r#"
const net = require('net');
let input = '';
process.stdin.on('data', d => { input += d; });
process.stdin.on('end', () => {
  let payload;
  try { payload = JSON.parse(input || '{}'); } catch { payload = {}; }
  const hookEventName = payload.hook_event_name || 'PreToolUse';
  const port = parseInt(process.env.CROCO_HOOK_PORT || '0', 10);
  const projectId = process.env.CROCO_HOOK_PROJECT_ID || '';
  if (!port) { settle('deny', 'Croco hook port not set'); return; }
  let settled = false;
  const socket = net.createConnection({ host: '127.0.0.1', port }, () => {
    socket.write(JSON.stringify({
      projectId,
      hookEventName,
      toolName: payload.tool_name || null,
      toolInput: payload.tool_input || null,
      toolResponse: payload.tool_response || null,
      toolUseId: payload.tool_use_id || null,
    }) + '\n');
  });
  socket.setTimeout(620000, () => { socket.destroy(); settle('deny', 'Timed out waiting for a decision in Croco'); });
  let buf = '';
  socket.on('data', d => { buf += d; });
  socket.on('end', () => {
    if (settled) return;
    let decision;
    try { decision = JSON.parse(buf.trim() || '{}'); } catch { decision = {}; }
    const isAllow = decision.decision === 'allow';
    settle(isAllow ? 'allow' : 'deny', decision.reason || (isAllow ? 'Approved in Croco' : 'Rejected in Croco'));
  });
  socket.on('error', () => settle('deny', 'Lost connection to Croco'));
  function settle(decision, reason) {
    if (settled) return;
    settled = true;
    // PostToolUse has nothing to gate — Croco's connection handler already
    // did its one-way job (emitting the mirrored output) by the time this
    // fires; print a no-op and get out of the way.
    if (hookEventName !== 'PreToolUse') { process.stdout.write('{}'); process.exit(0); return; }
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: reason } }));
    process.exit(0);
  }
});
"#;

// Writes the embedded hook script to the app data dir (overwritten on every
// call — cheap, and guarantees it can never drift from what this binary
// actually expects after an app update) and returns its path with forward
// slashes, which both Windows and the shell that Claude Code uses to run
// hook commands accept without the backslash-escaping headaches of
// embedding a Windows path inside a generated JSON string.
fn permission_hook_script_path(app: &AppHandle) -> Result<String, String> {
    let dir = crate::app_data_dir(app);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("permission-hook.js");
    std::fs::write(&path, PERMISSION_HOOK_JS).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().replace('\\', "/"))
}

// Starts the single loopback TCP listener every "manual"-mode session's hook
// script talks to, once per app launch. Binds to an OS-assigned port on
// 127.0.0.1 only — never reachable off-machine. Each accepted connection is
// one tool-use permission request; its handler thread blocks (with a 10
// minute safety-net timeout) until claude_cli_respond_permission delivers a
// decision, or claude_cli_stop cancels it because the session was stopped.
pub fn start_permission_hook_server(app: AppHandle) {
    let listener = match TcpListener::bind("127.0.0.1:0") {
        Ok(l) => l,
        Err(e) => {
            eprintln!("permission hook server failed to bind (manual mode will fall back to deny-all): {e}");
            return;
        }
    };
    let port = match listener.local_addr() {
        Ok(addr) => addr.port(),
        Err(_) => return,
    };
    let _ = PERMISSION_HOOK_PORT.set(port);

    thread::spawn(move || {
        for stream in listener.incoming().map_while(Result::ok) {
            let app = app.clone();
            thread::spawn(move || handle_permission_connection(app, stream));
        }
    });
}

fn handle_permission_connection(app: AppHandle, mut stream: TcpStream) {
    let mut line = String::new();
    {
        // A client that connects and never sends a request must not pin this
        // thread forever.
        let _ = stream.set_read_timeout(Some(std::time::Duration::from_secs(10)));
        let mut reader = BufReader::new(&stream);
        if reader.read_line(&mut line).unwrap_or(0) == 0 {
            return;
        }
    }
    let request: Value = match serde_json::from_str(&line) {
        Ok(v) => v,
        Err(_) => return,
    };
    let project_id = request["projectId"].as_str().unwrap_or("").to_string();

    // PostToolUse(Bash) — a one-way observer, not a gate (the real Bash
    // tool already ran by the time this fires). Mirror its actual output
    // into the project's terminal pane(s), if any are open, and respond
    // immediately; there's no decision to wait on and nothing in
    // pending_permissions to register.
    if request["hookEventName"].as_str() == Some("PostToolUse") {
        if request["toolName"].as_str() == Some("Bash") {
            let command = request["toolInput"]["command"].as_str().unwrap_or("");
            let stdout = request["toolResponse"]["stdout"].as_str().unwrap_or("");
            let stderr = request["toolResponse"]["stderr"].as_str().unwrap_or("");
            crate::mirror_bash_to_project_sessions(&app, &project_id, command, stdout, stderr);
        }
        let _ = stream.write_all(b"{}\n");
        let _ = stream.shutdown(std::net::Shutdown::Both);
        return;
    }

    let request_id = Uuid::new_v4().to_string();

    let (tx, rx) = mpsc::channel::<Value>();
    pending_permissions().insert(request_id.clone(), (project_id.clone(), tx));

    app.emit("claudecode:permission-request", json!({
        "projectId": project_id,
        "requestId": request_id,
        "toolName": request["toolName"],
        "toolInput": request["toolInput"],
    })).ok();

    // Default-deny on timeout or a dropped sender (e.g. the panel/app closed
    // mid-request) — an edit must never go through silently just because the
    // decision channel broke.
    let decision = rx.recv_timeout(Duration::from_secs(600))
        .unwrap_or_else(|_| json!({ "decision": "deny", "reason": "No response from Croco (timed out)" }));
    pending_permissions().remove(&request_id);

    let response = decision.to_string() + "\n";
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.shutdown(std::net::Shutdown::Both);
}

#[tauri::command]
pub async fn claude_cli_respond_permission(request_id: String, decision: String, reason: Option<String>) -> Result<Value, String> {
    if decision != "allow" && decision != "deny" {
        return Err(format!("Unsupported decision: {decision}"));
    }
    let entry = pending_permissions().remove(&request_id);
    match entry {
        Some((_project_id, tx)) => {
            tx.send(json!({ "decision": decision, "reason": reason })).ok();
            Ok(json!({ "ok": true }))
        }
        None => Ok(json!({ "ok": false, "message": "Request already resolved or expired" })),
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

    // "manual" has no real CLI-native prompt channel in `-p` mode (see the
    // doc comment on PERMISSION_HOOK_JS) — run the CLI itself in acceptEdits
    // so its own gate stays out of the way, and substitute a real hook-based
    // Accept/Reject gate in front of every tool call instead. Every other
    // mode behaves exactly as before.
    let effective_permission_mode = if permission_mode == "manual" { "acceptEdits" } else { permission_mode.as_str() };

    let mut cmd = claude_cmd();
    cmd.args(["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", effective_permission_mode]);
    if let Some(sid) = session_id.as_ref().filter(|s| !s.is_empty()) {
        cmd.args(["--resume", sid]);
    }
    // Manual mode genuinely needs the hook channel (it's the only gate
    // standing in for the CLI's own missing prompt) — fail loudly rather
    // than silently running ungated if the listener never came up. Every
    // other mode only wants it for the Bash-output mirror below, which is
    // a bonus, not a safety promise — missing it there just means no
    // mirroring this session, not an error.
    if permission_mode == "manual" && PERMISSION_HOOK_PORT.get().is_none() {
        claude_cli_pids().remove(&project_id);
        return Err("The permission-review channel isn't available (it failed to start at launch) — pick a different permission mode.".into());
    }
    if let Some(port) = PERMISSION_HOOK_PORT.get() {
        let hook_path = permission_hook_script_path(&app).ok().filter(|p| !p.is_empty());
        match hook_path {
            Some(hook_path) => {
                let command = format!("node \"{hook_path}\"");
                let mut hooks_obj = serde_json::Map::new();
                if permission_mode == "manual" {
                    hooks_obj.insert("PreToolUse".into(), json!([{ "hooks": [{ "type": "command", "command": command.clone() }] }]));
                }
                // Mirrors a real Bash call's actual output into the project's
                // open terminal pane(s), if any — see
                // pty.rs::mirror_bash_to_project_sessions. Registered in every
                // mode (not just manual), since it's a pure observer.
                hooks_obj.insert("PostToolUse".into(), json!([{ "matcher": "Bash", "hooks": [{ "type": "command", "command": command }] }]));
                let settings_json = json!({ "hooks": hooks_obj }).to_string();
                cmd.args(["--settings", &settings_json]);
                cmd.env("CROCO_HOOK_PORT", port.to_string());
                cmd.env("CROCO_HOOK_PROJECT_ID", &project_id);
            }
            None if permission_mode == "manual" => {
                claude_cli_pids().remove(&project_id);
                return Err("Could not prepare the permission hook — check app data dir permissions.".into());
            }
            None => {} // Non-fatal outside manual mode — just skip the mirror hook this session.
        }
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
    // Cancel any permission request this project is still waiting on —
    // `taskkill /T` below kills the hook subprocess too, which would sever
    // its TCP connection anyway, but that races the kill; resolving it here
    // directly avoids a dangling "awaiting decision" card in the UI and lets
    // handle_permission_connection's thread exit immediately instead of
    // waiting out the 10-minute timeout.
    {
        let mut guard = pending_permissions();
        let stale: Vec<String> = guard.iter()
            .filter(|(_, (pid, _))| pid == &project_id)
            .map(|(rid, _)| rid.clone())
            .collect();
        for rid in stale {
            if let Some((_, tx)) = guard.remove(&rid) {
                tx.send(json!({ "decision": "deny", "reason": "Session stopped" })).ok();
            }
        }
    }
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
