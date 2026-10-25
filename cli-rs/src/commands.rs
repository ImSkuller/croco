//! Every command Croco's terminal understands. Each one returns text to print
//! (or a request to run something), so the interactive UI and one-shot
//! `croco <command>` invocations share exactly one code path.
//!
//! Projects can be named by their name, their slug, an id prefix, or the
//! number shown next to them in `projects` (and in the home screen's project
//! list): `open 2`, `cmd 1`, `git 3 status` all work.

use crate::store::{Kind, Store};
use crate::ui::*;
use chrono::{DateTime, Local, NaiveDate, TimeZone, Utc};
use serde_json::{json, Value};
use std::cell::RefCell;
use std::path::PathBuf;
use std::process::Command;

pub struct Cmd {
    pub name: &'static str,
    pub args: &'static str,
    pub desc: &'static str,
}

pub const COMMANDS: &[Cmd] = &[
    Cmd { name: "help",      args: "",                                     desc: "Show every command" },
    Cmd { name: "projects",  args: "[filter]",                             desc: "List projects (numbered — use the number anywhere)" },
    Cmd { name: "project",   args: "<name or #>",                          desc: "Details for one project" },
    Cmd { name: "cmd",       args: "<name or #>",                          desc: "Open a command prompt inside a project" },
    Cmd { name: "open",      args: "<name or #>",                          desc: "Open a project in its editor" },
    Cmd { name: "todos",     args: "[all|done|<project>]",                 desc: "List todos (open by default)" },
    Cmd { name: "add",       args: "<title> [!high] [@project] [due:YYYY-MM-DD]", desc: "Add a todo" },
    Cmd { name: "edit",      args: "<# or id> [new title] [!prio] [due:date|none] [@project|@none]", desc: "Edit a todo" },
    Cmd { name: "done",      args: "<# or text>",                          desc: "Tick a todo off (or back on)" },
    Cmd { name: "rm",        args: "<# or text>",                          desc: "Move a todo to the app's Trash" },
    Cmd { name: "notes",     args: "[filter]",                             desc: "List notes" },
    Cmd { name: "note",      args: "<title> [ : body]",                    desc: "Create a note" },
    Cmd { name: "read",      args: "<# or text>",                          desc: "Print a note" },
    Cmd { name: "schedules", args: "",                                     desc: "Upcoming deadlines" },
    Cmd { name: "stats",     args: "[today|7d|30d|3m|all]",                desc: "Todo completion rate" },
    Cmd { name: "git",       args: "<project> [git args…]",                desc: "Run git in a project (no args: status summary)" },
    Cmd { name: "status",    args: "<project>",                            desc: "git status" },
    Cmd { name: "log",       args: "<project> [count]",                    desc: "Recent commits as a graph" },
    Cmd { name: "diff",      args: "<project> [args]",                     desc: "git diff" },
    Cmd { name: "commit",    args: "<project> <message>",                  desc: "Stage everything and commit" },
    Cmd { name: "push",      args: "<project>",                            desc: "git push" },
    Cmd { name: "pull",      args: "<project>",                            desc: "git pull" },
    Cmd { name: "github",    args: "<project> [issues|prs|runs|releases|repo|web]", desc: "GitHub info via the gh CLI" },
    Cmd { name: "code",      args: "[project]",                            desc: "Start Claude Code in a project" },
    Cmd { name: "run",       args: "<project> [dev|build|test|start]",     desc: "Run a project command" },
    Cmd { name: "app",       args: "",                                     desc: "Launch the Croco desktop app" },
    Cmd { name: "home",      args: "",                                     desc: "Leave a project prompt, back to home" },
    Cmd { name: "clear",     args: "",                                     desc: "Clear the screen" },
    Cmd { name: "version",   args: "",                                     desc: "Show the version" },
    Cmd { name: "exit",      args: "",                                     desc: "Leave Croco" },
];

pub enum Outcome {
    Out(String),
    Clear,
    Exit,
    Home,
    /// Switch the UI into a project's command prompt.
    Shell,
    /// Run a command with its output streamed into the UI (cancellable).
    Job { label: String, command: String, cwd: PathBuf },
    /// Hand the terminal to a child process (stdio inherited), then come back.
    Spawn { label: String, command: String, cwd: PathBuf },
}

pub struct Ctx {
    pub store: Store,
    /// Ids in the order the last `todos` listing showed them, so "done 3"
    /// means the 3rd row on screen.
    last_todos: RefCell<Vec<String>>,
    last_notes: RefCell<Vec<String>>,
    /// Snapshot of the project order last shown to the user, so the number
    /// next to a project keeps meaning the same project until it's redrawn.
    project_order: RefCell<Vec<String>>,
    current: RefCell<Option<String>>,
}

impl Ctx {
    pub fn new(store: Store) -> Ctx {
        Ctx {
            store,
            last_todos: RefCell::new(vec![]),
            last_notes: RefCell::new(vec![]),
            project_order: RefCell::new(vec![]),
            current: RefCell::new(None),
        }
    }

    pub fn set_current(&self, id: Option<String>) { *self.current.borrow_mut() = id; }

    pub fn current_project(&self) -> Option<Value> {
        let id = self.current.borrow().clone()?;
        live(self.store.list(Kind::Projects)).into_iter().find(|p| s(p, "id") == id)
    }

    /// Fresh, ordered list of visible projects; also refreshes the numbering
    /// snapshot.
    pub fn ordered_projects(&self) -> Vec<Value> {
        let mut ps = live(self.store.list(Kind::Projects));
        ps.retain(|p| !flag(p, "archived"));
        ps.sort_by(|a, b| p_opened(b).cmp(p_opened(a)).then_with(|| s(a, "name").to_lowercase().cmp(&s(b, "name").to_lowercase())));
        *self.project_order.borrow_mut() = ps.iter().map(|p| s(p, "id").to_string()).collect();
        ps
    }

