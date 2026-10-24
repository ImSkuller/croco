// Project Insights: three read-only analyses of a project folder, each run on
// demand from the project's Overview tab (never in the background).
//
//  - code_stats  — lines of code / comments / blanks per language. The idea
//                  and the code-vs-comment-vs-blank split come from tokei and
//                  cloc (MIT / GPL tools); this is a small independent
//                  re-implementation covering the common languages, not a
//                  copy of their language tables.
//  - scan_todos  — TODO / FIXME / HACK / XXX / BUG markers inside comments,
//                  the same idea as the VS Code "Todo Tree" and leasot.
//  - audit_deps  — known-vulnerability lookup against OSV.dev's free,
//                  keyless API (https://google.github.io/osv.dev/api/). Only
//                  package names and versions are sent, and only when the
//                  user presses the button.

use serde_json::{json, Value};
use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use walkdir::WalkDir;

const SKIP_DIRS: &[&str] = &[
    "node_modules", ".git", "dist", "build", ".next", "out", "target", "vendor", ".cache",
    ".svelte-kit", ".nuxt", "coverage", "__pycache__", ".venv", "venv", ".turbo", "cli-bin",
];
const MAX_FILES: usize = 20_000;
const MAX_FILE_BYTES: u64 = 1_000_000;

struct Lang {
    name: &'static str,
    exts: &'static [&'static str],
    line: &'static [&'static str],
    block: Option<(&'static str, &'static str)>,
}

const C_LIKE: Option<(&str, &str)> = Some(("/*", "*/"));

const LANGS: &[Lang] = &[
    Lang { name: "JavaScript", exts: &["js", "jsx", "mjs", "cjs"], line: &["//"], block: C_LIKE },
    Lang { name: "TypeScript", exts: &["ts", "tsx"], line: &["//"], block: C_LIKE },
    Lang { name: "Rust", exts: &["rs"], line: &["//"], block: C_LIKE },
    Lang { name: "Python", exts: &["py"], line: &["#"], block: None },
    Lang { name: "Go", exts: &["go"], line: &["//"], block: C_LIKE },
    Lang { name: "Java", exts: &["java"], line: &["//"], block: C_LIKE },
    Lang { name: "Kotlin", exts: &["kt", "kts"], line: &["//"], block: C_LIKE },
    Lang { name: "C", exts: &["c", "h"], line: &["//"], block: C_LIKE },
    Lang { name: "C++", exts: &["cpp", "cc", "cxx", "hpp", "hh"], line: &["//"], block: C_LIKE },
    Lang { name: "C#", exts: &["cs"], line: &["//"], block: C_LIKE },
    Lang { name: "Swift", exts: &["swift"], line: &["//"], block: C_LIKE },
    Lang { name: "PHP", exts: &["php"], line: &["//", "#"], block: C_LIKE },
    Lang { name: "Ruby", exts: &["rb"], line: &["#"], block: None },
    Lang { name: "Dart", exts: &["dart"], line: &["//"], block: C_LIKE },
    Lang { name: "Shell", exts: &["sh", "bash", "zsh"], line: &["#"], block: None },
    Lang { name: "PowerShell", exts: &["ps1"], line: &["#"], block: Some(("<#", "#>")) },
    Lang { name: "HTML", exts: &["html", "htm"], line: &[], block: Some(("<!--", "-->")) },
    Lang { name: "CSS", exts: &["css", "scss", "less"], line: &[], block: C_LIKE },
    Lang { name: "Vue", exts: &["vue"], line: &["//"], block: Some(("<!--", "-->")) },
    Lang { name: "Svelte", exts: &["svelte"], line: &["//"], block: Some(("<!--", "-->")) },
    Lang { name: "SQL", exts: &["sql"], line: &["--"], block: C_LIKE },
    Lang { name: "Lua", exts: &["lua"], line: &["--"], block: Some(("--[[", "]]")) },
    Lang { name: "YAML", exts: &["yml", "yaml"], line: &["#"], block: None },
    Lang { name: "TOML", exts: &["toml"], line: &["#"], block: None },
    Lang { name: "JSON", exts: &["json"], line: &[], block: None },
    Lang { name: "Markdown", exts: &["md", "mdx"], line: &[], block: None },
];

fn lang_for(path: &Path) -> Option<&'static Lang> {
    let ext = path.extension()?.to_str()?.to_lowercase();
    LANGS.iter().find(|l| l.exts.contains(&ext.as_str()))
}

fn project_root(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    crate::validate_safe_id(id)?;
    let project = crate::get_project(app, id).ok_or("Project not found")?;
    let root = PathBuf::from(crate::project_root_str(&project));
    if root.as_os_str().is_empty() || !root.is_dir() {
        return Err("The project's folder doesn't exist on this machine.".into());
    }
    Ok(root)
}

