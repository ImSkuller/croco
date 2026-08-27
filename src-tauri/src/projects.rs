// Project CRUD, on-disk/SQLite storage (mirrors notes_todos.rs's pattern),
// language detection, file-tree walking, run-command auto-detection, and
// the create-time git-init/GitHub-repo-creation flow. The largest module
// in the backend — this used to be ~900 lines inline in main.rs.

use once_cell::sync::Lazy;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

static PROJECTS_CACHE: Lazy<Mutex<Option<Vec<Value>>>> =
    Lazy::new(|| Mutex::new(None));

pub fn invalidate_projects_cache() { *PROJECTS_CACHE.lock().unwrap() = None; }

const EMOJI_BG: &[(&str, &str)] = &[
    ("⚡", "rgba(74,158,255,0.12)"), ("📁", "rgba(255,107,53,0.12)"),
    ("🌐", "rgba(74,255,145,0.12)"), ("🎮", "rgba(168,85,247,0.12)"),
    ("🔧", "rgba(255,215,0,0.12)"),  ("🤖", "rgba(74,158,255,0.12)"),
    ("🚀", "rgba(255,107,53,0.12)"), ("💡", "rgba(255,215,0,0.12)"),
    ("🔬", "rgba(74,255,145,0.12)"), ("🎯", "rgba(168,85,247,0.12)"),
];

fn emoji_bg(emoji: &str) -> &'static str {
    EMOJI_BG.iter().find(|(e, _)| *e == emoji).map(|(_, c)| *c)
        .unwrap_or("rgba(255,255,255,0.05)")
}

pub fn relative_time(iso: Option<&str>) -> String {
    let iso = match iso { Some(s) if !s.is_empty() => s, _ => return "never".to_string() };
    let then = chrono::DateTime::parse_from_rfc3339(iso)
        .map(|d| d.with_timezone(&chrono::Utc))
        .unwrap_or_else(|_| chrono::Utc::now());
    let secs = (chrono::Utc::now() - then).num_seconds().max(0);
    if secs < 60 { return "just now".to_string(); }
    let m = secs / 60;
    if m < 60 { return format!("{}m ago", m); }
    let h = m / 60;
    if h < 24 { return format!("{}h ago", h); }
    let d = h / 24;
    if d == 1 { return "yesterday".to_string(); }
    if d < 30 { return format!("{} days ago", d); }
    let mo = d / 30;
    if mo < 12 { return format!("{}mo ago", mo); }
    format!("{}y ago", d / 365)
}

fn to_ui(mut p: Value) -> Value {
    let ec = p["emoji"].as_str().map(emoji_bg).unwrap_or("rgba(255,255,255,0.05)");
    let t  = relative_time(p["meta"]["lastOpenedAt"].as_str());
    let lc = relative_time(p["meta"]["lastCommitAt"].as_str());
    if let Value::Object(ref mut m) = p {
        m.insert("emojiColor".into(), json!(ec));
        m.insert("time".into(), json!(t));
        m.insert("lastCommit".into(), json!(lc));
        m.insert("status".into(), json!("idle"));
        m.entry("languages").or_insert(json!([]));
    }
    p
}

pub fn slugify(name: &str) -> String {
    let s = name.to_lowercase();
    let s = s.chars().map(|c| if c.is_alphanumeric() { c } else { '-' }).collect::<String>();
    let s = s.trim_matches('-').to_string();
    if s.is_empty() { "project".to_string() } else { s }
}

fn unique_slug(base: &str, projects: &[Value]) -> String {
    let existing: std::collections::HashSet<&str> = projects.iter()
        .filter_map(|p| p["slug"].as_str()).collect();
    let mut slug = base.to_string();
    let mut i = 2;
    while existing.contains(slug.as_str()) { slug = format!("{}-{}", base, i); i += 1; }
    slug
}

pub fn read_all_projects(app: &AppHandle) -> Vec<Value> {
    // Return from cache if warm
    {
        let c = PROJECTS_CACHE.lock().unwrap();
        if let Some(ref ps) = *c { return ps.clone(); }
    }

    // SQLite backend
    if crate::is_sqlite_enabled(app) {
        if crate::open_db(app).is_ok() {
            let ps = crate::db_get_all("projects");
            *PROJECTS_CACHE.lock().unwrap() = Some(ps.clone());
            return ps;
        }
    }

    let dir = crate::project_details_dir(app);

    // Migrate from legacy single-file format
    let legacy = crate::projects_data_dir(app).join("projects.json");
    if legacy.exists() {
        if let Ok(s) = fs::read_to_string(&legacy) {
            if let Ok(ps) = serde_json::from_str::<Vec<Value>>(&s) {
                fs::create_dir_all(&dir).ok();
                for p in &ps {
                    if let Some(id) = p["id"].as_str() {
                        fs::write(dir.join(format!("{}.json", id)),
                            serde_json::to_string_pretty(p).unwrap()).ok();
                    }
                }
                fs::remove_file(&legacy).ok();
                *PROJECTS_CACHE.lock().unwrap() = Some(ps.clone());
                return ps;
            }
        }
    }

    // Read from per-file storage
    if !dir.exists() { return vec![]; }
    let mut ps = vec![];
    if let Ok(rd) = fs::read_dir(&dir) {
        for e in rd.flatten() {
            let path = e.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") { continue; }
            if let Ok(s) = fs::read_to_string(&path) {
                if let Ok(p) = serde_json::from_str::<Value>(&s) { ps.push(p); }
            }
        }
    }
    *PROJECTS_CACHE.lock().unwrap() = Some(ps.clone());
    ps
}

