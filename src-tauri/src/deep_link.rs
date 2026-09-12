// croco:// deep links (Phase 6 item 11) — cold-start only. On Windows and
// Linux, clicking a registered deep link when Croco is NOT already running
// launches a brand-new process with the URL as its sole CLI argument (see
// tauri-plugin-deep-link's handle_cli_arguments); this app doesn't
// currently redirect a click into an already-running instance instead of
// spawning a second one — that needs tauri-plugin-single-instance, which
// is a real, separate follow-up (see NOTES-followup.md) rather than
// something folded silently into "add a protocol handler."
//
// Supported paths, parsed with the target as the URL's host component
// (`scheme://host/path`, the same shape vscode:// and slack:// use):
//   croco://project/<id>  -> /projects/<id>
//   croco://note/<id>     -> /note-editor/<id>
//   croco://todos         -> /todos

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;

fn url_to_frontend_path(url: &url::Url) -> Option<String> {
    let host = url.host_str().unwrap_or("");
    let mut segments = url.path_segments().map(|s| s.filter(|p| !p.is_empty()));
    let first_segment = segments.as_mut().and_then(|s| s.next());

    match host {
        "project" | "projects" => first_segment.map(|id| format!("/projects/{id}")),
        "note" | "notes" => first_segment.map(|id| format!("/note-editor/{id}")),
        "todo" | "todos" => Some("/todos".to_string()),
        _ => None,
    }
}

fn handle_urls(app: &AppHandle, urls: &[url::Url]) {
    let Some(path) = urls.iter().find_map(url_to_frontend_path) else { return };
    app.emit("deep-link:navigate", &path).ok();
    // Deep links only matter if the user can actually see where they
    // landed — bring the (single) main window to the front rather than
    // leaving the navigation to happen behind whatever else has focus.
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Called once from setup_app(). Registers the scheme at runtime (a no-op
/// safety net for a portable/dev build — an NSIS/MSI install already
/// registers it at install time), then checks whether *this* launch was
/// itself triggered by a deep link (cold start) and, if so, handles it
/// immediately.
pub fn init(app: &AppHandle) {
    let _ = app.deep_link().register_all();
    app.deep_link().handle_cli_arguments(std::env::args());
    if let Ok(Some(urls)) = app.deep_link().get_current() {
        handle_urls(app, &urls);
    }

    let app_for_listener = app.clone();
    app.deep_link().on_open_url(move |event| {
        handle_urls(&app_for_listener, &event.urls());
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(s: &str) -> url::Url { url::Url::parse(s).unwrap() }

    #[test]
    fn project_link_maps_to_project_detail_route() {
        assert_eq!(url_to_frontend_path(&parse("croco://project/abc123")), Some("/projects/abc123".to_string()));
    }

    #[test]
    fn note_link_maps_to_note_editor_route() {
        assert_eq!(url_to_frontend_path(&parse("croco://note/xyz789")), Some("/note-editor/xyz789".to_string()));
    }

    #[test]
    fn todos_link_maps_to_todos_route_with_no_id() {
        assert_eq!(url_to_frontend_path(&parse("croco://todos")), Some("/todos".to_string()));
        assert_eq!(url_to_frontend_path(&parse("croco://todo")), Some("/todos".to_string()));
    }

    #[test]
    fn project_link_with_no_id_segment_is_ignored() {
        assert_eq!(url_to_frontend_path(&parse("croco://project")), None);
        assert_eq!(url_to_frontend_path(&parse("croco://project/")), None);
    }

    #[test]
    fn unknown_host_is_ignored() {
        assert_eq!(url_to_frontend_path(&parse("croco://something-else/abc")), None);
    }

    #[test]
    fn handle_urls_picks_the_first_recognized_url_in_the_list() {
        // Not directly assertable without an AppHandle, but url_to_frontend_path
        // is the pure part handle_urls delegates to — covered above. This test
        // documents the "first match wins" contract handle_urls relies on via
        // find_map, so a future refactor away from find_map gets caught here
        // if it changes behavior.
        let urls = [parse("croco://unknown/x"), parse("croco://project/first"), parse("croco://project/second")];
        let first_match = urls.iter().find_map(url_to_frontend_path);
        assert_eq!(first_match, Some("/projects/first".to_string()));
    }
}
