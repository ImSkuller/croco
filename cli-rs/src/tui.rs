//! The interactive screen. A full-screen, resize-aware layout:
//!
//!   ┌ scrollback (banner + command output, scrollable) ┐
//!   │                                                  │
//!   ├──────────── centred command bar ─────────────────┤
//!   │ live panels: todos · projects · completion       │  (project info while
//!   │                                                  │   inside a project)
//!   └ status bar: mode · hints · clock ────────────────┘
//!
//! Commands never block the UI: shell commands run as jobs whose output is
//! streamed into the scrollback while the prompt stays usable, and Ctrl+C
//! stops the whole process tree.

use crate::commands::{self, Cmd, Ctx, Dash, DashTodo, Outcome, COMMANDS};
use crate::{logo, ui::*};
use chrono::{Local, Timelike};
use crossterm::{
    cursor::{Hide, MoveTo, Show},
    event::{self, DisableBracketedPaste, EnableBracketedPaste, Event, KeyCode, KeyEventKind, KeyModifiers},
    execute, queue,
    style::Print,
    terminal::{self, Clear, ClearType, EnterAlternateScreen, LeaveAlternateScreen},
};
use std::io::{self, Read, Stdout, Write};
use std::path::{Component, Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc::{self, Receiver, Sender};
use std::thread;
use std::time::{Duration, Instant};

mod draw;
mod events;

const MAX_SUGGESTIONS: usize = 8;
const MAX_LINES: usize = 6000;
const SPINNER: &[&str] = &["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// ── messages from background threads ─────────────────────────────────────────

#[derive(Clone, Default)]
struct GitInfo {
    branch: String,
    dirty: usize,
    last: String,
}

enum Msg {
    Line(String),
    /// A `\r`-terminated progress line: replaces the previous progress line.
    Progress(String),
    /// A `\r\n` ended the progress line: it is final now.
    Settle,
    Eof,
    Info { root: PathBuf, info: GitInfo },
}

struct Job {
    child: Child,
    label: String,
    started: Instant,
    eofs: u8,
    exited: Option<(i32, Instant)>,
    stopped: bool,
}

struct Session {
    name: String,
    root: PathBuf,
    cwd: PathBuf,
    github: String,
    commands: Vec<(String, String)>,
    git: Option<GitInfo>,
}

struct Prompt {
    buf: Vec<char>,
    cur: usize,
    history: Vec<String>,
    hist_pos: Option<usize>,
    sel: usize,
}

impl Prompt {
    fn text(&self) -> String { self.buf.iter().collect() }
    fn set(&mut self, s: &str) {
        self.buf = s.chars().collect();
        self.cur = self.buf.len();
        self.sel = 0;
    }
}

struct App<'a> {
    ctx: &'a Ctx,
    out: Vec<String>,
    scroll: usize,
    p: Prompt,
    session: Option<Session>,
    job: Option<Job>,
    tx: Sender<Msg>,
    rx: Receiver<Msg>,
    progress_active: bool,
    quit_armed: bool,
    quit: bool,
    dash: Dash,
    dash_at: Instant,
    dash_dirty: bool,
    prev: Vec<String>,
    dirty: bool,
    minute: u32,
    spin_at: Instant,
    spin: usize,
    pending_spawn: Option<(String, String, PathBuf)>,
}

// ── process helpers ──────────────────────────────────────────────────────────

#[cfg(windows)]
fn shell(command: &str, cwd: &Path) -> Command {
    use std::os::windows::process::CommandExt;
    let mut c = Command::new("cmd");
    c.arg("/C").raw_arg(command).current_dir(cwd);
    c
}

#[cfg(not(windows))]
fn shell(command: &str, cwd: &Path) -> Command {
    let mut c = Command::new("sh");
    c.arg("-c").arg(command).current_dir(cwd);
    c
}

#[cfg(windows)]
fn no_window(c: &mut Command) {
    use std::os::windows::process::CommandExt;
    c.creation_flags(0x0800_0000);
}

#[cfg(not(windows))]
fn no_window(c: &mut Command) {
    use std::os::unix::process::CommandExt;
    c.process_group(0);
}

fn kill_tree(pid: u32) {
    #[cfg(windows)]
    {
        let mut c = Command::new("taskkill");
        c.args(["/PID", &pid.to_string(), "/T", "/F"]).stdout(Stdio::null()).stderr(Stdio::null());
        no_window(&mut c);
        let _ = c.status();
    }
    #[cfg(not(windows))]
    {
        let _ = Command::new("kill").args(["-TERM", &format!("-{pid}")]).status();
    }
}

fn spawn_child(label: &str, command: &str, cwd: &Path) -> i32 {
    println!("{} {}", accent("▶"), label);
    println!("{}", dim(&format!("  {}", cwd.display())));
    match shell(command, cwd).status() {
        Ok(s) => s.code().unwrap_or(0),
        Err(e) => {
            println!("{} couldn't start: {e}", red("✗"));
            1
        }
    }
}

/// One-shot (non-TUI) use of a spawn request.
pub fn run_spawn(label: &str, command: &str, cwd: &Path) -> i32 { spawn_child(label, command, cwd) }

/// Programs that need a real terminal (editors, REPLs, prompts) can't be
/// piped; they get the screen to themselves until they exit.
fn is_interactive(line: &str) -> bool {
    let mut it = line.split_whitespace();
    let first = it.next().unwrap_or("").to_lowercase();
    let first = first.trim_end_matches(".exe").to_string();
    let args: Vec<&str> = it.collect();
    match first.as_str() {
        "vim" | "vi" | "nvim" | "nano" | "emacs" | "micro" | "less" | "more" | "top" | "htop" | "ssh" | "claude" | "man" | "tmux" => true,
        "python" | "python3" | "py" | "node" | "bash" | "sh" | "zsh" | "pwsh" | "powershell" | "cmd" | "irb" | "ipython" | "deno" | "bun" => args.is_empty(),
        "npm" | "pnpm" | "yarn" => args.first() == Some(&"init") || args.first() == Some(&"login"),
        "gh" => args.first() == Some(&"auth"),
        "git" => {
            args.iter().any(|a| *a == "-i" || *a == "--interactive")
                || (args.first() == Some(&"commit")
                    && !args.iter().any(|a| a.starts_with("-m") || a.starts_with("--message") || *a == "--no-edit" || a.starts_with("-F") || *a == "-am"))
        }
        _ => false,
    }
}

fn normalize(p: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for c in p.components() {
        match c {
            Component::ParentDir => { out.pop(); }
            Component::CurDir => {}
            other => out.push(other.as_os_str()),
        }
    }
    out
}

fn pump<R: Read + Send + 'static>(mut r: R, tx: Sender<Msg>) {
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        let mut line: Vec<u8> = vec![];
        let mut prev_cr = false;
        let text = |b: &[u8]| String::from_utf8_lossy(b).to_string();
        loop {
            match r.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    for &b in &buf[..n] {
                        match b {
                            b'\n' => {
                                if prev_cr {
                                    let _ = tx.send(Msg::Settle);
                                } else {
                                    let _ = tx.send(Msg::Line(text(&line)));
                                }
                                line.clear();
                                prev_cr = false;
                            }
                            b'\r' => {
                                if !line.is_empty() { let _ = tx.send(Msg::Progress(text(&line))); }
                                line.clear();
                                prev_cr = true;
                            }
                            _ => { line.push(b); prev_cr = false; }
                        }
                    }
                }
            }
        }
        if !line.is_empty() { let _ = tx.send(Msg::Line(text(&line))); }
        let _ = tx.send(Msg::Eof);
    });
}

