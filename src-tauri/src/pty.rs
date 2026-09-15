// A real interactive terminal (v2.0) — unlike run_ops.rs (which runs one
// fixed preset command — dev/build/start/test — to completion and streams
// its output), this spawns the user's actual shell inside a pseudo-
// terminal so it behaves like a real console: line editing, ANSI colors,
// cursor movement, Ctrl+C, and the ability to type any command at all, not
// just the presets. Backed by the `portable-pty` crate (ConPTY on Windows,
// forkpty on Unix), paired with xterm.js on the frontend for the ANSI
// rendering side — reinventing either half would be reinventing a very
// mature wheel.
//
// One session per open terminal pane, tracked by a generated id (not tied
// to project_id the way run_ops.rs's RUNNING_PIDS is, since a project could
// reasonably have more than one terminal pane open at once).

#![deny(clippy::unwrap_used)]

use once_cell::sync::Lazy;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde_json::json;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Mutex, PoisonError};
use std::thread;
use tauri::{AppHandle, Emitter};

struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
}

static PTY_SESSIONS: Lazy<Mutex<HashMap<String, PtySession>>> = Lazy::new(|| Mutex::new(HashMap::new()));

fn sessions() -> std::sync::MutexGuard<'static, HashMap<String, PtySession>> {
    PTY_SESSIONS.lock().unwrap_or_else(PoisonError::into_inner)
}

// Same shell-resolution order run_ops.rs already uses (project.shell ->
// settings.defaults.shell -> platform default) — kept identical rather
// than introducing a second, slightly-different scheme for the new
// interactive terminal.
fn resolve_shell_command(app: &AppHandle, project_id: &str) -> CommandBuilder {
    let project = crate::get_project(app, project_id).unwrap_or(json!({}));
    let settings = crate::read_settings(app);
    let shell_pref = project["shell"].as_str()
        .filter(|s| !s.is_empty())
        .or_else(|| settings["defaults"]["shell"].as_str().filter(|s| !s.is_empty()))
        .unwrap_or("")
        .to_string();

    #[cfg(windows)]
    {
        let sh = match shell_pref.as_str() {
            "powershell" | "pwsh" => "powershell.exe",
            _ => "cmd.exe",
        };
        CommandBuilder::new(sh)
    }
    #[cfg(not(windows))]
    {
        let sh = match shell_pref.as_str() {
            "bash" => "bash",
            "zsh"  => "zsh",
            "fish" => "fish",
            _      => "sh",
        };
        CommandBuilder::new(sh)
    }
}

#[tauri::command]
pub async fn pty_spawn(app: AppHandle, project_id: String, cols: u16, rows: u16) -> Result<String, String> {
    crate::validate_safe_id(&project_id)?;
    let project = crate::get_project(&app, &project_id).ok_or("Project not found")?;
    let cwd = crate::project_root_str(&project);

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| e.to_string())?;

    let mut cmd = resolve_shell_command(&app, &project_id);
    cmd.cwd(&cwd);

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    // The slave side is only needed to spawn the child — portable-pty's own
    // docs note it's fine (and necessary on some platforms to avoid holding
    // the pty open forever) to drop it once spawn_command has returned.
    drop(pair.slave);

    let reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    let session_id = uuid::Uuid::new_v4().to_string();
    sessions().insert(session_id.clone(), PtySession { master: pair.master, writer, child });

    // Reader thread: forward raw output to the frontend as it arrives, not
    // line-buffered — a real terminal needs to render partial lines,
    // cursor-movement escapes, and prompts with no trailing newline
    // immediately, the same reason run_ops.rs's line-buffered approach
    // isn't reused here.
    {
        let app = app.clone();
        let sid = session_id.clone();
        let mut reader = reader;
        thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let text = String::from_utf8_lossy(&buf[..n]).to_string();
                        app.emit("pty:output", json!({ "sessionId": sid, "data": text })).ok();
                    }
                    Err(_) => break,
                }
            }
            // The child may already be gone from `sessions()` if pty_kill
            // removed it first — that's fine, this is just the natural
            // "shell exited on its own" path.
            let exit_code = sessions().get_mut(&sid).and_then(|s| s.child.wait().ok()).map(|s| s.exit_code());
            sessions().remove(&sid);
            app.emit("pty:exit", json!({ "sessionId": sid, "exitCode": exit_code })).ok();
        });
    }

    Ok(session_id)
}

#[tauri::command]
pub async fn pty_write(session_id: String, data: String) -> Result<(), String> {
    let mut guard = sessions();
    let session = guard.get_mut(&session_id).ok_or("No such terminal session")?;
    session.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pty_resize(session_id: String, cols: u16, rows: u16) -> Result<(), String> {
    let guard = sessions();
    let session = guard.get(&session_id).ok_or("No such terminal session")?;
    session.master.resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 }).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pty_kill(session_id: String) -> Result<(), String> {
    let mut guard = sessions();
    if let Some(mut session) = guard.remove(&session_id) {
        session.child.kill().ok();
    }
    Ok(())
}