    fn project_by_number(&self, n: usize) -> Option<Value> {
        if self.project_order.borrow().is_empty() { self.ordered_projects(); }
        let id = self.project_order.borrow().get(n.checked_sub(1)?)?.clone();
        live(self.store.list(Kind::Projects)).into_iter().find(|p| s(p, "id") == id)
    }
}

fn out(lines: Vec<String>) -> Outcome { Outcome::Out(lines.join("\n")) }
fn err(msg: &str) -> Outcome { Outcome::Out(format!("{} {msg}", red("✗"))) }
fn ok(msg: &str) -> Outcome { Outcome::Out(format!("{} {msg}", green("✓"))) }

pub fn run(ctx: &Ctx, input: &str) -> Outcome {
    let input = input.trim().trim_start_matches('/').trim();
    let (name, rest) = match input.split_once(char::is_whitespace) {
        Some((n, r)) => (n, r.trim()),
        None => (input, ""),
    };
    match name.to_lowercase().as_str() {
        "" => Outcome::Out(String::new()),
        "help" | "?" | "h" => help(),
        "projects" | "ls" | "p" => projects(ctx, rest),
        "project" | "show" => project(ctx, rest),
        "cmd" | "shell" | "sh" => enter_shell(ctx, rest),
        "open" => open_project(ctx, rest),
        "todos" | "todo" | "t" => todos(ctx, rest),
        "add" | "a" | "new" => add_todo(ctx, rest),
        "edit" | "e" => edit_todo(ctx, rest),
        "done" | "toggle" | "check" | "x" => toggle_todo(ctx, rest),
        "rm" | "delete" | "del" => remove_todo(ctx, rest),
        "notes" | "n" => notes(ctx, rest),
        "note" => add_note(ctx, rest),
        "read" | "cat" => read_note(ctx, rest),
        "schedules" | "schedule" | "deadlines" => schedules(ctx),
        "stats" | "rate" => stats(ctx, rest),
        "git" => git(ctx, rest),
        "status" | "st" => git_shortcut(ctx, rest, |_| "git status -sb".into()),
        "log" => git_shortcut(ctx, rest, |r| {
            let n = r.trim().parse::<u32>().unwrap_or(15);
            format!("git log --oneline --decorate --graph -n {n}")
        }),
        "diff" => git_shortcut(ctx, rest, |r| format!("git diff {r}")),
        "commit" => commit(ctx, rest),
        "push" => git_shortcut(ctx, rest, |r| format!("git push {r}")),
        "pull" => git_shortcut(ctx, rest, |r| format!("git pull {r}")),
        "fetch" => git_shortcut(ctx, rest, |_| "git fetch --all --prune".into()),
        "github" | "gh" => github(ctx, rest),
        "code" | "claude" => code(ctx, rest),
        "run" => run_project(ctx, rest),
        "app" | "gui" => launch_app(),
        "home" => {
            ctx.set_current(None);
            Outcome::Home
        }
        "clear" | "cls" => Outcome::Clear,
        "version" | "v" | "-v" | "--version" => Outcome::Out(format!("croco {}", env!("CARGO_PKG_VERSION"))),
        "exit" | "quit" | "q" => Outcome::Exit,
        other => {
            let hint = COMMANDS
                .iter()
                .find(|c| c.name.starts_with(other))
                .map(|c| format!(" — did you mean {}?", accent(&format!("/{}", c.name))))
                .unwrap_or_default();
            err(&format!("Unknown command “{other}”{hint}  (/help lists them all)"))
        }
    }
}

// ── helpers ──────────────────────────────────────────────────────────────────

fn s<'a>(v: &'a Value, key: &str) -> &'a str { v[key].as_str().unwrap_or("") }
fn flag(v: &Value, key: &str) -> bool { v[key].as_bool().unwrap_or(false) }

fn live(items: Vec<Value>) -> Vec<Value> {
    items.into_iter().filter(|i| i["trashedAt"].is_null()).collect()
}

fn p_opened(p: &Value) -> &str { p["meta"]["lastOpenedAt"].as_str().unwrap_or("") }

/// Name, slug, id, or list number → project. Empty means "the project I'm
/// currently inside" (if any).
fn find_project(ctx: &Ctx, query: &str) -> Option<Value> {
    let query = query.trim();
    if query.is_empty() { return ctx.current_project(); }
    if let Ok(n) = query.parse::<usize>() {
        if let Some(p) = ctx.project_by_number(n) { return Some(p); }
    }
    let q = query.to_lowercase();
    let ps = live(ctx.store.list(Kind::Projects));
    let by = |f: &dyn Fn(&Value) -> bool| ps.iter().find(|p| f(p)).cloned();
    by(&|p| s(p, "id") == query)
        .or_else(|| by(&|p| s(p, "slug").to_lowercase() == q))
        .or_else(|| by(&|p| s(p, "name").to_lowercase() == q))
        .or_else(|| by(&|p| s(p, "name").to_lowercase().contains(&q)))
}

fn need_project(ctx: &Ctx, query: &str) -> Result<Value, Outcome> {
    if query.trim().is_empty() && ctx.current_project().is_none() {
        return Err(err("Which project? Give a name or its number from /projects."));
    }
    find_project(ctx, query).ok_or_else(|| err(&format!("No project matches “{}”.", query.trim())))
}