fn fetch_git(root: PathBuf, tx: Sender<Msg>) {
    thread::spawn(move || {
        let run = |args: &[&str]| {
            let mut c = Command::new("git");
            c.arg("-C").arg(&root).args(args).stdin(Stdio::null()).stderr(Stdio::null());
            no_window(&mut c);
            c.output().ok().filter(|o| o.status.success()).map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        };
        let Some(branch) = run(&["rev-parse", "--abbrev-ref", "HEAD"]) else { return };
        let dirty = run(&["status", "--porcelain"]).map(|s| s.lines().count()).unwrap_or(0);
        let last = run(&["log", "-1", "--format=%s"]).unwrap_or_default();
        let _ = tx.send(Msg::Info { root, info: GitInfo { branch, dirty, last } });
    });
}

// ── terminal guard ───────────────────────────────────────────────────────────

struct TermGuard;

impl TermGuard {
    fn enter() -> io::Result<TermGuard> {
        terminal::enable_raw_mode()?;
        execute!(io::stdout(), EnterAlternateScreen, EnableBracketedPaste, Hide)?;
        Ok(TermGuard)
    }
}

impl Drop for TermGuard {
    fn drop(&mut self) {
        let _ = execute!(io::stdout(), Show, DisableBracketedPaste, LeaveAlternateScreen);
        let _ = terminal::disable_raw_mode();
    }
}

