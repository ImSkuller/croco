// Docker module (v2.0, beta) — see docs/modules-plan.md. Shells out to the
// user's own `docker compose` CLI (same "no extra crate, no daemon API
// client, just the same binary the user already has" approach run_ops.rs
// takes for regular project run/stop) — no daemon socket access, no extra
// permissions beyond what running `docker` in a terminal already needs.

use serde_json::{json, Value};
use std::path::Path;
use std::process::Command;
use tauri::AppHandle;

const COMPOSE_FILENAMES: [&str; 4] = ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"];

fn compose_file(app: &AppHandle, project_id: &str) -> Result<(String, String), String> {
    crate::validate_safe_id(project_id)?;
    let project = crate::get_project(app, project_id).ok_or("Project not found")?;
    let root = crate::project_root_str(&project);
    for name in COMPOSE_FILENAMES {
        if Path::new(&root).join(name).exists() {
            return Ok((root, name.to_string()));
        }
    }
    Err("No docker-compose file found in this project.".into())
}

fn run_compose(root: &str, file: &str, args: &[&str]) -> Result<String, String> {
    let mut cmd = Command::new("docker");
    cmd.args(["compose", "-f", file]).args(args).current_dir(root);
    crate::no_window(&mut cmd);
    let output = cmd.output().map_err(|_| "Could not run `docker` — is Docker installed and on PATH?".to_string())?;
    let out = String::from_utf8_lossy(&output.stdout).to_string();
    let err = String::from_utf8_lossy(&output.stderr).to_string();
    if output.status.success() {
        Ok(out)
    } else {
        Err(if err.trim().is_empty() { out } else { err })
    }
}

#[tauri::command]
pub fn docker_compose_available(app: AppHandle, project_id: String) -> bool {
    compose_file(&app, &project_id).is_ok()
}

#[tauri::command]
pub async fn docker_compose_services(app: AppHandle, project_id: String) -> Result<Vec<Value>, String> {
    let (root, file) = compose_file(&app, &project_id)?;
    let services_out = run_compose(&root, &file, &["config", "--services"])?;
    let defined: Vec<String> = services_out.lines().map(|l| l.trim().to_string()).filter(|l| !l.is_empty()).collect();

    // Best-effort status — `ps --format json` is Compose v2.21+; an older
    // CLI or a project with nothing started yet just leaves every service
    // reported as "stopped" rather than failing the whole call.
    let mut running = std::collections::HashMap::new();
    if let Ok(ps_out) = run_compose(&root, &file, &["ps", "--all", "--format", "json"]) {
        for line in ps_out.lines() {
            if let Ok(v) = serde_json::from_str::<Value>(line) {
                if let Some(name) = v["Service"].as_str() {
                    running.insert(name.to_string(), v["State"].as_str().unwrap_or("unknown").to_string());
                }
            }
        }
    }

    Ok(defined.into_iter().map(|name| {
        let status = running.get(&name).cloned().unwrap_or_else(|| "stopped".to_string());
        json!({ "name": name, "status": status })
    }).collect())
}

#[tauri::command]
pub async fn docker_compose_up(app: AppHandle, project_id: String, service: Option<String>) -> Result<(), String> {
    let (root, file) = compose_file(&app, &project_id)?;
    let mut args = vec!["up", "-d"];
    if let Some(s) = &service { args.push(s); }
    run_compose(&root, &file, &args)?;
    crate::activity_log(&app, "docker.compose_up", json!({ "projectId": project_id, "service": service }));
    Ok(())
}

#[tauri::command]
pub async fn docker_compose_stop(app: AppHandle, project_id: String, service: Option<String>) -> Result<(), String> {
    let (root, file) = compose_file(&app, &project_id)?;
    let mut args = vec!["stop"];
    if let Some(s) = &service { args.push(s); }
    run_compose(&root, &file, &args)?;
    crate::activity_log(&app, "docker.compose_stop", json!({ "projectId": project_id, "service": service }));
    Ok(())
}

#[tauri::command]
pub async fn docker_compose_down(app: AppHandle, project_id: String) -> Result<(), String> {
    let (root, file) = compose_file(&app, &project_id)?;
    run_compose(&root, &file, &["down"])?;
    crate::activity_log(&app, "docker.compose_down", json!({ "projectId": project_id }));
    Ok(())
}

#[tauri::command]
pub async fn docker_compose_logs(app: AppHandle, project_id: String, service: Option<String>) -> Result<String, String> {
    let (root, file) = compose_file(&app, &project_id)?;
    let mut args = vec!["logs", "--no-color", "--tail", "300"];
    if let Some(s) = &service { args.push(s); }
    run_compose(&root, &file, &args)
}