/// For commands shaped `<project> <rest…>`: inside a project prompt the
/// project is implied and everything is `rest`.
fn split_project_args(ctx: &Ctx, arg: &str) -> Result<(Value, String), Outcome> {
    if let Some(p) = ctx.current_project() {
        return Ok((p, arg.trim().to_string()));
    }
    let arg = arg.trim();
    let (first, rest) = match arg.split_once(char::is_whitespace) {
        Some((f, r)) => (f, r.trim()),
        None => (arg, ""),
    };
    let p = need_project(ctx, first)?;
    Ok((p, rest.to_string()))
}

fn project_root(p: &Value) -> Option<PathBuf> {
    let r = p["paths"]["projectRoot"].as_str()?;
    if r.is_empty() { None } else { Some(PathBuf::from(r)) }
}

fn existing_root(p: &Value) -> Result<PathBuf, Outcome> {
    project_root(p)
        .filter(|r| r.is_dir())
        .ok_or_else(|| err("That project's folder doesn't exist on this machine."))
}

pub fn root_of(p: &Value) -> Option<PathBuf> { project_root(p).filter(|r| r.is_dir()) }

fn prio_rank(p: &str) -> u8 {
    match p { "high" => 0, "low" => 2, _ => 1 }
}

fn open_todos_sorted(ctx: &Ctx) -> Vec<Value> {
    let mut v: Vec<Value> = live(ctx.store.list(Kind::Todos)).into_iter().filter(|t| !flag(t, "completed")).collect();
    sort_todos(&mut v);
    v
}

fn sort_todos(v: &mut [Value]) {
    v.sort_by(|a, b| {
        prio_rank(s(a, "priority"))
            .cmp(&prio_rank(s(b, "priority")))
            .then_with(|| {
                let (da, db) = (s(a, "dueDate"), s(b, "dueDate"));
                match (da.is_empty(), db.is_empty()) {
                    (true, true) => std::cmp::Ordering::Equal,
                    (true, false) => std::cmp::Ordering::Greater,
                    (false, true) => std::cmp::Ordering::Less,
                    _ => da.cmp(db),
                }
            })
            .then_with(|| s(b, "createdAt").cmp(s(a, "createdAt")))
    });
}

fn project_name_map(ctx: &Ctx) -> std::collections::HashMap<String, String> {
    ctx.store.list(Kind::Projects).iter().map(|p| (s(p, "id").to_string(), s(p, "name").to_string())).collect()
}

/// Resolve "3", an id prefix, or a unique title fragment to an item.
fn resolve(ids_on_screen: &[String], pool: Vec<Value>, token: &str) -> Result<Value, String> {
    let token = token.trim();
    if token.is_empty() {
        return Err("Say which one — a number from the list, or part of its title.".into());
    }
    if let Ok(n) = token.parse::<usize>() {
        let id = ids_on_screen
            .get(n.wrapping_sub(1))
            .ok_or_else(|| format!("No item #{n} — run the listing command first."))?;
        return pool.into_iter().find(|t| s(t, "id") == id).ok_or_else(|| "That item no longer exists.".to_string());
    }
    let lower = token.to_lowercase();
    if token.len() >= 6 {
        let by_id: Vec<&Value> = pool.iter().filter(|t| s(t, "id").starts_with(token)).collect();
        if by_id.len() == 1 { return Ok(by_id[0].clone()); }
    }
    let hits: Vec<&Value> = pool
        .iter()
        .filter(|t| {
            let title = if t["title"].is_string() { s(t, "title") } else { s(t, "name") };
            title.to_lowercase().contains(&lower)
        })
        .collect();
    match hits.len() {
        0 => Err(format!("Nothing matches “{token}”.")),
        1 => Ok(hits[0].clone()),
        n => Err(format!("“{token}” matches {n} items — be more specific or use its number.")),
    }
}

// ── help ─────────────────────────────────────────────────────────────────────

fn help() -> Outcome {
    let mut lines = vec![
        bold("Commands"),
        dim("  The slash is optional at home. Inside a project prompt (cmd <project>) anything else is a shell command."),
        dim("  Projects can be given by name or by the number next to them: open 2 · cmd 1 · git 3 status"),
    ];
    for c in COMMANDS {
        lines.push(format!("  {}  {}", pad(&accent(&format!("/{}", c.name)), 12), c.desc));
        if !c.args.is_empty() {
            lines.push(format!("  {}  {}", " ".repeat(10), dim(c.args)));
        }
    }
    out(lines)
}

// ── projects ─────────────────────────────────────────────────────────────────

fn top_language(p: &Value) -> Option<String> {
    p["languages"]
        .as_array()?
        .iter()
        .max_by(|a, b| {
            a["pct"].as_f64().unwrap_or(0.0).partial_cmp(&b["pct"].as_f64().unwrap_or(0.0)).unwrap_or(std::cmp::Ordering::Equal)
        })
        .and_then(|l| l["name"].as_str().map(|n| n.to_string()))
}

fn projects(ctx: &Ctx, filter: &str) -> Outcome {
    let all = ctx.ordered_projects();
    if all.is_empty() { return Outcome::Out(dim("No projects yet — create one in the Croco app.")); }
    let f = filter.to_lowercase();
    let todos = live(ctx.store.list(Kind::Todos));
    let mut lines = vec![];
    for (i, p) in all.iter().enumerate() {
        if !f.is_empty() && !s(p, "name").to_lowercase().contains(&f) { continue; }
        let open = todos.iter().filter(|t| s(t, "projectId") == s(p, "id") && !flag(t, "completed")).count();
        let lang = top_language(p).unwrap_or_default();
        let star = if flag(p, "favourite") { yellow("★") } else { " ".into() };
        lines.push(format!(
            "  {} {} {} {} {} {}",
            accent(&format!("{:>2}", i + 1)),
            star,
            pad(&bold(&truncate(s(p, "name"), 26)), 27),
            pad(&dim(&lang), 12),
            pad(&dim(&rel_time(p_opened(p))), 9),
            if open > 0 { accent(&format!("{open} open")) } else { String::new() },
        ));
    }
    if lines.is_empty() { return Outcome::Out(dim("No projects match.")); }
    let mut all_lines = vec![bold(&format!("Projects ({})", lines.len()))];
    all_lines.extend(lines);
    all_lines.push(dim("  Use the number: open 1 · cmd 2 · todos 3 · git 1 status · github 2 issues"));
    out(all_lines)
}

