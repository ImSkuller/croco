// Running a project's dev/build/start/test command (or any ad-hoc script)
// as a child process, streaming stdout/stderr back to the frontend over
// run:output events. One process per project at a time, tracked in
// RUNNING_PIDS so run_start can refuse a second concurrent run and
// run_stop/run_is_running know what to signal.

use once_cell::sync::Lazy;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::thread;
use tauri::{AppHandle, Emitter};

static RUNNING_PIDS: Lazy<Mutex<HashMap<String, u32>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

fn resolve_run_command(project: &Value, command_type: &str) -> Option<String> {
    let cmds = &project["commands"];
    if let Some(s) = cmds[command_type].as_str().filter(|s| !s.is_empty()) {
        return Some(s.to_string());
    }
    if !["dev", "build", "start", "test"].contains(&command_type) {
        return Some(command_type.to_string());
    }
    None
}

pub fn emit_toast(app: &AppHandle, title: &str, body: &str, kind: &str) {
    app.emit("notify:toast", json!({ "title": title, "body": body, "type": kind })).ok();
}

#[tauri::command]
pub fn run_start(app: AppHandle, project_id: String, command_type: String, env: Option<Value>, confirmed: Option<bool>) -> Result<Value, String> {
    if RUNNING_PIDS.lock().unwrap().contains_key(&project_id) {
        return Err("Already running. Stop it first.".into());
    }

    let project = crate::get_project(&app, &project_id).ok_or("Project not found")?;
    let project_name = project["name"].as_str().unwrap_or("Unknown").to_string();
    let cmd = resolve_run_command(&project, &command_type)
        .ok_or_else(|| format!("No command for type \"{}\"", command_type))?;

    // A freshly created/imported project's commands came from scanning
    // package.json/etc in the (possibly just-cloned, possibly hostile)
    // project folder — require one explicit "yes, run this" before ever
    // executing it. Projects that predate this check (no field at all)
    // default to already-confirmed so existing users aren't suddenly
    // blocked from a command they've already been running.
    let already_confirmed = project.get("commandsConfirmed").map(|v| v.as_bool().unwrap_or(true)).unwrap_or(true);
    if !already_confirmed && !confirmed.unwrap_or(false) {
        return Ok(json!({ "needsConfirmation": true, "command": cmd }));
    }
    if !already_confirmed {
        crate::projects_edit(app.clone(), project_id.clone(), json!({ "commandsConfirmed": true }))?;
    }

    let cwd = crate::project_root_str(&project);

    let extra_env: HashMap<String, String> = env
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    // Resolve shell from project setting → settings.defaults.shell → platform default
    let settings = crate::read_settings(&app);
    let shell_pref = project["shell"].as_str()
        .filter(|s| !s.is_empty())
        .or_else(|| settings["defaults"]["shell"].as_str().filter(|s| !s.is_empty()))
        .unwrap_or("");

    let mut child = {
        #[cfg(windows)]
        {
            let (sh, flag) = match shell_pref {
                "powershell" | "pwsh" => ("powershell", "-Command"),
                _ => ("cmd", "/c"),
            };
            let mut c = Command::new(sh);
            c.args([flag, &cmd])
             .current_dir(&cwd)
             .stdout(Stdio::piped())
             .stderr(Stdio::piped())
             .envs(&extra_env);
            crate::no_window(&mut c);
            c.spawn().map_err(|e| e.to_string())?
        }
        #[cfg(not(windows))]
        {
            use std::os::unix::process::CommandExt;
            let sh = match shell_pref {
                "bash" => "bash",
                "zsh"  => "zsh",
                "fish" => "fish",
                _      => "sh",
            };
            let mut c = Command::new(sh);
            c.args(["-c", &cmd])
             .current_dir(&cwd)
             .stdout(Stdio::piped())
             .stderr(Stdio::piped())
             .envs(&extra_env)
             // New process group (pgid = own pid) so run_stop can signal the
             // whole tree via the negative pid — mirrors `taskkill /T` on
             // Windows. Without this, only the shell itself gets killed and
             // any child it spawned (e.g. `npm run dev` → node) leaks.
             .process_group(0);
            c.spawn().map_err(|e| e.to_string())?
        }
    };

    let pid = child.id();
    RUNNING_PIDS.lock().unwrap().insert(project_id.clone(), pid);

    app.emit("run:started", json!({ "projectId": project_id, "command": cmd })).ok();
    crate::activity_log(&app, "run.started", json!({ "projectId": project_id, "projectName": project_name, "command": cmd }));

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    // Thread: read stdout
    {
        let app = app.clone(); let pid = project_id.clone();
        thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                app.emit("run:output", json!({ "projectId": pid, "text": line, "type": "stdout" })).ok();
            }
        });
    }
    // Thread: read stderr
    {
        let app = app.clone(); let pid = project_id.clone();
        thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                app.emit("run:output", json!({ "projectId": pid, "text": line, "type": "stderr" })).ok();
            }
        });
    }
    // Thread: wait for exit
    {
        let app = app.clone(); let pid = project_id.clone(); let pname = project_name.clone();
        thread::spawn(move || {
            let code = child.wait().map(|s| s.code().unwrap_or(0)).unwrap_or(-1);
            RUNNING_PIDS.lock().unwrap().remove(&pid);
            app.emit("run:finished", json!({ "projectId": pid, "exitCode": code })).ok();
            crate::activity_log(&app, "run.finished", json!({ "projectId": pid, "projectName": pname, "exitCode": code }));
            let ok = code == 0;
            emit_toast(&app, &pname, &format!("Process exited (code {})", code), if ok { "success" } else { "error" });
        });
    }

    Ok(json!({ "ok": true, "command": cmd }))
}

#[tauri::command]
pub async fn run_stop(project_id: String) -> Result<Value, String> {
    let pid = RUNNING_PIDS.lock().unwrap().remove(&project_id);
    if let Some(pid) = pid {
        #[cfg(windows)]
        {
            // Send Ctrl+C to the process group first, then force-kill the tree
            let pid_str = pid.to_string();
            let mut c = Command::new("taskkill");
            c.args(["/PID", &pid_str, "/T"]);
            crate::no_window(&mut c);
            c.output().ok();
            std::thread::sleep(std::time::Duration::from_millis(500));
            let mut c2 = Command::new("taskkill");
            c2.args(["/PID", &pid_str, "/F", "/T"]);
            crate::no_window(&mut c2);
            c2.output().ok();
        }
        #[cfg(not(windows))]
        {
            // Signal the whole process group (negative pid, `--` guards
            // against it being parsed as an option) so children spawned by
            // the shell are killed too — SIGINT first, then SIGTERM.
            let pgid = format!("-{}", pid);
            Command::new("kill").args(["-INT",  "--", &pgid]).output().ok();
            std::thread::sleep(std::time::Duration::from_millis(500));
            Command::new("kill").args(["-TERM", "--", &pgid]).output().ok();
        }
        Ok(json!({ "ok": true }))
    } else {
        Ok(json!({ "ok": false, "message": "Not running" }))
    }
}

#[tauri::command]
pub fn run_get_running() -> Vec<String> {
    RUNNING_PIDS.lock().unwrap().keys().cloned().collect()
}

#[tauri::command]
pub fn run_is_running(project_id: String) -> bool {
    RUNNING_PIDS.lock().unwrap().contains_key(&project_id)
}