pub fn upsert_project(app: &AppHandle, p: Value) -> Result<(), String> {
    let id = p["id"].as_str().unwrap_or("").to_string();
    if crate::is_sqlite_enabled(app) {
        if crate::open_db(app).is_ok() {
            crate::db_upsert("projects", &id, &p)?;
        }
    } else {
        let dir = crate::project_details_dir(app);
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        fs::write(dir.join(format!("{}.json", id)),
            serde_json::to_string_pretty(&p).unwrap()).map_err(|e| e.to_string())?;
    }
    let mut cache = PROJECTS_CACHE.lock().unwrap();
    if let Some(ref mut ps) = *cache {
        match ps.iter().position(|q| q["id"].as_str() == Some(&id)) {
            Some(i) => ps[i] = p,
            None    => ps.push(p),
        }
    }
    Ok(())
}

pub fn get_project(app: &AppHandle, id: &str) -> Option<Value> {
    // Check cache first — but on a cache miss fall through to disk/DB
    // (the cache may have been populated before this project existed)
    {
        let c = PROJECTS_CACHE.lock().unwrap();
        if let Some(ref ps) = *c {
            if let Some(p) = ps.iter().find(|p| p["id"].as_str() == Some(id)) {
                return Some(p.clone());
            }
        }
    }
    // SQLite backend
    if crate::is_sqlite_enabled(app) {
        if crate::open_db(app).is_ok() {
            return crate::db_get_by_id("projects", id);
        }
    }
    // Cold read of single file
    let path = crate::project_file(app, id);
    if path.exists() {
        if let Ok(s) = fs::read_to_string(&path) {
            if let Ok(p) = serde_json::from_str::<Value>(&s) { return Some(p); }
        }
    }
    None
}

const LANG_EXT: &[(&str, &str)] = &[
    (".js","JavaScript"), (".jsx","JavaScript"), (".mjs","JavaScript"), (".cjs","JavaScript"),
    (".ts","TypeScript"), (".tsx","TypeScript"), (".mts","TypeScript"), (".cts","TypeScript"),
    (".css","CSS"), (".scss","SCSS"), (".sass","Sass"), (".less","Less"),
    (".html","HTML"), (".htm","HTML"), (".json","JSON"), (".json5","JSON"), (".jsonc","JSON"),
    (".py","Python"), (".pyi","Python"), (".ipynb","Jupyter Notebook"),
    (".java","Java"), (".kt","Kotlin"), (".kts","Kotlin"), (".go","Go"), (".rs","Rust"),
    (".rb","Ruby"), (".erb","Ruby"), (".php","PHP"), (".cpp","C++"), (".cc","C++"), (".cxx","C++"),
    (".hpp","C++"), (".c","C"), (".h","C"), (".cs","C#"), (".md","Markdown"), (".mdx","Markdown"),
    (".vue","Vue"), (".svelte","Svelte"), (".sh","Shell"), (".bash","Shell"), (".zsh","Shell"),
    (".ps1","PowerShell"), (".psm1","PowerShell"), (".yml","YAML"), (".yaml","YAML"),
    (".toml","TOML"), (".xml","XML"), (".sql","SQL"), (".dart","Dart"), (".swift","Swift"),
    (".m","Objective-C"), (".mm","Objective-C++"), (".lua","Lua"), (".pl","Perl"), (".pm","Perl"),
    (".r","R"), (".jl","Julia"), (".scala","Scala"), (".clj","Clojure"), (".cljs","Clojure"),
    (".ex","Elixir"), (".exs","Elixir"), (".erl","Erlang"), (".elm","Elm"), (".hs","Haskell"),
    (".zig","Zig"), (".nim","Nim"), (".graphql","GraphQL"), (".gql","GraphQL"), (".proto","Protocol Buffers"),
    (".vim","Vim script"), (".groovy","Groovy"), (".gradle","Groovy"), (".dockerfile","Dockerfile"),
    (".tf","Terraform"), (".sol","Solidity"), (".fs","F#"), (".fsx","F#"), (".vb","Visual Basic"),
    (".asm","Assembly"), (".s","Assembly"), (".coffee","CoffeeScript"), (".twig","Twig"),
    (".astro","Astro"), (".prisma","Prisma"), (".wasm","WebAssembly"),
];
const LANG_COLOR: &[(&str, &str)] = &[
    ("JavaScript","#f7df1e"), ("TypeScript","#3178c6"), ("CSS","#264de4"), ("SCSS","#c6538c"),
    ("Sass","#cf649a"), ("Less","#1d365d"),
    ("HTML","#e34f26"), ("JSON","#888"), ("Python","#3776ab"), ("Jupyter Notebook","#da5b0b"),
    ("Java","#f89820"), ("Kotlin","#7f52ff"), ("Go","#00acd7"), ("Rust","#ce422b"), ("Ruby","#cc342d"),
    ("PHP","#8892bf"), ("C++","#00599c"), ("C","#a8b9cc"), ("C#","#68217a"),
    ("Markdown","#083fa1"), ("Vue","#41b883"), ("Svelte","#ff3e00"), ("Shell","#89e051"),
    ("PowerShell","#012456"), ("YAML","#cb171e"), ("TOML","#9c4221"), ("XML","#0060ac"),
    ("SQL","#e38c00"), ("Dart","#00b4ab"), ("Swift","#f05138"), ("Objective-C","#438eff"),
    ("Objective-C++","#6866fb"), ("Lua","#000080"), ("Perl","#0298c3"), ("R","#198ce7"),
    ("Julia","#9558b2"), ("Scala","#c22d40"), ("Clojure","#5881d8"), ("Elixir","#6e4a7e"),
    ("Erlang","#b83998"), ("Elm","#60b5cc"), ("Haskell","#5e5086"), ("Zig","#ec915c"),
    ("Nim","#ffc200"), ("GraphQL","#e10098"), ("Protocol Buffers","#4285f4"), ("Vim script","#199f4b"),
    ("Groovy","#4298b8"), ("Dockerfile","#384d54"), ("Terraform","#844fba"), ("Solidity","#363636"),
    ("F#","#378bba"), ("Visual Basic","#945db7"), ("Assembly","#6e4c13"), ("CoffeeScript","#244776"),
    ("Twig","#c1d026"), ("Astro","#ff5a03"), ("Prisma","#0c344b"), ("WebAssembly","#654ff0"),
];
const IGNORE_DIRS: &[&str] = &[
    "node_modules", ".git", "dist", "build", ".next", "out", "target", "vendor", ".cache",
    ".svelte-kit", ".nuxt", "coverage", "__pycache__", ".venv", "venv", ".turbo",
];