fn project(ctx: &Ctx, query: &str) -> Outcome {
    let p = match need_project(ctx, query) { Ok(p) => p, Err(e) => return e };
    let todos = live(ctx.store.list(Kind::Todos));
    let mine: Vec<&Value> = todos.iter().filter(|t| s(t, "projectId") == s(&p, "id")).collect();
    let open = mine.iter().filter(|t| !flag(t, "completed")).count();
    let row = |k: &str, v: String| format!("  {} {}", dim(&pad(k, 10)), v);
    let mut lines = vec![format!("{} {}", bold(s(&p, "name")), dim(&format!("({})", s(&p, "slug"))))];
    if !s(&p, "description").is_empty() {
        lines.push(format!("  {}", s(&p, "description")));
    }
    lines.push(row("path", project_root(&p).map(|r| r.display().to_string()).unwrap_or_else(|| dim("—"))));
    if !s(&p, "github").is_empty() { lines.push(row("github", s(&p, "github").to_string())); }
    if let Some(l) = top_language(&p) { lines.push(row("language", l)); }
    lines.push(row("editor", if s(&p, "ide").is_empty() { "vscode".into() } else { s(&p, "ide").to_string() }));
    lines.push(row("opened", format!("{} · {} times", rel_time(p_opened(&p)), p["meta"]["openCount"].as_u64().unwrap_or(0))));
    lines.push(row("todos", format!("{open} open · {} total", mine.len())));
    for k in ["dev", "build", "test", "start"] {
        let c = s(&p["commands"], k);
        if !c.is_empty() { lines.push(row(k, c.to_string())); }
    }
    out(lines)
}

fn enter_shell(ctx: &Ctx, query: &str) -> Outcome {
    let p = match need_project(ctx, query) { Ok(p) => p, Err(e) => return e };
    if let Err(e) = existing_root(&p) { return e; }
    ctx.set_current(Some(s(&p, "id").to_string()));
    Outcome::Shell
}

// ── todos ────────────────────────────────────────────────────────────────────

fn todos(ctx: &Ctx, arg: &str) -> Outcome {
    let a = arg.trim().to_lowercase();
    let names = project_name_map(ctx);
    let (mut list, title) = match a.as_str() {
        "" | "open" => match ctx.current_project() {
            Some(p) => {
                let v: Vec<Value> = open_todos_sorted(ctx).into_iter().filter(|t| s(t, "projectId") == s(&p, "id")).collect();
                (v, format!("Open todos · {}", s(&p, "name")))
            }
            None => (open_todos_sorted(ctx), "Open todos".to_string()),
        },
        "all" => {
            let mut v = live(ctx.store.list(Kind::Todos));
            sort_todos(&mut v);
            (v, "All todos".to_string())
        }
        "done" | "completed" => {
            let mut v: Vec<Value> = live(ctx.store.list(Kind::Todos)).into_iter().filter(|t| flag(t, "completed")).collect();
            v.sort_by(|a, b| s(b, "completedAt").cmp(s(a, "completedAt")));
            (v, "Completed".to_string())
        }
        _ => {
            let p = match need_project(ctx, arg) { Ok(p) => p, Err(e) => return e };
            let v: Vec<Value> = open_todos_sorted(ctx).into_iter().filter(|t| s(t, "projectId") == s(&p, "id")).collect();
            (v, format!("Open todos · {}", s(&p, "name")))
        }
    };
    if list.is_empty() {
        *ctx.last_todos.borrow_mut() = vec![];
        return Outcome::Out(dim("Nothing here — add one with /add <title>."));
    }
    let total = list.len();
    list.truncate(200);
    *ctx.last_todos.borrow_mut() = list.iter().map(|t| s(t, "id").to_string()).collect();

    let mut lines = vec![bold(&format!("{title} ({total})"))];
    for (i, t) in list.iter().enumerate() {
        let done = flag(t, "completed");
        let mark = if done { green("✓") } else { dim("○") };
        let title_txt = truncate(s(t, "title"), 60);
        let title_txt = if done { dim(&title_txt) } else { title_txt };
        let mut tail = vec![];
        if let Some((label, late)) = t["dueDate"].as_str().and_then(due_label) {
            if !done { tail.push(if late { red(&label) } else { dim(&label) }); }
        }
        if let Some(n) = t["projectId"].as_str().and_then(|id| names.get(id)) {
            tail.push(blue(&format!("@{n}")));
        }
        lines.push(format!(
            "  {} {} {} {}  {}",
            accent(&format!("{:>2}", i + 1)), mark, priority_tag(s(t, "priority")), title_txt, tail.join(" ")
        ));
    }
    if total > list.len() {
        lines.push(dim(&format!("  … and {} more", total - list.len())));
    }
    lines.push(dim("  done <#> · edit <#> <new title> · rm <#>"));
    out(lines)
}

struct TodoTokens {
    words: Vec<String>,
    priority: Option<String>,
    due: Option<Option<String>>,
    project: Option<Option<Value>>,
}

