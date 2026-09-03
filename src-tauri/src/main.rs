#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Manager};

mod obsidian;
use obsidian::{obsidian_sync_all, obsidian_test_vault_path};

mod personality;
use personality::{personality_backfill_from_activity, personality_get_profile, personality_scan_commits, personality_track_app_open};

mod db;
pub(crate) use db::*;

mod settings;
pub(crate) use settings::*;

mod activity;
pub(crate) use activity::*;

mod git_ops;
pub(crate) use git_ops::*;

mod github_ops;
pub(crate) use github_ops::*;

mod run_ops;
pub(crate) use run_ops::*;

mod notes_todos;
pub(crate) use notes_todos::*;

mod schedules;
pub(crate) use schedules::*;

mod system;
pub(crate) use system::*;

mod data_transfer;
pub(crate) use data_transfer::*;

mod updates;
pub(crate) use updates::*;

mod secrets;
pub(crate) use secrets::*;

mod projects;
pub(crate) use projects::*;

// ─── Global state ──────────────────────────────────────────────────────────────

// User-Agent for all GitHub API calls — always matches the app version.
const UA: &str = concat!("Croco-DevManager/", env!("CARGO_PKG_VERSION"));

// ─── Suppress console window on Windows for all child processes ───────────────

#[cfg(windows)]
fn no_window(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
}

// No console window to suppress outside Windows — a no-op so every call
// site stays platform-agnostic.
#[cfg(not(windows))]
fn no_window(_cmd: &mut Command) {}

// ─── Path helpers ──────────────────────────────────────────────────────────────

fn app_data_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| dirs::data_local_dir().unwrap_or_default().join("croco"))
}

fn settings_path(app: &AppHandle) -> PathBuf {
    app_data_dir(app).join("settings.json")
}

fn projects_data_dir(app: &AppHandle) -> PathBuf {
    let s = read_settings(app);
    if let Some(custom) = s["app"]["dataPath"].as_str() {
        if !custom.is_empty() {
            return PathBuf::from(custom);
        }
    }
    app_data_dir(app)
}

fn project_details_dir(app: &AppHandle) -> PathBuf {
    projects_data_dir(app).join("project-details")
}

fn project_file(app: &AppHandle, id: &str) -> PathBuf {
    project_details_dir(app).join(format!("{}.json", id))
}

fn notes_dir(app: &AppHandle) -> PathBuf {
    projects_data_dir(app).join("notes")
}

fn todos_dir(app: &AppHandle) -> PathBuf {
    projects_data_dir(app).join("todos")
}

fn schedules_dir(app: &AppHandle) -> PathBuf {
    projects_data_dir(app).join("schedules")
}

fn activity_file(app: &AppHandle) -> PathBuf {
    app_data_dir(app).join("activity.json")
}

// ─── App setup ─────────────────────────────────────────────────────────────────

fn setup_app(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::{
        menu::{Menu, MenuItem, PredefinedMenuItem},
        tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    };

    // Ensure app data dirs exist
    let handle = app.handle().clone();
    let data_dir = app_data_dir(&handle);
    for sub in &["notes", "todos", "schedules"] {
        fs::create_dir_all(data_dir.join(sub)).ok();
    }

    // Hidden projects dir
    let settings = read_settings(&handle);
    if let Some(hidden) = settings["paths"]["hiddenProjects"].as_str() {
        fs::create_dir_all(hidden).ok();
        #[cfg(windows)]
        { let mut c = Command::new("attrib"); c.args(["+h", hidden]); no_window(&mut c); c.output().ok(); }
    }

    // Ensure settings.json exists
    let sp = settings_path(&handle);
    if !sp.exists() {
        let _ = write_settings(&handle, &default_settings());
    }

    // Secret storage: probe the OS keyring once so the UI's fallback warning
    // is accurate from launch, then sweep any plaintext secret left by a
    // pre-1.14 install into it (idempotent — a no-op on every later launch).
    probe_keyring_available();
    migrate_secrets_to_keyring(&handle);

    // Build tray menu
    let show  = MenuItem::with_id(app, "show",  "Show Window", true, None::<&str>)?;
    let sep   = PredefinedMenuItem::separator(app)?;
    let quit  = MenuItem::with_id(app, "quit",  "Quit",        true, None::<&str>)?;
    let menu  = Menu::with_items(app, &[&show, &sep, &quit])?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("Croco")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => app.exit(0),
            "show" => {
                if let Some(w) = app.get_webview_window("main") {
                    w.show().ok(); w.set_focus().ok();
                }
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                let app = tray.app_handle();
                if let Some(w) = app.get_webview_window("main") {
                    w.show().ok(); w.set_focus().ok();
                }
            }
        })
        .build(app)?;

    // Close behavior
    if let Some(win) = app.get_webview_window("main") {
        let win_clone   = win.clone();
        let app_handle  = app.handle().clone();
        win.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let behavior = read_settings(&app_handle)["app"]["closeBehavior"]
                    .as_str().unwrap_or("tray").to_string();
                if behavior == "tray" {
                    api.prevent_close();
                    win_clone.hide().ok();
                }
            }
        });
    }

    Ok(())
}