// Weighs each language by total bytes of matching files (like GitHub's
// language bar), not by file count — a handful of hand-written files
// shouldn't outweigh one huge generated/vendored one, and a directory
// full of tiny config files shouldn't outweigh the actual source. Uses
// the size already returned by the directory-walk's metadata (no extra
// file reads), so this is no slower than the old file-counting version.
fn walk_count(dir: &Path, counts: &mut HashMap<String, u64>, depth: u32) {
    if depth > 6 || !dir.exists() { return; }
    let Ok(entries) = fs::read_dir(dir) else { return };
    for e in entries.flatten() {
        let path = e.path();
        if path.is_dir() {
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if !IGNORE_DIRS.contains(&name) { walk_count(&path, counts, depth + 1); }
        } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            let ext_dot = format!(".{}", ext.to_lowercase());
            if LANG_EXT.iter().any(|(e, _)| *e == ext_dot) {
                let size = e.metadata().map(|m| m.len()).unwrap_or(0);
                *counts.entry(ext_dot).or_insert(0) += size;
            }
        }
    }
}

fn walk_file_tree(root: &Path, dir: &Path, depth: u32) -> Value {
    if depth > 8 { return json!([]); }
    let Ok(rd) = fs::read_dir(dir) else { return json!([]); };
    let mut entries: Vec<_> = rd.flatten().collect();
    entries.sort_by(|a, b| {
        let ad = a.path().is_dir();
        let bd = b.path().is_dir();
        if ad != bd { return if ad { std::cmp::Ordering::Less } else { std::cmp::Ordering::Greater }; }
        a.file_name().cmp(&b.file_name())
    });
    let items: Vec<Value> = entries.iter().map(|e| {
        let path = e.path();
        let name = e.file_name().to_string_lossy().to_string();
        let rel  = path.strip_prefix(root).unwrap_or(&path)
            .to_string_lossy().replace('\\', "/");
        let full = path.to_string_lossy().to_string();
        if path.is_dir() {
            let ignored = IGNORE_DIRS.contains(&name.as_str());
            json!({ "name": name, "type": "dir", "path": full, "rel": rel,
                    "children": if ignored { json!(null) } else { walk_file_tree(root, &path, depth+1) },
                    "ignored": ignored })
        } else {
            let size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            let ext  = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
            json!({ "name": name, "type": "file", "path": full, "rel": rel, "ext": format!(".{}", ext), "size": size })
        }
    }).collect();
    json!(items)
}

pub fn auto_detect_commands(root: &Path) -> Value {
    // ── Node.js / JavaScript ───────────────────────────────────────────────
    let pkg = root.join("package.json");
    if pkg.exists() {
        if let Ok(s) = fs::read_to_string(&pkg) {
            if let Ok(p) = serde_json::from_str::<Value>(&s) {
                // Detect package manager by lockfile
                let pm = if root.join("pnpm-lock.yaml").exists() { "pnpm" }
                         else if root.join("yarn.lock").exists()  { "yarn" }
                         else if root.join("bun.lockb").exists()  { "bun"  }
                         else { "npm" };
                let run   = if pm == "npm" { "npm run" } else { pm };
                let start = if pm == "npm" { "npm start" } else if pm == "yarn" { "yarn start" } else { &format!("{} start", pm)[..] };
                let scripts = &p["scripts"];
                // Collect all non-standard scripts as custom
                let standard = ["dev", "build", "start", "test", "preview", "serve"];
                let custom: Vec<Value> = scripts.as_object()
                    .map(|m| m.keys()
                        .filter(|k| !standard.contains(&k.as_str()))
                        .map(|k| json!({ "name": k, "command": format!("{} {}", run, k) }))
                        .collect())
                    .unwrap_or_default();
                let has = |key: &str| scripts[key].is_string();
                return json!({
                    "dev":   if has("dev")     { format!("{} dev",   run) }
                             else if has("serve")   { format!("{} serve", run) }
                             else if has("start")   { start.to_string() }
                             else { "".into() },
                    "build": if has("build")   { format!("{} build", run) } else { "".into() },
                    "start": if has("start")   { start.to_string() }
                             else if has("preview") { format!("{} preview", run) }
                             else { "".into() },
                    "test":  if has("test")    { format!("{} test",  run) } else { "".into() },
                    "custom": custom,
                });
            }
        }
    }
    // ── Rust / Cargo ───────────────────────────────────────────────────────
    if root.join("Cargo.toml").exists() {
        return json!({ "dev": "cargo run", "build": "cargo build --release", "start": "cargo run --release", "test": "cargo test", "custom": [] });
    }
    // ── Go ─────────────────────────────────────────────────────────────────
    if root.join("go.mod").exists() {
        return json!({ "dev": "go run .", "build": "go build -o bin/app .", "start": "go run .", "test": "go test ./...", "custom": [] });
    }
    // ── Python ─────────────────────────────────────────────────────────────
    if root.join("pyproject.toml").exists() {
        let is_uv = root.join("uv.lock").exists();
        let run   = if is_uv { "uv run" } else { "poetry run" };
        return json!({ "dev": format!("{} python main.py", run), "build": "", "start": format!("{} python main.py", run), "test": format!("{} pytest", run), "custom": [] });
    }
    if root.join("requirements.txt").exists() {
        // Try to detect Flask / FastAPI / Django
        let reqs = fs::read_to_string(root.join("requirements.txt")).unwrap_or_default().to_lowercase();
        let dev = if reqs.contains("flask")   { "flask run" }
                  else if reqs.contains("fastapi") { "uvicorn main:app --reload" }
                  else if reqs.contains("django")  { "python manage.py runserver" }
                  else { "python main.py" };
        return json!({ "dev": dev, "build": "", "start": "python main.py", "test": "pytest", "custom": [] });
    }
    // ── Makefile ───────────────────────────────────────────────────────────
    if root.join("Makefile").exists() || root.join("makefile").exists() {
        return json!({ "dev": "make dev", "build": "make build", "start": "make run", "test": "make test", "custom": [] });
    }
    // ── Ruby ───────────────────────────────────────────────────────────────
    if root.join("Gemfile").exists() {
        return json!({ "dev": "bundle exec rails server", "build": "", "start": "bundle exec ruby main.rb", "test": "bundle exec rspec", "custom": [] });
    }
    // ── PHP / Composer ─────────────────────────────────────────────────────
    if root.join("composer.json").exists() {
        return json!({ "dev": "php artisan serve", "build": "composer install --optimize-autoloader", "start": "php -S localhost:8000", "test": "php artisan test", "custom": [] });
    }
    json!({ "dev": "", "build": "", "start": "", "test": "", "custom": [] })
}