fn parse_todo_tokens(ctx: &Ctx, arg: &str) -> Result<TodoTokens, Outcome> {
    let mut t = TodoTokens { words: vec![], priority: None, due: None, project: None };
    for w in arg.split_whitespace() {
        if let Some(p) = w.strip_prefix('!') {
            match p {
                "high" | "h" => t.priority = Some("high".into()),
                "low" | "l" => t.priority = Some("low".into()),
                "med" | "m" => t.priority = Some("med".into()),
                _ => t.words.push(w.to_string()),
            }
        } else if let Some(name) = w.strip_prefix('@') {
            if name == "none" {
                t.project = Some(None);
            } else {
                match find_project(ctx, name) {
                    Some(p) => t.project = Some(Some(p)),
                    None => return Err(err(&format!("No project matches “{name}”."))),
                }
            }
        } else if let Some(d) = w.strip_prefix("due:") {
            if d == "none" {
                t.due = Some(None);
            } else if NaiveDate::parse_from_str(d, "%Y-%m-%d").is_err() {
                return Err(err("Dates look like due:2026-12-31 (or due:none)."));
            } else {
                t.due = Some(Some(d.to_string()));
            }
        } else {
            t.words.push(w.to_string());
        }
    }
    Ok(t)
}

fn add_todo(ctx: &Ctx, arg: &str) -> Outcome {
    let t = match parse_todo_tokens(ctx, arg) { Ok(t) => t, Err(e) => return e };
    let title = t.words.join(" ");
    if title.is_empty() {
        return err("A todo needs a title: /add Write the release notes !high @croco");
    }
    // Inside a project prompt, new todos belong to that project by default.
    let project = match t.project {
        Some(p) => p,
        None => ctx.current_project(),
    };
    let todo = json!({
        "id": uuid::Uuid::new_v4().to_string(),
        "title": title,
        "emoji": Value::Null,
        "completed": false,
        "priority": t.priority.unwrap_or_else(|| "med".into()),
        "projectId": project.as_ref().map(|p| json!(s(p, "id"))).unwrap_or(Value::Null),
        "noteId": Value::Null,
        "dueDate": t.due.flatten().map(Value::from).unwrap_or(Value::Null),
        "createdAt": Utc::now().to_rfc3339(),
    });
    match ctx.store.save(Kind::Todos, &todo) {
        Ok(()) => ok(&format!("Added {}", bold(&title))),
        Err(e) => err(&e),
    }
}

fn edit_todo(ctx: &Ctx, arg: &str) -> Outcome {
    let (target, rest) = match arg.trim().split_once(char::is_whitespace) {
        Some((t, r)) => (t, r.trim()),
        None => (arg.trim(), ""),
    };
    if target.is_empty() || rest.is_empty() {
        return err("Usage: /edit <#> <new title> [!high] [due:2026-12-31|none] [@project|@none]");
    }
    let mut todo = match pick_todo(ctx, target) { Ok(t) => t, Err(e) => return err(&e) };
    let t = match parse_todo_tokens(ctx, rest) { Ok(t) => t, Err(e) => return e };
    let mut changed = vec![];
    if !t.words.is_empty() {
        todo["title"] = json!(t.words.join(" "));
        changed.push("title");
    }
    if let Some(p) = t.priority { todo["priority"] = json!(p); changed.push("priority"); }
    if let Some(d) = t.due { todo["dueDate"] = d.map(Value::from).unwrap_or(Value::Null); changed.push("due date"); }
    if let Some(p) = t.project {
        todo["projectId"] = p.map(|p| json!(s(&p, "id"))).unwrap_or(Value::Null);
        changed.push("project");
    }
    if changed.is_empty() { return err("Nothing to change."); }
    match ctx.store.save(Kind::Todos, &todo) {
        Ok(()) => ok(&format!("Updated {} ({})", bold(s(&todo, "title")), changed.join(", "))),
        Err(e) => err(&e),
    }
}

fn pick_todo(ctx: &Ctx, token: &str) -> Result<Value, String> {
    let screen = ctx.last_todos.borrow().clone();
    let ids = if screen.is_empty() {
        open_todos_sorted(ctx).iter().map(|t| s(t, "id").to_string()).collect()
    } else {
        screen
    };
    resolve(&ids, live(ctx.store.list(Kind::Todos)), token)
}

fn toggle_todo(ctx: &Ctx, token: &str) -> Outcome {
    let mut t = match pick_todo(ctx, token) { Ok(t) => t, Err(e) => return err(&e) };
    let now_done = !flag(&t, "completed");
    t["completed"] = json!(now_done);
    t["completedAt"] = if now_done { json!(Utc::now().to_rfc3339()) } else { Value::Null };
    match ctx.store.save(Kind::Todos, &t) {
        Ok(()) => ok(&format!("{} {}", if now_done { "Completed" } else { "Reopened" }, bold(s(&t, "title")))),
        Err(e) => err(&e),
    }
}

fn remove_todo(ctx: &Ctx, token: &str) -> Outcome {
    let t = match pick_todo(ctx, token) { Ok(t) => t, Err(e) => return err(&e) };
    // Soft delete, like the app: set trashedAt so it lands in Trash and can be
    // restored, instead of removing the file/row outright.
    let mut t = t;
    t["trashedAt"] = json!(Utc::now().to_rfc3339());
    match ctx.store.save(Kind::Todos, &t) {
        Ok(()) => {
            ctx.last_todos.borrow_mut().clear();
            ok(&format!("Moved {} to Trash", bold(s(&t, "title"))))
        }
        Err(e) => err(&e),
    }
}

// ── notes ────────────────────────────────────────────────────────────────────