/// Source files under `root`, skipping vendored/build output and hidden dirs.
fn source_files(root: &Path) -> Vec<PathBuf> {
    WalkDir::new(root)
        .max_depth(14)
        .into_iter()
        .filter_entry(|e| {
            if e.depth() == 0 { return true; }
            let name = e.file_name().to_string_lossy();
            !(e.file_type().is_dir() && (SKIP_DIRS.contains(&name.as_ref()) || name.starts_with('.')))
        })
        .flatten()
        .filter(|e| e.file_type().is_file())
        .map(|e| e.into_path())
        .filter(|p| p.metadata().map(|m| m.len() <= MAX_FILE_BYTES).unwrap_or(false))
        .take(MAX_FILES)
        .collect()
}

fn read_text(path: &Path) -> Option<String> {
    let bytes = fs::read(path).ok()?;
    if bytes.iter().take(4096).any(|b| *b == 0) { return None; } // binary
    String::from_utf8(bytes).ok()
}

// ─── code stats ─────────────────────────────────────────────────────────────

#[derive(Default)]
struct Tally { files: u64, code: u64, comments: u64, blanks: u64 }

fn count_lines(lang: &Lang, text: &str, t: &mut Tally) {
    let mut in_block = false;
    for raw in text.lines() {
        let line = raw.trim();
        if line.is_empty() { t.blanks += 1; continue; }
        if in_block {
            t.comments += 1;
            if let Some((_, close)) = lang.block { if line.contains(close) { in_block = false; } }
            continue;
        }
        if lang.line.iter().any(|p| line.starts_with(p)) { t.comments += 1; continue; }
        if let Some((open, close)) = lang.block {
            if let Some(rest) = line.strip_prefix(open) {
                t.comments += 1;
                // Opens and closes on the same line → not a multi-line block.
                if !rest.contains(close) { in_block = true; }
                continue;
            }
        }
        t.code += 1;
    }
}

#[tauri::command]
pub async fn insights_code_stats(app: AppHandle, id: String) -> Result<Value, String> {
    let root = project_root(&app, &id)?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut by_lang: BTreeMap<&'static str, Tally> = BTreeMap::new();
        for path in source_files(&root) {
            let Some(lang) = lang_for(&path) else { continue };
            let Some(text) = read_text(&path) else { continue };
            let t = by_lang.entry(lang.name).or_default();
            t.files += 1;
            count_lines(lang, &text, t);
        }
        let mut rows: Vec<(&str, Tally)> = by_lang.into_iter().collect();
        rows.sort_by_key(|r| std::cmp::Reverse(r.1.code));
        let totals = rows.iter().fold(Tally::default(), |mut acc, (_, t)| {
            acc.files += t.files; acc.code += t.code; acc.comments += t.comments; acc.blanks += t.blanks; acc
        });
        json!({
            "languages": rows.iter().map(|(n, t)| json!({ "name": n, "files": t.files, "code": t.code, "comments": t.comments, "blanks": t.blanks })).collect::<Vec<_>>(),
            "totals": { "files": totals.files, "code": totals.code, "comments": totals.comments, "blanks": totals.blanks },
        })
    })
    .await
    .map_err(|e| e.to_string())
}

// ─── TODO / FIXME scanner ───────────────────────────────────────────────────

const TAGS: &[&str] = &["TODO", "FIXME", "HACK", "XXX", "BUG"];
const COMMENT_TOKENS: &[&str] = &["//", "#", "/*", "*", "--", "<!--", ";", "\"\"\""];

fn find_marker(line: &str) -> Option<(&'static str, String)> {
    for tag in TAGS {
        let mut from = 0;
        while let Some(rel) = line[from..].find(tag) {
            let at = from + rel;
            let before = &line[..at];
            let after = &line[at + tag.len()..];
            let boundary_before = before.chars().last().map(|c| !c.is_alphanumeric() && c != '_').unwrap_or(true);
            let boundary_after = after.chars().next().map(|c| !c.is_alphanumeric() && c != '_').unwrap_or(true);
            if boundary_before && boundary_after && COMMENT_TOKENS.iter().any(|t| before.contains(t)) {
                let text = after.trim_start_matches(|c: char| c == ':' || c == '(' || c == ')' || c.is_whitespace() || c == '-');
                let text = text.trim_end_matches("*/").trim_end_matches("-->").trim();
                return Some((tag, text.chars().take(160).collect()));
            }
            from = at + tag.len();
        }
    }
    None
}