// ─── Main ──────────────────────────────────────────────────────────────────────

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| setup_app(app))
        .invoke_handler(tauri::generate_handler![
            // settings
            settings_get, settings_set, settings_update, settings_reset,
            settings_test_github, settings_save_avatar, settings_set_github_token,
            // projects
            projects_get_all, projects_get_by_id, projects_create, projects_import,
            projects_edit, projects_delete, projects_open_in_ide, projects_open_folder,
            projects_toggle_favorite, projects_get_recents, projects_detect_languages,
            projects_auto_detect_commands, projects_remove_local_files, projects_delete_github_repo,
            projects_get_dependencies, projects_install_dependencies, projects_update_dependencies,
            projects_add_dependency, projects_remove_dependency, projects_get_file_tree,
            projects_get_scripts, projects_rename, projects_set_archived,
            // git
            git_status, git_commit, git_get_log, git_is_repo, git_get_branches,
            git_switch_branch, git_create_branch, git_push, git_get_readme, git_pull,
            git_stage_files, git_unstage_files, git_diff_file,
            git_get_ahead_behind,
            // git tags & version diffing (GitHub page: Releases, Changelog, Insights tabs)
            git_list_tags, git_create_tag, git_get_commits_between, git_diff_between_refs,
            git_get_commit_dates,
            // github api (GitHub page: Overview, Releases tabs)
            github_get_repo_info, github_list_releases, github_create_release,
            // run
            run_start, run_stop, run_get_running, run_is_running,
            // notes
            notes_get_all, notes_get_by_id, notes_create, notes_update, notes_delete,
            // todos
            todos_get_all, todos_create, todos_toggle, todos_update, todos_delete,
            // schedules & deadlines
            schedules_get_all, schedules_get_by_id, schedules_create, schedules_update,
            schedules_toggle, schedules_delete,
            // activity
            activity_get_all, activity_clear,
            // system
            system_open_path, system_open_external, system_open_in_app_browser, system_path_exists,
            system_homedir, system_platform, system_user_data,
            system_lookup_community_user, system_validate_github_username,
            system_write_bytes,
            // templates
            templates_list,
            // notify
            notify_send, notify_send_desktop, notify_desktop_permission_granted, notify_request_desktop_permission,
            // updates
            updates_check, updates_install, app_exit,
            // github oauth
            github_oauth_configured, github_oauth_start, github_oauth_poll,
            // git cross-project
            git_get_all_recent_commits, git_sync_all_last_commit_dates,
            // storage
            migrate_to_sqlite, switch_storage_backend,
            // app lifecycle
            app_restart,
            // git extras
            git_init_repo, git_add_to_gitignore,
            // project extras
            projects_publish_to_github,
            // premium
            premium_validate_key,
            // data backup / restore
            data_export_all, data_import_all,
            // obsidian vault sync
            obsidian_sync_all, obsidian_test_vault_path,
            // personality / work-habits tracking
            personality_get_profile, personality_backfill_from_activity, personality_scan_commits, personality_track_app_open,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}