fn notes(ctx: &Ctx, filter: &str) -> Outcome {
    let mut ns: Vec<Value> = live(ctx.store.list(Kind::Notes)).into_iter().filter(|n| !flag(n, "archived")).collect();
    let f = filter.to_lowercase();
    if !f.is_empty() { ns.retain(|n| s(n, "title").to_lowercase().contains(&f)); }
    ns.sort_by(|a, b| s(b, "updatedAt").cmp(s(a, "updatedAt")));
    if ns.is_empty() { return Outcome::Out(dim("No notes yet — /note My idea : the details")); }
    ns.truncate(100);
    *ctx.last_notes.borrow_mut() = ns.iter().map(|n| s(n, "id").to_string()).collect();
    let mut lines = vec![bold(&format!("Notes ({})", ns.len()))];
    for (i, n) in ns.iter().enumerate() {
        let star = if flag(n, "starred") { yellow("★") } else { " ".into() };
        lines.push(format!(
            "  {} {} {}  {}",
            accent(&format!("{:>2}", i + 1)), star, pad(&truncate(s(n, "title"), 40), 40), dim(&rel_time(s(n, "updatedAt")))
        ));
    }
    out(lines)
}

fn add_note(ctx: &Ctx, arg: &str) -> Outcome {
    let (title, body) = match arg.split_once(" : ") {
        Some((t, b)) => (t.trim(), b.trim()),
        None => (arg.trim(), ""),
    };
    if title.is_empty() { return err("A note needs a title: /note Title : optional body"); }
    let now = Utc::now().to_rfc3339();
    let meta = json!({
        "id": uuid::Uuid::new_v4().to_string(), "title": title, "emoji": "📝", "starred": false,
        "archived": false,
        "projectId": ctx.current_project().map(|p| json!(s(&p, "id"))).unwrap_or(Value::Null),
        "tags": [], "createdAt": now, "updatedAt": now,
    });
    match ctx.store.save_note(&meta, body) {
        Ok(()) => ok(&format!("Note {} saved", bold(title))),
        Err(e) => err(&e),
    }
}

fn read_note(ctx: &Ctx, token: &str) -> Outcome {
    let screen = ctx.last_notes.borrow().clone();
    let pool = live(ctx.store.list(Kind::Notes));
    let ids: Vec<String> = if screen.is_empty() {
        let mut v = pool.clone();
        v.sort_by(|a, b| s(b, "updatedAt").cmp(s(a, "updatedAt")));
        v.iter().map(|n| s(n, "id").to_string()).collect()
    } else {
        screen
    };
    match resolve(&ids, pool, token) {
        Ok(n) => out(vec![bold(s(&n, "title")), dim(&"─".repeat(40)), ctx.store.note_content(&n)]),
        Err(e) => err(&e),
    }
}

// ── schedules ────────────────────────────────────────────────────────────────

fn schedules(ctx: &Ctx) -> Outcome {
    let mut v: Vec<Value> = live(ctx.store.list(Kind::Schedules)).into_iter().filter(|x| !flag(x, "completed")).collect();
    if v.is_empty() { return Outcome::Out(dim("No upcoming deadlines.")); }
    v.sort_by(|a, b| s(a, "dueDate").cmp(s(b, "dueDate")));
    let mut lines = vec![bold(&format!("Upcoming ({})", v.len()))];
    for x in v.iter().take(50) {
        let when = x["dueDate"]
            .as_str()
            .and_then(due_label)
            .map(|(l, late)| if late { red(&l) } else { dim(&l) })
            .unwrap_or_default();
        lines.push(format!("  {} {}  {}  {}", dim("◷"), pad(&truncate(s(x, "title"), 40), 40), pad(s(x, "dueDate"), 10), when));
    }
    out(lines)
}

// ── stats ────────────────────────────────────────────────────────────────────

const RANGES: &[(&str, &str, Option<i64>)] = &[
    ("today", "Today", Some(1)),
    ("7d", "7 days", Some(7)),
    ("30d", "30 days", Some(30)),
    ("3m", "3 months", Some(90)),
    ("all", "Lifetime", None),
];

fn ts(iso: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(iso).ok().map(|d| d.with_timezone(&Utc))
}

/// Same maths as the Patterns page (src/lib/todoStats.js): a todo is "in play"
/// when created or finished inside the window; rate = finished ÷ in play.
fn window_stats(todos: &[Value], days: Option<i64>) -> (u32, usize, usize) {
    let start = days.map(|d| {
        let midnight = Local::now().date_naive().and_hms_opt(0, 0, 0).unwrap_or_default() - chrono::Duration::days(d - 1);
        Local.from_local_datetime(&midnight).earliest().map(|l| l.with_timezone(&Utc)).unwrap_or_else(Utc::now)
    });
    let inside = |iso: &str| match (ts(iso), start) {
        (Some(t), Some(s)) => t >= s,
        (Some(_), None) => true,
        _ => false,
    };
    let (mut created, mut done, mut in_play) = (0usize, 0usize, 0usize);
    for t in todos {
        let made = inside(s(t, "createdAt"));
        let fin = flag(t, "completed") && inside(s(t, "completedAt"));
        if made { created += 1; }
        if fin { done += 1; }
        if made || fin { in_play += 1; }
    }
    let rate = if in_play > 0 { ((done as f64 / in_play as f64) * 100.0).round() as u32 } else { 0 };
    (rate, done, created)
}

fn stats(ctx: &Ctx, arg: &str) -> Outcome {
    let todos = live(ctx.store.list(Kind::Todos));
    let open = todos.iter().filter(|t| !flag(t, "completed")).count();
    let a = arg.trim().to_lowercase();
    let wanted: Vec<_> = RANGES.iter().filter(|r| a.is_empty() || r.0 == a).collect();
    if wanted.is_empty() { return err("Pick one of: today, 7d, 30d, 3m, all."); }
    let mut lines = vec![bold("Todo completion")];
    for (_, label, days) in wanted {
        let (rate, done, created) = window_stats(&todos, *days);
        lines.push(format!(
            "  {} {} {}  {}",
            pad(label, 9), bar(rate, 14), pad(&bold(&format!("{rate}%")), 5), dim(&format!("{done} done · {created} created"))
        ));
    }
    lines.push(format!("  {} {}", pad("Open now", 9), accent(&open.to_string())));
    out(lines)
}