fn open_in_ide(ide: &str, path: &str) -> Result<(), String> {
    let cmd = match ide {
        "cursor"    => "cursor",
        "webstorm"  => "webstorm",
        "idea"      => "idea",
        "zed"       => "zed",
        "sublime"   => "subl",
        "vim"       => "vim",
        "neovim"    => "nvim",
        "windsurf"  => "windsurf",
        "trae"      => "trae",
        "fleet"     => "fleet",
        _           => "code",
    };
    // On Windows, editors like VS Code and Cursor install as .cmd shell scripts,
    // not .exe files, so Command::new won't find them directly. Route through cmd.exe.
    #[cfg(windows)]
    {
        let mut c = Command::new("cmd");
        c.args(["/c", cmd, path]);
        crate::no_window(&mut c);
        c.spawn().map_err(|e| format!("Failed to open {} — is it installed and in PATH? ({})", ide, e))?;
        return Ok(());
    }
    #[cfg(not(windows))]
    {
        let mut c = Command::new(cmd);
        c.arg(path);
        c.spawn().map_err(|e| format!("Failed to open {} — is it installed and in PATH? ({})", ide, e))?;
        Ok(())
    }
}

pub fn git_init(project_root: &str, author_name: &str, author_email: &str) -> Result<(), String> {
    let mut c = Command::new("git");
    c.arg("init").current_dir(project_root);
    crate::no_window(&mut c);
    let out = c.output().map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            "git is not installed or not in PATH — download it from https://git-scm.com/downloads".to_string()
        } else {
            e.to_string()
        }
    })?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    let mut c2 = Command::new("git");
    c2.args(["add", "."]).current_dir(project_root);
    crate::no_window(&mut c2);
    c2.output().ok();
    let mut c3 = Command::new("git");
    c3.args(["-c", &format!("user.name={}", author_name),
             "-c", &format!("user.email={}", author_email),
             "commit", "-m", "Initial commit"])
      .current_dir(project_root);
    crate::no_window(&mut c3);
    c3.output().ok();
    Ok(())
}

pub async fn create_github_repo(repo_name: &str, is_private: bool, token: &str) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.github.com/user/repos")
        .header("Authorization", format!("token {}", token))
        .header("User-Agent", crate::UA)
        .header("Accept", "application/vnd.github.v3+json")
        .json(&json!({ "name": repo_name, "private": is_private, "auto_init": false }))
        .send().await.map_err(|e| e.to_string())?;

    let status = resp.status().as_u16();
    let body: Value = resp.json().await.unwrap_or(json!({}));
    match status {
        201 => Ok(body),
        401 => Err("GitHub token invalid — check Settings → User".into()),
        422 => Err(format!("Repo \"{}\" already exists on GitHub", repo_name)),
        _   => Err(body["message"].as_str().unwrap_or("GitHub API error").to_string()),
    }
}

// ─── Projects commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub fn projects_get_all(app: AppHandle) -> Vec<Value> {
    let mut ps: Vec<Value> = read_all_projects(&app).into_iter().map(to_ui).collect();
    ps.sort_by(|a, b| {
        let at = a["meta"]["lastOpenedAt"].as_str().unwrap_or("");
        let bt = b["meta"]["lastOpenedAt"].as_str().unwrap_or("");
        bt.cmp(at)
    });
    ps
}

#[tauri::command]
pub fn projects_get_by_id(app: AppHandle, id: String) -> Option<Value> {
    crate::validate_safe_id(&id).ok()?;
    let project = get_project(&app, &id)?;
    Some(to_ui(project))
}