#[tauri::command]
pub async fn insights_scan_todos(app: AppHandle, id: String) -> Result<Value, String> {
    let root = project_root(&app, &id)?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut items = vec![];
        let mut total = 0usize;
        for path in source_files(&root) {
            if lang_for(&path).is_none() { continue; }
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if name.ends_with(".min.js") || name.ends_with(".lock") || name == "package-lock.json" { continue; }
            let Some(text) = read_text(&path) else { continue };
            for (i, line) in text.lines().enumerate() {
                if line.len() > 400 { continue; }
                if let Some((tag, msg)) = find_marker(line) {
                    total += 1;
                    if items.len() < 300 {
                        let rel = path.strip_prefix(&root).unwrap_or(&path).to_string_lossy().replace('\\', "/");
                        items.push(json!({ "file": rel, "line": i + 1, "tag": tag, "text": msg }));
                    }
                }
            }
        }
        json!({ "total": total, "items": items, "truncated": total > items.len() })
    })
    .await
    .map_err(|e| e.to_string())
}

// ─── dependency audit (OSV.dev) ─────────────────────────────────────────────

type Parser = fn(&str) -> Vec<Dep>;

struct Dep { name: String, version: String, ecosystem: &'static str }

fn parse_package_lock(text: &str) -> Vec<Dep> {
    let Ok(v) = serde_json::from_str::<Value>(text) else { return vec![] };
    let mut seen = HashSet::new();
    let mut out = vec![];
    if let Some(pk) = v["packages"].as_object() {
        for (path, info) in pk {
            let Some(idx) = path.rfind("node_modules/") else { continue };
            let name = &path[idx + "node_modules/".len()..];
            let Some(ver) = info["version"].as_str() else { continue };
            if info["link"].as_bool().unwrap_or(false) { continue; }
            if seen.insert((name.to_string(), ver.to_string())) {
                out.push(Dep { name: name.to_string(), version: ver.to_string(), ecosystem: "npm" });
            }
        }
    }
    out
}

fn parse_cargo_lock(text: &str) -> Vec<Dep> {
    let mut out = vec![];
    let (mut name, mut version, mut registry) = (String::new(), String::new(), false);
    let mut flush = |name: &mut String, version: &mut String, registry: &mut bool| {
        if !name.is_empty() && !version.is_empty() && *registry {
            out.push(Dep { name: std::mem::take(name), version: std::mem::take(version), ecosystem: "crates.io" });
        }
        name.clear(); version.clear(); *registry = false;
    };
    for line in text.lines() {
        let line = line.trim();
        if line == "[[package]]" { flush(&mut name, &mut version, &mut registry); continue; }
        let val = |k: &str| line.strip_prefix(k).and_then(|r| r.trim().strip_prefix('=')).map(|r| r.trim().trim_matches('"').to_string());
        if let Some(v) = val("name") { name = v; }
        else if let Some(v) = val("version") { version = v; }
        else if let Some(v) = val("source") { registry = v.starts_with("registry+"); }
    }
    flush(&mut name, &mut version, &mut registry);
    out
}

fn parse_requirements(text: &str) -> Vec<Dep> {
    text.lines()
        .filter_map(|l| {
            let l = l.split('#').next()?.trim();
            let (n, v) = l.split_once("==")?;
            let v = v.split(';').next()?.trim();
            if n.is_empty() || v.is_empty() { return None; }
            Some(Dep { name: n.split('[').next()?.trim().to_string(), version: v.to_string(), ecosystem: "PyPI" })
        })
        .collect()
}

#[tauri::command]
pub async fn insights_audit_deps(app: AppHandle, id: String) -> Result<Value, String> {
    let root = project_root(&app, &id)?;
    let deps = tauri::async_runtime::spawn_blocking(move || {
        let mut deps: Vec<Dep> = vec![];
        let mut sources: Vec<&str> = vec![];
        let candidates: [(&str, Parser); 4] = [
            ("package-lock.json", parse_package_lock),
            ("Cargo.lock", parse_cargo_lock),
            ("src-tauri/Cargo.lock", parse_cargo_lock),
            ("requirements.txt", parse_requirements),
        ];
        for (file, parse) in candidates {
            if let Ok(text) = fs::read_to_string(root.join(file)) {
                deps.extend(parse(&text));
                sources.push(file);
            }
        }
        (deps, sources.iter().map(|s| s.to_string()).collect::<Vec<_>>())
    })
    .await
    .map_err(|e| e.to_string())?;
    let (deps, sources) = deps;
    if deps.is_empty() {
        return Ok(json!({ "supported": false, "scanned": 0, "vulnerable": [], "sources": sources }));
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent(format!("Croco/{}", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| e.to_string())?;

    // querybatch answers in input order with just the matching advisory ids.
    let mut hits: Vec<(usize, Vec<String>)> = vec![];
    for (chunk_no, chunk) in deps.chunks(500).enumerate() {
        let queries: Vec<Value> = chunk
            .iter()
            .map(|d| json!({ "package": { "name": d.name, "ecosystem": d.ecosystem }, "version": d.version }))
            .collect();
        let resp = client
            .post("https://api.osv.dev/v1/querybatch")
            .json(&json!({ "queries": queries }))
            .send()
            .await
            .map_err(|e| format!("Couldn't reach osv.dev: {e}"))?;
        if !resp.status().is_success() {
            return Err(format!("osv.dev answered {}", resp.status()));
        }
        let body: Value = resp.json().await.map_err(|e| e.to_string())?;
        for (i, r) in body["results"].as_array().cloned().unwrap_or_default().iter().enumerate() {
            let ids: Vec<String> = r["vulns"].as_array().map(|a| a.iter().filter_map(|v| v["id"].as_str().map(String::from)).collect()).unwrap_or_default();
            if !ids.is_empty() { hits.push((chunk_no * 500 + i, ids)); }
        }
    }

    // Titles for the first few distinct advisories, so the list is readable.
    let mut summaries: BTreeMap<String, String> = BTreeMap::new();
    let wanted: Vec<String> = hits.iter().flat_map(|(_, ids)| ids.clone()).collect::<HashSet<_>>().into_iter().take(40).collect();
    let fetches = wanted.iter().map(|vid| {
        let client = client.clone();
        let vid = vid.clone();
        async move {
            let v: Option<Value> = match client.get(format!("https://api.osv.dev/v1/vulns/{}", urlencoding::encode(&vid))).send().await {
                Ok(r) if r.status().is_success() => r.json().await.ok(),
                _ => None,
            };
            (vid, v)
        }
    });
    for (vid, v) in futures_util::future::join_all(fetches).await {
        if let Some(v) = v {
            let s = v["summary"].as_str().or_else(|| v["details"].as_str()).unwrap_or("").lines().next().unwrap_or("").chars().take(120).collect::<String>();
            summaries.insert(vid, s);
        }
    }

    let vulnerable: Vec<Value> = hits
        .iter()
        .map(|(i, ids)| {
            let d = &deps[*i];
            json!({
                "name": d.name, "version": d.version, "ecosystem": d.ecosystem,
                "advisories": ids.iter().take(6).map(|id| json!({ "id": id, "summary": summaries.get(id).cloned().unwrap_or_default() })).collect::<Vec<_>>(),
                "advisoryCount": ids.len(),
            })
        })
        .collect();

    Ok(json!({ "supported": true, "scanned": deps.len(), "vulnerable": vulnerable, "sources": sources }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lang(name: &str) -> &'static Lang { LANGS.iter().find(|l| l.name == name).expect("lang") }

    #[test]
    fn counts_code_comments_blanks() {
        let src = "// header\n\nfn main() {\n    /* a\n       b */\n    run(); // trailing stays code\n}\n";
        let mut t = Tally::default();
        count_lines(lang("Rust"), src, &mut t);
        assert_eq!((t.code, t.comments, t.blanks), (3, 3, 1));
    }

    #[test]
    fn one_line_block_comment_does_not_swallow_following_code() {
        let mut t = Tally::default();
        count_lines(lang("C"), "/* note */\nint x;\n", &mut t);
        assert_eq!((t.code, t.comments), (1, 1));
    }

    #[test]
    fn finds_markers_only_inside_comments() {
        assert_eq!(find_marker("  // TODO: fix this").map(|m| m.0), Some("TODO"));
        assert_eq!(find_marker("# FIXME(bob) later").map(|m| m.1), Some("bob) later".to_string()));
        assert!(find_marker("let TODOS = 3;").is_none());
        assert!(find_marker("const label = 'TODO';").is_none());
        assert!(find_marker("// TODOS are fine").is_none());
    }

    #[test]
    fn parses_cargo_lock_registry_crates_only() {
        let lock = "[[package]]\nname = \"serde\"\nversion = \"1.0.1\"\nsource = \"registry+https://github.com/rust-lang/crates.io-index\"\n\n[[package]]\nname = \"mine\"\nversion = \"0.1.0\"\n";
        let deps = parse_cargo_lock(lock);
        assert_eq!(deps.len(), 1);
        assert_eq!((deps[0].name.as_str(), deps[0].version.as_str()), ("serde", "1.0.1"));
    }

    #[test]
    fn parses_package_lock_and_requirements() {
        let lock = r#"{"packages":{"":{"name":"x"},"node_modules/a":{"version":"1.2.3"},"node_modules/a/node_modules/@s/b":{"version":"2.0.0"}}}"#;
        let deps = parse_package_lock(lock);
        assert_eq!(deps.len(), 2);
        assert!(deps.iter().any(|d| d.name == "@s/b"));
        let req = parse_requirements("flask==2.0.1  # web\nrequests>=2\n");
        assert_eq!(req.len(), 1);
    }
}