// ── launching things ─────────────────────────────────────────────────────────

fn open_project(ctx: &Ctx, query: &str) -> Outcome {
    let p = match need_project(ctx, query) { Ok(p) => p, Err(e) => return e };
    let root = match existing_root(&p) { Ok(r) => r, Err(e) => return e };
    let bin = match s(&p, "ide") {
        "cursor" => "cursor",
        "webstorm" => "webstorm",
        "idea" => "idea",
        "zed" => "zed",
        "sublime" => "subl",
        "vim" | "neovim" => {
            return Outcome::Spawn { label: format!("{} in neovim", s(&p, "name")), command: "nvim .".into(), cwd: root };
        }
        _ => "code",
    };
    // Editors on Windows are .cmd shims, which only resolve through cmd.exe.
    let spawned = if cfg!(windows) {
        Command::new("cmd").args(["/C", bin]).arg(&root).spawn()
    } else {
        Command::new(bin).arg(&root).spawn()
    };
    match spawned {
        Ok(_) => ok(&format!("Opened {} in {}", bold(s(&p, "name")), bin)),
        Err(e) => err(&format!("Couldn't launch {bin}: {e}")),
    }
}

fn code(ctx: &Ctx, query: &str) -> Outcome {
    let (cwd, name) = if query.trim().is_empty() && ctx.current_project().is_none() {
        (std::env::current_dir().unwrap_or_default(), "this folder".to_string())
    } else {
        let p = match need_project(ctx, query) { Ok(p) => p, Err(e) => return e };
        match existing_root(&p) {
            Ok(root) => (root, s(&p, "name").to_string()),
            Err(e) => return e,
        }
    };
    Outcome::Spawn { label: format!("Claude Code in {name}"), command: "claude".into(), cwd }
}

fn run_project(ctx: &Ctx, arg: &str) -> Outcome {
    let arg = arg.trim();
    let (q, kind) = match arg.rsplit_once(char::is_whitespace) {
        Some((q, k)) if ["dev", "build", "test", "start"].contains(&k) => (q.trim(), k),
        None if ["dev", "build", "test", "start"].contains(&arg) => ("", arg),
        _ => (arg, "dev"),
    };
    let p = match need_project(ctx, q) { Ok(p) => p, Err(e) => return e };
    let cmd = s(&p["commands"], kind);
    if cmd.is_empty() {
        return err(&format!("{} has no “{kind}” command — set one in the app.", s(&p, "name")));
    }
    let root = match existing_root(&p) { Ok(r) => r, Err(e) => return e };
    Outcome::Job { label: format!("{} — {cmd}", s(&p, "name")), command: cmd.to_string(), cwd: root }
}

// ── git & GitHub ─────────────────────────────────────────────────────────────

fn git(ctx: &Ctx, arg: &str) -> Outcome {
    let (p, rest) = match split_project_args(ctx, arg) { Ok(v) => v, Err(e) => return e };
    let root = match existing_root(&p) { Ok(r) => r, Err(e) => return e };
    if !rest.is_empty() {
        return Outcome::Job { label: format!("{} — git {rest}", s(&p, "name")), command: format!("git {rest}"), cwd: root };
    }
    let run = |args: &[&str]| {
        Command::new("git")
            .arg("-C")
            .arg(&root)
            .args(args)
            .output()
            .ok()
            .filter(|o| o.status.success())
            .map(|o| String::from_utf8_lossy(&o.stdout).trim_end().to_string())
    };
    let Some(status) = run(&["status", "-sb"]) else { return err("Not a git repository (or git isn't installed).") };
    let mut lines = vec![bold(s(&p, "name"))];
    lines.extend(status.lines().map(|l| format!("  {l}")));
    if let Some(log) = run(&["log", "--oneline", "-n", "6", "--decorate"]) {
        lines.push(String::new());
        lines.push(dim("  recent commits"));
        lines.extend(log.lines().map(|l| format!("  {l}")));
    }
    out(lines)
}

fn git_shortcut(ctx: &Ctx, arg: &str, build: impl Fn(&str) -> String) -> Outcome {
    let (p, rest) = match split_project_args(ctx, arg) { Ok(v) => v, Err(e) => return e };
    let root = match existing_root(&p) { Ok(r) => r, Err(e) => return e };
    let command = build(&rest).trim().to_string();
    Outcome::Job { label: format!("{} — {command}", s(&p, "name")), command, cwd: root }
}

fn commit(ctx: &Ctx, arg: &str) -> Outcome {
    let (p, msg) = match split_project_args(ctx, arg) { Ok(v) => v, Err(e) => return e };
    let msg = msg.trim().trim_matches('"').replace('"', "'");
    if msg.is_empty() { return err("A commit needs a message: /commit <project> Fix the login redirect"); }
    let root = match existing_root(&p) { Ok(r) => r, Err(e) => return e };
    Outcome::Job {
        label: format!("{} — commit", s(&p, "name")),
        command: format!("git add -A && git commit -m \"{msg}\""),
        cwd: root,
    }
}

fn have(tool: &str) -> bool {
    Command::new(tool).arg("--version").output().map(|o| o.status.success()).unwrap_or(false)
}