#[tauri::command]
pub async fn projects_create(app: AppHandle, data: Value) -> Result<Value, String> {
    let settings  = crate::read_settings(&app);
    let name      = data["name"].as_str().unwrap_or("project").to_string();
    let all       = read_all_projects(&app);
    let base_slug = slugify(&name);
    let slug      = unique_slug(&base_slug, &all);

    let base_path = if data["visibility"].as_str() == Some("hidden") {
        settings["paths"]["hiddenProjects"].as_str().unwrap_or("").to_string()
    } else {
        settings["paths"]["publicProjects"].as_str().unwrap_or("").to_string()
    };

    let project_root = data["path"].as_str()
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("{}/{}", base_path, slug));

    let now = chrono::Utc::now().to_rfc3339();

    // 1. Create project root directory
    fs::create_dir_all(&project_root).map_err(|e| format!("mkdir: {}", e))?;

    // 2. Write template files (pre-generated by frontend)
    if let Some(files) = data["templateFiles"].as_object() {
        for (rel, content) in files {
            if let Some(text) = content.as_str() {
                let full = PathBuf::from(&project_root).join(rel);
                if let Some(p) = full.parent() { fs::create_dir_all(p).ok(); }
                fs::write(&full, text).ok();
            }
        }
    }

    // 3. Detect commands
    let commands = auto_detect_commands(Path::new(&project_root));

    let mut project = json!({
        "id":          uuid::Uuid::new_v4().to_string(),
        "name":        name,
        "slug":        slug,
        "description": data["description"].as_str().unwrap_or(""),
        "emoji":       data["emoji"].as_str().unwrap_or("📁"),
        "tags":        data["tags"].as_array().cloned().unwrap_or_default(),
        "visibility":  data["visibility"].as_str().unwrap_or("public"),
        "ide":         data["ide"].as_str().or_else(|| settings["defaults"]["ide"].as_str()).unwrap_or("vscode"),
        "github":      data["github"],
        "paths":       { "projectRoot": project_root, "entryFile": "" },
        "commands":    commands,
        "favourite":   false,
        "meta":        { "createdAt": now, "lastOpenedAt": now, "lastCommitAt": null, "openCount": 0 }
    });

    let mut warnings: Vec<String> = vec![];

    // 4. Git init
    if data["initGit"].as_bool().unwrap_or(false) || data["createGithubRepo"].as_bool().unwrap_or(false) {
        let author = settings["user"]["name"].as_str().unwrap_or("Dev").replace(['"', '\n'], "");
        let gh_user = settings["user"]["github"]["username"].as_str().unwrap_or("");
        let email = if !gh_user.is_empty() {
            format!("{}@users.noreply.github.com", gh_user)
        } else { "dev@local".to_string() };
        if let Err(e) = git_init(&project_root_str(&project), &author, &email) {
            warnings.push(format!("Git init: {}", e));
        }
    }

    // 5. Create GitHub repo
    if data["createGithubRepo"].as_bool().unwrap_or(false) {
        let token    = settings["user"]["github"]["token"].as_str().unwrap_or("").to_string();
        let username = settings["user"]["github"]["username"].as_str().unwrap_or("").to_string();
        if !token.is_empty() && !username.is_empty() {
            let proj_slug = project["slug"].as_str().unwrap_or("").to_string();
            let is_private = data["githubRepoPrivate"].as_bool()
                .unwrap_or_else(|| data["visibility"].as_str() == Some("hidden"));
            match create_github_repo(&proj_slug, is_private, &token).await {
                Ok(repo) => {
                    let repo_name = repo["name"].as_str().unwrap_or(&proj_slug);
                    let clean_url = format!("https://github.com/{}/{}.git", username, repo_name);
                    let auth_url  = format!("https://{}@github.com/{}/{}.git", token, username, repo_name);
                    let root = project_root_str(&project);
                    let mut gb = Command::new("git"); gb.args(["branch", "-M", "main"]).current_dir(&root); crate::no_window(&mut gb); gb.output().ok();
                    let mut gr = Command::new("git"); gr.args(["remote", "add", "origin", &clean_url]).current_dir(&root); crate::no_window(&mut gr); gr.output().ok();
                    let mut gp = Command::new("git"); gp.args(["push", "-u", &auth_url, "main"]).current_dir(&root); crate::no_window(&mut gp);
                    let push = gp.output();
                    if let Value::Object(ref mut m) = project {
                        m.insert("github".into(), json!(format!("{}/{}", username, repo_name)));
                    }
                    if push.map(|o| !o.status.success()).unwrap_or(true) {
                        warnings.push("Push: repo created — push manually".into());
                    }
                }
                Err(e) => warnings.push(format!("GitHub: {}", e)),
            }
        } else {
            warnings.push("GitHub: No token/username in Settings → User".into());
        }
    }

    upsert_project(&app, project.clone())?;
    crate::activity_log(&app, "project.created", json!({ "projectId": project["id"], "projectName": project["name"], "templateId": data["templateId"] }));
    let mut result = to_ui(project);
    if let Value::Object(ref mut m) = result { m.insert("setupWarnings".into(), json!(warnings)); }
    Ok(result)
}

pub fn project_root_str(p: &Value) -> String {
    p["paths"]["projectRoot"].as_str().unwrap_or("").to_string()
}