// ── layout ───────────────────────────────────────────────────────────────────

struct Lay {
    cw: usize,
    left: usize,
    box_top: usize,
    panel_top: usize,
    panel_h: usize,
}

fn layout(w: usize, h: usize) -> Lay {
    let cw = w.saturating_sub(4).clamp(16, 112);
    let left = w.saturating_sub(cw) / 2;
    let status = h.saturating_sub(1);
    let panel_min = if h >= 24 { 7 } else { 0 };
    let min_top = if h >= 24 { 8 } else { 3 };
    let max_top = status.saturating_sub(3 + panel_min);
    let ideal = (h / 2).saturating_sub(1);
    let box_top = if h >= 16 && max_top >= min_top { ideal.clamp(min_top, max_top) } else { status.saturating_sub(3) };
    let panel_top = box_top + 3;
    Lay { cw, left, box_top, panel_top, panel_h: status.saturating_sub(panel_top) }
}

fn greeting() -> &'static str {
    match Local::now().hour() {
        5..=11 => "Good morning",
        12..=17 => "Good afternoon",
        _ => "Good evening",
    }
}

// ── the app ──────────────────────────────────────────────────────────────────

pub fn run(ctx: &Ctx, start_project: Option<&str>) -> io::Result<()> {
    let _guard = TermGuard::enter()?;
    let (tx, rx) = mpsc::channel();
    let mut app = App {
        ctx,
        out: vec![],
        scroll: 0,
        p: Prompt { buf: vec![], cur: 0, history: vec![], hist_pos: None, sel: 0 },
        session: None,
        job: None,
        tx,
        rx,
        progress_active: false,
        quit_armed: false,
        quit: false,
        dash: commands::dashboard(ctx),
        dash_at: Instant::now(),
        dash_dirty: false,
        prev: vec![],
        dirty: true,
        minute: Local::now().minute(),
        spin_at: Instant::now(),
        spin: 0,
        pending_spawn: None,
    };
    if let Some(q) = start_project {
        app.run_croco(&format!("cmd {q}"));
    }
    let mut out = io::stdout();
    app.flush_spawn(&mut out)?;
    app.event_loop(&mut out)?;
    app.kill_job();
    Ok(())
}

impl<'a> App<'a> {
    fn event_loop(&mut self, out: &mut Stdout) -> io::Result<()> {
        while !self.quit {
            self.drain();
            self.tick();
            if self.dirty {
                self.draw(out)?;
                self.dirty = false;
            }
            let wait = if self.job.is_some() { 40 } else { 250 };
            if event::poll(Duration::from_millis(wait))? {
                // handle everything already queued before redrawing once
                loop {
                    let ev = event::read()?;
                    self.handle(ev)?;
                    self.flush_spawn(out)?;
                    if self.quit || !event::poll(Duration::from_millis(0))? { break; }
                }
            }
        }
        Ok(())
    }