fn github(ctx: &Ctx, arg: &str) -> Outcome {
    let (p, rest) = match split_project_args(ctx, arg) { Ok(v) => v, Err(e) => return e };
    let root = match existing_root(&p) { Ok(r) => r, Err(e) => return e };
    if !have("gh") {
        return err("This needs the GitHub CLI (gh) — install it from https://cli.github.com, then run `gh auth login`.");
    }
    let repo = s(&p, "github");
    let target = if repo.is_empty() { String::new() } else { format!(" -R {repo}") };
    let (sub, extra) = match rest.split_once(char::is_whitespace) {
        Some((a, b)) => (a, b.trim()),
        None => (rest.as_str(), ""),
    };
    let command = match sub {
        "" | "repo" | "info" => format!("gh repo view{}", if repo.is_empty() { String::new() } else { format!(" {repo}") }),
        "issues" | "issue" => format!("gh issue list{target} {extra}"),
        "prs" | "pr" => format!("gh pr list{target} {extra}"),
        "runs" | "actions" => format!("gh run list{target} -L 10 {extra}"),
        "releases" | "release" => format!("gh release list{target} {extra}"),
        "web" | "browse" => format!("gh repo view{} --web", if repo.is_empty() { String::new() } else { format!(" {repo}") }),
        _ => format!("gh {rest}"),
    };
    Outcome::Job { label: format!("{} — {}", s(&p, "name"), command.trim()), command: command.trim().to_string(), cwd: root }
}

fn launch_app() -> Outcome {
    let mut candidates: Vec<PathBuf> = vec![];
    if let Ok(exe) = std::env::current_exe() {
        // Installed layout: <install>/bin/croco(.exe) sits beside <install>/Croco(.exe)
        for dir in [exe.parent().and_then(|p| p.parent()), exe.parent()].into_iter().flatten() {
            for name in ["Croco.exe", "croco.exe", "Croco"] {
                let c = dir.join(name);
                if c != exe { candidates.push(c); }
            }
        }
    }
    if let Some(local) = dirs::data_local_dir() {
        candidates.push(local.join("Programs").join("Croco").join("Croco.exe"));
    }
    candidates.push(PathBuf::from(r"C:\Program Files\Croco\Croco.exe"));
    if let Some(exe) = candidates.iter().find(|c| c.is_file()) {
        return match Command::new(exe).spawn() {
            Ok(_) => ok("Launching Croco…"),
            Err(e) => err(&format!("Couldn't start Croco: {e}")),
        };
    }
    // Fall back to the croco:// scheme the installer registers.
    let result = if cfg!(windows) {
        Command::new("cmd").args(["/C", "start", "", "croco://open"]).spawn()
    } else if cfg!(target_os = "macos") {
        Command::new("open").arg("-a").arg("Croco").spawn()
    } else {
        Command::new("xdg-open").arg("croco://open").spawn()
    };
    match result {
        Ok(_) => ok("Launching Croco…"),
        Err(_) => err("Couldn't find the Croco app — is it installed?"),
    }
}

// ── dashboard data (home screen panels) ──────────────────────────────────────

pub struct DashTodo {
    pub priority: String,
    pub title: String,
    pub due: Option<(String, bool)>,
}

pub struct DashProject {
    pub number: usize,
    pub name: String,
    pub ago: String,
    pub open: usize,
}

pub struct Dash {
    pub open_total: usize,
    pub project_count: usize,
    pub todos: Vec<DashTodo>,
    pub projects: Vec<DashProject>,
    pub rates: Vec<(&'static str, u32)>,
    /// Open todos of the project the prompt is currently inside.
    pub scoped_todos: Vec<DashTodo>,
}

fn dash_todo(t: &Value) -> DashTodo {
    DashTodo {
        priority: s(t, "priority").to_string(),
        title: s(t, "title").to_string(),
        due: t["dueDate"].as_str().and_then(due_label),
    }
}

pub fn dashboard(ctx: &Ctx) -> Dash {
    let ps = ctx.ordered_projects();
    let todos_all = live(ctx.store.list(Kind::Todos));
    let open: Vec<Value> = {
        let mut v: Vec<Value> = todos_all.iter().filter(|t| !flag(t, "completed")).cloned().collect();
        sort_todos(&mut v);
        v
    };
    let current = ctx.current_project();
    let scoped_todos = match &current {
        Some(p) => open.iter().filter(|t| s(t, "projectId") == s(p, "id")).take(12).map(dash_todo).collect(),
        None => vec![],
    };
    let projects = ps
        .iter()
        .enumerate()
        .take(12)
        .map(|(i, p)| DashProject {
            number: i + 1,
            name: s(p, "name").to_string(),
            ago: rel_time(p_opened(p)),
            open: open.iter().filter(|t| s(t, "projectId") == s(p, "id")).count(),
        })
        .collect();
    Dash {
        open_total: open.len(),
        project_count: ps.len(),
        todos: open.iter().take(12).map(dash_todo).collect(),
        projects,
        rates: vec![
            ("Today", window_stats(&todos_all, Some(1)).0),
            ("7 days", window_stats(&todos_all, Some(7)).0),
            ("30 days", window_stats(&todos_all, Some(30)).0),
        ],
        scoped_todos,
    }
}

/// The one-line status shown by a bare piped `croco`.
pub fn summary(ctx: &Ctx) -> String {
    let projects = live(ctx.store.list(Kind::Projects)).into_iter().filter(|p| !flag(p, "archived")).count();
    let todos = live(ctx.store.list(Kind::Todos));
    let open = todos.iter().filter(|t| !flag(t, "completed")).count();
    let (rate, _, _) = window_stats(&todos, Some(7));
    format!(
        "{projects} projects · {open} open todos · {rate}% done this week · {} storage",
        if ctx.store.sqlite { "sqlite" } else { "json" }
    )
}