#[tauri::command]
pub async fn projects_import(app: AppHandle, folder_path: String, opts: Option<Value>) -> Result<Value, String> {
    if !Path::new(&folder_path).exists() {
        return Err("Folder does not exist".into());
    }
    let opts     = opts.unwrap_or(json!({}));
    let settings = crate::read_settings(&app);
    let folder_name = Path::new(&folder_path).file_name()
        .and_then(|n| n.to_str()).unwrap_or("project").to_string();
    let all  = read_all_projects(&app);
    let name = opts["name"].as_str().unwrap_or(&folder_name).to_string();
    let slug = unique_slug(&slugify(&name), &all);
    let now  = chrono::Utc::now().to_rfc3339();
    let cmds = auto_detect_commands(Path::new(&folder_path));

    // detect github remote
    let mut git_remote = Command::new("git");
    git_remote.args(["remote", "get-url", "origin"]).current_dir(&folder_path);
    crate::no_window(&mut git_remote);
    let github = git_remote
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| {
            let url = String::from_utf8_lossy(&o.stdout).trim().to_string();
            let re = regex_lite(&url);
            re
        });

    let project = json!({
        "id":          uuid::Uuid::new_v4().to_string(),
        "name":        name,
        "slug":        slug,
        "description": opts["description"].as_str().unwrap_or(""),
        "emoji":       opts["emoji"].as_str().unwrap_or("📁"),
        "tags":        [],
        "visibility":  opts["visibility"].as_str().unwrap_or("public"),
        "ide":         opts["ide"].as_str().or_else(|| settings["defaults"]["ide"].as_str()).unwrap_or("vscode"),
        "github":      github,
        "paths":       { "projectRoot": folder_path, "entryFile": "" },
        "commands":    cmds,
        // Auto-detected from a folder that wasn't necessarily created by
        // Croco itself (could be a repo the user just cloned) — run_start
        // requires one explicit confirmation before the first run.
        "commandsConfirmed": false,
        "favourite":   false,
        "imported":    true,
        "meta":        { "createdAt": now, "lastOpenedAt": now, "lastCommitAt": null, "openCount": 0 }
    });

    upsert_project(&app, project.clone())?;
    crate::activity_log(&app, "project.imported", json!({ "projectId": project["id"], "projectName": project["name"] }));
    Ok(to_ui(project))
}

fn regex_lite(url: &str) -> Option<Value> {
    // Extract owner/repo from github URL
    let url = url.trim();
    let pat = url.find("github.com")?;
    let rest = &url[pat + "github.com".len()..];
    let rest = rest.trim_start_matches(|c| c == '/' || c == ':');
    let parts: Vec<&str> = rest.splitn(3, '/').collect();
    if parts.len() >= 2 {
        let repo = parts[1].trim_end_matches(".git");
        Some(json!(format!("{}/{}", parts[0], repo)))
    } else { None }
}

#[tauri::command]
pub fn projects_edit(app: AppHandle, id: String, changes: Value) -> Result<Value, String> {
    crate::validate_safe_id(&id)?;
    let project = get_project(&app, &id).ok_or("Project not found")?;
    let project_name = project["name"].as_str().unwrap_or("").to_string();
    let updated = crate::deep_merge(project, changes.clone());
    upsert_project(&app, updated.clone())?;
    if changes.get("name").is_some() || changes.get("description").is_some() {
        crate::activity_log(&app, "project.updated", json!({ "projectId": id, "projectName": project_name }));
    }
    Ok(to_ui(updated))
}