    fn flush_spawn(&mut self, out: &mut Stdout) -> io::Result<()> {
        if let Some((label, command, cwd)) = self.pending_spawn.take() {
            self.suspend_run(&label, &command, &cwd, out)?;
        }
        Ok(())
    }

    fn tick(&mut self) {
        let minute = Local::now().minute();
        if minute != self.minute {
            self.minute = minute;
            refresh_theme();
            self.dirty = true;
        }
        if self.job.is_some() && self.spin_at.elapsed() > Duration::from_millis(100) {
            self.spin = (self.spin + 1) % SPINNER.len();
            self.spin_at = Instant::now();
            self.dirty = true;
        }
        if self.dash_dirty || self.dash_at.elapsed() > Duration::from_secs(20) {
            self.dash = commands::dashboard(self.ctx);
            self.dash_at = Instant::now();
            self.dash_dirty = false;
            self.dirty = true;
        }
    }

    // ── output ──

    fn push(&mut self, line: String) {
        self.out.push(line);
        if self.out.len() > MAX_LINES {
            self.out.drain(..MAX_LINES / 6);
        }
        self.dirty = true;
    }

    fn push_text(&mut self, text: &str) {
        for l in text.split('\n') {
            self.push(sanitize(l.trim_end_matches('\r')));
        }
    }

    fn prompt_label(&self) -> String {
        match &self.session {
            Some(s) => format!("{}❯", s.name),
            None => "❯".to_string(),
        }
    }

    // ── jobs ──

    fn drain(&mut self) {
        while let Ok(msg) = self.rx.try_recv() {
            self.dirty = true;
            match msg {
                Msg::Line(l) => {
                    self.progress_active = false;
                    self.push(sanitize(&l));
                }
                Msg::Progress(l) => {
                    let l = sanitize(&l);
                    if self.progress_active {
                        if let Some(last) = self.out.last_mut() { *last = l; }
                    } else {
                        self.push(l);
                        self.progress_active = true;
                    }
                }
                Msg::Settle => self.progress_active = false,
                Msg::Eof => {
                    if let Some(j) = self.job.as_mut() { j.eofs += 1; }
                }
                Msg::Info { root, info } => {
                    if let Some(s) = self.session.as_mut() {
                        if s.root == root { s.git = Some(info); }
                    }
                }
            }
        }
        let mut finished = None;
        if let Some(j) = self.job.as_mut() {
            if j.exited.is_none() {
                if let Ok(Some(st)) = j.child.try_wait() {
                    j.exited = Some((st.code().unwrap_or(-1), Instant::now()));
                }
            }
            if let Some((code, at)) = j.exited {
                // Pipes can stay open if the command left a background process
                // behind — don't wait on them forever.
                if j.eofs >= 2 || at.elapsed() > Duration::from_millis(1500) {
                    finished = Some((code, j.started.elapsed(), j.stopped));
                }
            }
        }
        if let Some((code, took, stopped)) = finished {
            self.job = None;
            self.progress_active = false;
            let secs = format!("{:.1}s", took.as_secs_f32());
            if stopped {
                self.push(dim(&format!("■ stopped after {secs}")));
            } else if code == 0 {
                self.push(dim(&format!("✓ done in {secs}")));
            } else {
                self.push(red(&format!("✗ exited with code {code}")) + &dim(&format!(" · {secs}")));
            }
            self.push(String::new());
            self.after_command();
        }
    }

    fn after_command(&mut self) {
        self.dash_dirty = true;
        if let Some(s) = &self.session {
            fetch_git(s.root.clone(), self.tx.clone());
        }
    }