#[tauri::command]
pub fn projects_delete(app: AppHandle, id: String) -> Result<Value, String> {
    crate::validate_safe_id(&id)?;
    let project_name = get_project(&app, &id)
        .and_then(|p| p["name"].as_str().map(|s| s.to_string()))
        .unwrap_or_default();
    if crate::is_sqlite_enabled(&app) {
        crate::open_db(&app).ok();
        crate::db_delete("projects", &id).ok();
    } else {
        let path = crate::project_file(&app, &id);
        if path.exists() { fs::remove_file(&path).map_err(|e| e.to_string())?; }
    }
    let mut cache = PROJECTS_CACHE.lock().unwrap();
    if let Some(ref mut ps) = *cache {
        ps.retain(|p| p["id"].as_str() != Some(id.as_str()));
    }
    drop(cache);
    crate::activity_log(&app, "project.deleted", json!({ "projectId": id, "projectName": project_name }));
    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub fn projects_open_in_ide(app: AppHandle, id: String) -> Result<Value, String> {
    crate::validate_safe_id(&id)?;
    let project = get_project(&app, &id).ok_or("Project not found")?;
    let settings = crate::read_settings(&app);
    let ide = project["ide"].as_str()
        .or_else(|| settings["defaults"]["ide"].as_str())
        .unwrap_or("vscode");
    let root = project_root_str(&project);
    open_in_ide(ide, &root)?;
    // Update lastOpenedAt
    let meta = &project["meta"];
    let open_count = meta["openCount"].as_i64().unwrap_or(0) + 1;
    let project_name = project["name"].as_str().unwrap_or("").to_string();
    crate::activity_log(&app, "ide.opened", json!({ "projectId": id, "projectName": project_name }));
    crate::personality::track(&app, "project_open", json!({ "projectId": id }));
    let _ = projects_edit(app, id, json!({ "meta": { "lastOpenedAt": chrono::Utc::now().to_rfc3339(), "openCount": open_count } }));
    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub fn projects_open_folder(app: AppHandle, id: String) -> Result<Value, String> {
    crate::validate_safe_id(&id)?;
    let project = get_project(&app, &id).ok_or("Project not found")?;
    let root = project_root_str(&project);
    app.opener().open_path(&root, None::<&str>).map_err(|e| e.to_string())?;
    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub fn projects_toggle_favorite(app: AppHandle, id: String) -> Result<Value, String> {
    crate::validate_safe_id(&id)?;
    let project = get_project(&app, &id).ok_or("Project not found")?;
    let fav = !project["favourite"].as_bool().unwrap_or(false);
    projects_edit(app, id, json!({ "favourite": fav }))
}

#[tauri::command]
pub fn projects_get_recents(app: AppHandle, limit: Option<u32>) -> Vec<Value> {
    let limit = limit.unwrap_or(5) as usize;
    projects_get_all(app).into_iter().take(limit).collect()
}

#[tauri::command]
pub async fn projects_detect_languages(app: AppHandle, id: String) -> Vec<Value> {
    if crate::validate_safe_id(&id).is_err() { return vec![]; }
    let project = match get_project(&app, &id) { Some(p) => p, None => return vec![] };
    // Return cached result if already stored in project data
    if let Some(arr) = project["languages"].as_array() {
        if !arr.is_empty() { return arr.clone(); }
    }
    let root = project_root_str(&project);
    let mut ext_counts: HashMap<String, u64> = HashMap::new();
    walk_count(Path::new(&root), &mut ext_counts, 0);
    let total: u64 = ext_counts.values().sum();
    if total == 0 { return vec![]; }

    // Multiple extensions can map to the same language (.js/.jsx are both
    // JavaScript, .ts/.tsx both TypeScript) — merge by language name so each
    // language shows as a single bar segment instead of being split across
    // near-duplicate entries.
    let mut by_lang: HashMap<&str, (u64, &str)> = HashMap::new();
    for (ext, bytes) in &ext_counts {
        let lang = LANG_EXT.iter().find(|(e, _)| e == &ext.as_str())
            .map(|(_, l)| *l).unwrap_or(ext.as_str());
        let entry = by_lang.entry(lang).or_insert((0, ext.as_str()));
        entry.0 += bytes;
    }
    let mut sorted: Vec<_> = by_lang.into_iter().collect();
    sorted.sort_by(|a, b| b.1.0.cmp(&a.1.0));
    // No cap here — every detected language is returned so the language bar
    // always sums to 100%. (Previously capped at the top 8, which silently
    // dropped languages from projects using more than 8 file types.)
    let langs: Vec<Value> = sorted.iter().map(|(lang, (bytes, ext))| {
        let color = LANG_COLOR.iter().find(|(l, _)| l == lang)
            .map(|(_, c)| *c).unwrap_or("#888");
        let pct = (*bytes as f64 / total as f64 * 100.0).round() as u32;
        // "count" is kept as the field name for frontend compatibility, but
        // it's now bytes-of-code (like GitHub's language bar), not file count.
        json!({ "ext": ext, "name": lang, "count": bytes, "color": color, "pct": pct })
    }).collect();
    // Cache in project file — future calls return instantly from in-memory cache
    let _ = projects_edit(app, id, json!({ "languages": langs }));
    langs
}

#[tauri::command]
pub async fn projects_auto_detect_commands(root: String) -> Value {
    auto_detect_commands(Path::new(&root))
}

#[tauri::command]
pub async fn projects_remove_local_files(app: AppHandle, id: String) -> Result<Value, String> {
    crate::validate_safe_id(&id)?;
    let project = get_project(&app, &id).ok_or("Project not found")?;
    let root = project_root_str(&project);
    if !root.is_empty() && Path::new(&root).exists() {
        crate::assert_safe_delete_root(Path::new(&root))?;
        #[cfg(windows)]
        {
            let mut c = Command::new("cmd");
            c.args(["/c", "rd", "/s", "/q", &root]);
            crate::no_window(&mut c);
            c.output().ok();
        }
        #[cfg(not(windows))]
        {
            fs::remove_dir_all(&root).map_err(|e| e.to_string())?;
        }
    }
    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub async fn projects_delete_github_repo(app: AppHandle, id: String) -> Result<Value, String> {
    crate::validate_safe_id(&id)?;
    let project  = get_project(&app, &id).ok_or("Project not found")?;
    let github   = project["github"].as_str().ok_or("No GitHub repository linked")?;
    let settings = crate::read_settings(&app);
    let token    = settings["user"]["github"]["token"].as_str().ok_or("No GitHub token in Settings → User")?;
    let parts: Vec<&str> = github.splitn(2, '/').collect();
    if parts.len() < 2 { return Err(format!("Invalid repo format: {}", github)); }
    let (owner, repo) = (parts[0], parts[1]);

    let client = reqwest::Client::new();
    let resp = client
        .delete(format!("https://api.github.com/repos/{}/{}", owner, repo))
        .header("Authorization", format!("token {}", token))
        .header("User-Agent", crate::UA)
        .header("Accept", "application/vnd.github.v3+json")
        .send().await.map_err(|e| e.to_string())?;

    match resp.status().as_u16() {
        204 => projects_edit(app, id, json!({ "github": null })),
        401 => Err("GitHub token invalid or expired".into()),
        403 => Err("Token lacks delete_repo scope".into()),
        404 => Err("Repository not found on GitHub".into()),
        s   => {
            let body: Value = resp.json().await.unwrap_or(json!({}));
            Err(body["message"].as_str().unwrap_or(&format!("GitHub API error {}", s)).to_string())
        }
    }
}

#[tauri::command]
pub fn projects_get_dependencies(app: AppHandle, id: String) -> Value {
    if crate::validate_safe_id(&id).is_err() { return json!({ "type": "unknown" }); }
    let project = match get_project(&app, &id) { Some(p) => p, None => return json!({ "type": "unknown" }) };
    let root = project_root_str(&project);
    let root = Path::new(&root);

    let pkg_path = root.join("package.json");
    if pkg_path.exists() {
        if let Ok(s) = fs::read_to_string(&pkg_path) {
            if let Ok(p) = serde_json::from_str::<Value>(&s) {
                return json!({
                    "type": "node",
                    "name": p["name"],
                    "version": p["version"],
                    "scripts": p["scripts"].as_object().cloned().unwrap_or_default(),
                    "dependencies": p["dependencies"].as_object().cloned().unwrap_or_default(),
                    "devDependencies": p["devDependencies"].as_object().cloned().unwrap_or_default(),
                    "peerDependencies": p["peerDependencies"].as_object().cloned().unwrap_or_default()
                });
            }
        }
    }

    let req_path = root.join("requirements.txt");
    if req_path.exists() {
        let deps: serde_json::Map<String, Value> = fs::read_to_string(&req_path)
            .unwrap_or_default()
            .lines()
            .filter(|l| !l.trim().is_empty() && !l.trim().starts_with('#'))
            .filter_map(|l| {
                let m: Vec<&str> = l.splitn(2, |c| c == '=' || c == '>' || c == '<').collect();
                if m.is_empty() { return None; }
                Some((m[0].trim().to_string(), json!(m.get(1).map(|s| s.trim()).unwrap_or("*"))))
            })
            .collect();
        return json!({ "type": "python", "dependencies": deps, "devDependencies": {}, "peerDependencies": {} });
    }

    let cargo_path = root.join("Cargo.toml");
    if cargo_path.exists() {
        let content = fs::read_to_string(&cargo_path).unwrap_or_default();
        let mut deps = serde_json::Map::new();
        let mut in_deps = false;
        for line in content.lines() {
            let t = line.trim();
            if t == "[dependencies]" { in_deps = true; continue; }
            if t.starts_with('[') { in_deps = false; }
            if in_deps {
                let parts: Vec<&str> = t.splitn(2, '=').collect();
                if parts.len() == 2 {
                    let k = parts[0].trim().to_string();
                    let v = parts[1].trim().trim_matches('"').to_string();
                    deps.insert(k, json!(v));
                }
            }
        }
        return json!({ "type": "rust", "dependencies": deps, "devDependencies": {}, "peerDependencies": {} });
    }

    json!({ "type": "unknown", "dependencies": {}, "devDependencies": {}, "peerDependencies": {} })
}

fn exec_in_root(app: &AppHandle, id: &str, cmd: &str) -> Result<Value, String> {
    crate::validate_safe_id(id)?;
    let project = get_project(app, id).ok_or("Project not found")?;
    let root = project_root_str(&project);
    let output = {
        #[cfg(windows)]
        { let mut c = Command::new("cmd"); c.args(["/c", cmd]).current_dir(&root); crate::no_window(&mut c); c.output() }
        #[cfg(not(windows))]
        { Command::new("sh").args(["-c", cmd]).current_dir(&root).output() }
    }.map_err(|e| e.to_string())?;
    let out = String::from_utf8_lossy(&output.stdout).to_string();
    let err = String::from_utf8_lossy(&output.stderr).to_string();
    if output.status.success() {
        Ok(json!({ "ok": true, "output": out }))
    } else {
        Err(err)
    }
}

#[tauri::command]
pub async fn projects_install_dependencies(app: AppHandle, id: String) -> Result<Value, String> {
    exec_in_root(&app, &id, "npm install")
}
#[tauri::command]
pub async fn projects_update_dependencies(app: AppHandle, id: String) -> Result<Value, String> {
    exec_in_root(&app, &id, "npm update")
}
#[tauri::command]
pub async fn projects_add_dependency(app: AppHandle, id: String, name: String, dev: bool) -> Result<Value, String> {
    let cmd = if dev { format!("npm install {} --save-dev", name) } else { format!("npm install {}", name) };
    exec_in_root(&app, &id, &cmd)
}
#[tauri::command]
pub async fn projects_remove_dependency(app: AppHandle, id: String, name: String) -> Result<Value, String> {
    exec_in_root(&app, &id, &format!("npm uninstall {}", name))
}

#[tauri::command]
pub async fn projects_get_file_tree(app: AppHandle, id: String) -> Value {
    if crate::validate_safe_id(&id).is_err() { return json!([]); }
    let project = match get_project(&app, &id) { Some(p) => p, None => return json!([]) };
    let root = project_root_str(&project);
    let root = Path::new(&root);
    if !root.exists() { return json!([]); }
    walk_file_tree(root, root, 0)
}

#[tauri::command]
pub fn projects_get_scripts(app: AppHandle, id: String) -> Vec<Value> {
    if crate::validate_safe_id(&id).is_err() { return vec![]; }
    let project = match get_project(&app, &id) { Some(p) => p, None => return vec![] };
    let root = project_root_str(&project);
    let pkg = Path::new(&root).join("package.json");
    if !pkg.exists() { return vec![]; }
    let Ok(s) = fs::read_to_string(&pkg) else { return vec![]; };
    let Ok(p) = serde_json::from_str::<Value>(&s) else { return vec![]; };
    p["scripts"].as_object()
        .map(|m| m.iter().map(|(k, v)| json!({ "name": k, "command": v })).collect())
        .unwrap_or_default()
}

// ─── Projects rename folder ────────────────────────────────────────────────────

#[tauri::command]
pub fn projects_rename(app: AppHandle, id: String, new_name: String) -> Result<Value, String> {
    crate::validate_safe_id(&id)?;
    let project  = get_project(&app, &id).ok_or("Project not found")?;
    let old_root = project_root_str(&project);
    let old_path = Path::new(&old_root);

    let settings = crate::read_settings(&app);
    let pub_base = settings["paths"]["publicProjects"].as_str().unwrap_or("").to_string();
    let hid_base = settings["paths"]["hiddenProjects"].as_str().unwrap_or("").to_string();
    let parent   = old_path.parent().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
    let is_managed = !parent.is_empty() && (parent == pub_base || parent == hid_base);

    let new_slug = slugify(&new_name);
    let new_root = if is_managed {
        format!("{}/{}", parent, new_slug)
    } else {
        old_root.clone()
    };

    // Rename on filesystem if in managed dir and path would change
    if is_managed && old_root != new_root && old_path.exists() && !Path::new(&new_root).exists() {
        fs::rename(&old_root, &new_root).map_err(|e| format!("Rename failed: {}", e))?;
    }

    projects_edit(app, id, json!({
        "name":  new_name,
        "slug":  new_slug,
        "paths": { "projectRoot": new_root }
    }))
}

// ─── Projects archive ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn projects_set_archived(app: AppHandle, id: String, archived: bool) -> Result<Value, String> {
    projects_edit(app, id, json!({ "archived": archived }))
}