    fn start_job(&mut self, label: &str, command: &str, cwd: &Path) {
        if self.job.is_some() {
            self.push(format!("{} Something is still running — Ctrl+C stops it.", red("✗")));
            return;
        }
        let mut cmd = shell(command, cwd);
        cmd.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped()).env("GIT_TERMINAL_PROMPT", "0");
        no_window(&mut cmd);
        match cmd.spawn() {
            Ok(mut child) => {
                if let Some(o) = child.stdout.take() { pump(o, self.tx.clone()); }
                if let Some(e) = child.stderr.take() { pump(e, self.tx.clone()); }
                self.push(dim(&format!("▶ {label}")));
                self.job = Some(Job { child, label: label.to_string(), started: Instant::now(), eofs: 0, exited: None, stopped: false });
            }
            Err(e) => self.push(format!("{} couldn't start: {e}", red("✗"))),
        }
    }

    fn kill_job(&mut self) {
        if let Some(j) = self.job.as_mut() {
            j.stopped = true;
            kill_tree(j.child.id());
            let _ = j.child.kill();
        }
    }

    /// Give the real terminal to a child process (editors, REPLs, Claude Code).
    fn suspend_run(&mut self, label: &str, command: &str, cwd: &Path, out: &mut Stdout) -> io::Result<()> {
        let _ = execute!(out, Show, DisableBracketedPaste, LeaveAlternateScreen);
        terminal::disable_raw_mode()?;
        let code = spawn_child(label, command, cwd);
        if code != 0 {
            println!("{}", dim("Press Enter to return to Croco…"));
            let mut s = String::new();
            let _ = io::stdin().read_line(&mut s);
        }
        terminal::enable_raw_mode()?;
        execute!(out, EnterAlternateScreen, EnableBracketedPaste, Hide, Clear(ClearType::All))?;
        self.prev.clear();
        self.dirty = true;
        self.after_command();
        Ok(())
    }

    // ── commands ──

    fn go_home(&mut self) {
        self.ctx.set_current(None);
        if self.session.take().is_some() {
            self.push(dim("⌂ back home"));
            self.push(String::new());
        }
        self.dash_dirty = true;
    }

    fn enter_session(&mut self) {
        let Some(p) = self.ctx.current_project() else { return };
        let Some(root) = commands::root_of(&p) else { return };
        let name = p["name"].as_str().unwrap_or("project").to_string();
        let commands_list = ["dev", "build", "test", "start"]
            .iter()
            .filter_map(|k| p["commands"][k].as_str().filter(|c| !c.is_empty()).map(|c| (k.to_string(), c.to_string())))
            .collect();
        self.push(format!("{} {}", accent("▸"), bold(&format!("{name} — command prompt"))));
        self.push(dim(&format!("  {}", root.display())));
        self.push(dim("  Type any shell command here. `home` or `exit` goes back."));
        self.push(dim("  `cmd <project>` switches project · `/todos`, `/add …`, `/git …` still work."));
        self.push(String::new());
        self.session = Some(Session {
            name,
            cwd: root.clone(),
            github: p["github"].as_str().unwrap_or("").to_string(),
            commands: commands_list,
            root: root.clone(),
            git: None,
        });
        fetch_git(root, self.tx.clone());
        self.dash_dirty = true;
    }

    fn run_croco(&mut self, line: &str) {
        match commands::run(self.ctx, line) {
            Outcome::Out(text) => {
                if !text.is_empty() { self.push_text(&text); }
                self.push(String::new());
            }
            Outcome::Clear => { self.out.clear(); self.scroll = 0; }
            Outcome::Exit => {
                if self.session.is_some() { self.go_home(); } else { self.quit = true; }
            }
            Outcome::Home => self.go_home(),
            Outcome::Shell => {
                self.session = None;
                self.enter_session();
            }
            Outcome::Job { label, command, cwd } => self.start_job(&label, &command, &cwd),
            Outcome::Spawn { label, command, cwd } => self.pending_spawn = Some((label, command, cwd)),
        }
        self.dash_dirty = true;
    }
}
