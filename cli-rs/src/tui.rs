//! The interactive prompt: a boxed input line with live slash-command
//! suggestions underneath, in the spirit of Claude Code's own terminal UI.
//! Output is plain scrollback above the box — nothing takes over the screen —
//! so it behaves in any terminal, over SSH, and keeps history after exit.

use crate::commands::{self, Cmd, Ctx, Outcome, COMMANDS};
use crate::ui::*;
use crossterm::{
    cursor::{MoveTo, MoveToColumn, MoveUp},
    event::{self, Event, KeyCode, KeyEventKind, KeyModifiers},
    queue,
    style::Print,
    terminal::{self, Clear, ClearType},
};
use std::io::{self, Stdout, Write};
use std::process::Command;

const MAX_SUGGESTIONS: usize = 8;

struct Prompt {
    buf: Vec<char>,
    cur: usize,
    history: Vec<String>,
    hist_pos: Option<usize>,
    sel: usize,
    exit_armed: bool,
    /// Rows between the top of the drawn input block and the cursor row,
    /// or None if nothing is currently drawn.
    drawn_cursor_row: Option<u16>,
}

impl Prompt {
    fn text(&self) -> String { self.buf.iter().collect() }

    fn set(&mut self, s: &str) {
        self.buf = s.chars().collect();
        self.cur = self.buf.len();
        self.sel = 0;
    }

    /// Commands matching what's typed after the slash (only while still on
    /// the command word itself).
    fn suggestions(&self) -> Vec<&'static Cmd> {
        let t = self.text();
        let Some(rest) = t.strip_prefix('/') else { return vec![] };
        if rest.contains(char::is_whitespace) { return vec![]; }
        let want = rest.to_lowercase();
        let mut hits: Vec<&'static Cmd> = COMMANDS.iter().filter(|c| c.name.starts_with(&want)).collect();
        // An exact name (`/note` vs `/notes`) always ranks first.
        hits.sort_by_key(|c| c.name != want);
        hits.truncate(MAX_SUGGESTIONS);
        hits
    }

    /// While typing arguments, the usage line for the command being typed.
    fn usage_hint(&self) -> Option<String> {
        let t = self.text();
        let rest = t.strip_prefix('/')?;
        let (name, _) = rest.split_once(char::is_whitespace)?;
        let c = COMMANDS.iter().find(|c| c.name == name.to_lowercase())?;
        Some(format!("/{} {}", c.name, c.args))
    }
}

fn width() -> usize { terminal::size().map(|(w, _)| w as usize).unwrap_or(80).max(24) }

/// Raw mode turns off the terminal's own "\n" → "\r\n" translation.
fn emit(out: &mut Stdout, text: &str) -> io::Result<()> {
    queue!(out, Print(text.replace('\n', "\r\n")), Print("\r\n"))
}

fn banner(out: &mut Stdout, ctx: &Ctx) -> io::Result<()> {
    let w = width().min(66);
    let inner = w - 2;
    let line = |content: String| format!("{}{}{}", accent("│"), pad(&content, inner), accent("│"));
    let cwd = std::env::current_dir().map(|p| p.display().to_string()).unwrap_or_default();
    emit(out, &format!("{}{}{}", accent("╭"), accent(&"─".repeat(inner)), accent("╮")))?;
    emit(out, &line(format!(" {} {}", accent("✻"), bold(&format!("Welcome to Croco {}", dim(&format!("v{}", env!("CARGO_PKG_VERSION"))))))))?;
    emit(out, &line(String::new()))?;
    emit(out, &line(format!("   {}", dim("/help for commands · Tab to complete · Ctrl+C to exit"))))?;
    emit(out, &line(format!("   {}", dim(&format!("cwd: {}", truncate(&cwd, inner.saturating_sub(10)))))))?;
    emit(out, &format!("{}{}{}", accent("╰"), accent(&"─".repeat(inner)), accent("╯")))?;
    emit(out, "")?;
    emit(out, &format!(" {}", dim(&commands::summary(ctx))))?;
    emit(out, "")?;
    emit(out, &format!(" {}", bold("Tips for getting started:")))?;
    emit(out, &format!("  {} {} to see what's open, {} to capture one", dim("1."), accent("/todos"), accent("/add <title>")))?;
    emit(out, &format!("  {} {} starts Claude Code inside that project's folder", dim("2."), accent("/code <project>")))?;
    emit(out, &format!("  {} {} shows your completion rate by day, week and month", dim("3."), accent("/stats")))?;
    emit(out, "")
}

fn render(out: &mut Stdout, p: &mut Prompt) -> io::Result<()> {
    let w = width();
    queue!(out, MoveToColumn(0))?;
    if let Some(row) = p.drawn_cursor_row {
        if row > 0 { queue!(out, MoveUp(row))?; }
    }
    queue!(out, Clear(ClearType::FromCursorDown))?;

    let inner = w.saturating_sub(2);
    let room = inner.saturating_sub(4); // "│ ❯ " + trailing space
    let text = p.text();
    // Keep the cursor visible: show the window of the buffer that ends at it.
    let start = p.cur.saturating_sub(room.saturating_sub(1));
    let shown: String = p.buf.iter().skip(start).take(room).collect();
    let col = 4 + (p.cur - start);

    let mut lines = vec![
        format!("{}{}{}", accent("╭"), accent(&"─".repeat(inner)), accent("╮")),
        format!("{} {} {}{}", accent("│"), accent("❯"), pad(&shown, room + 1), accent("│")),
        format!("{}{}{}", accent("╰"), accent(&"─".repeat(inner)), accent("╯")),
    ];

    let sugg = p.suggestions();
    if !sugg.is_empty() {
        if p.sel >= sugg.len() { p.sel = 0; }
        let name_w = sugg.iter().map(|c| c.name.len()).max().unwrap_or(0) + 2;
        for (i, c) in sugg.iter().enumerate() {
            let name = format!("/{}", c.name);
            let row = format!("  {} {}", pad(&name, name_w), c.desc);
            let row = truncate_visible(&row, w.saturating_sub(1));
            lines.push(if i == p.sel { accent(&row) } else { dim(&row) });
        }
    } else if let Some(hint) = p.usage_hint() {
        lines.push(dim(&truncate_visible(&format!("  {hint}"), w.saturating_sub(1))));
    } else if p.exit_armed {
        lines.push(dim("  Press Ctrl+C again to exit"));
    } else if text.is_empty() {
        lines.push(dim("  / for commands"));
    }

    let count = lines.len() as u16;
    for (i, l) in lines.iter().enumerate() {
        queue!(out, Print(l))?;
        if i + 1 < lines.len() { queue!(out, Print("\r\n"))?; }
    }
    // Back up to the input row, column just after the typed text.
    queue!(out, MoveUp(count - 2), MoveToColumn(col as u16))?;
    p.drawn_cursor_row = Some(1);
    out.flush()
}

fn truncate_visible(s: &str, max: usize) -> String { truncate(s, max) }

/// Erase the drawn input block so output can be printed in its place.
fn erase(out: &mut Stdout, p: &mut Prompt) -> io::Result<()> {
    queue!(out, MoveToColumn(0))?;
    if let Some(row) = p.drawn_cursor_row.take() {
        if row > 0 { queue!(out, MoveUp(row))?; }
    }
    queue!(out, Clear(ClearType::FromCursorDown))
}

/// Run a child process with the real terminal, then come back to the prompt.
fn spawn_child(label: &str, command: &str, cwd: &std::path::Path) -> i32 {
    println!("{} {}", accent("▶"), label);
    println!("{}", dim(&format!("  {}", cwd.display())));
    let status = shell(command, cwd).status();
    match status {
        Ok(s) => s.code().unwrap_or(0),
        Err(e) => {
            println!("{} couldn't start: {e}", red("✗"));
            1
        }
    }
}

#[cfg(windows)]
fn shell(command: &str, cwd: &std::path::Path) -> Command {
    use std::os::windows::process::CommandExt;
    let mut c = Command::new("cmd");
    c.arg("/C").raw_arg(command).current_dir(cwd);
    c
}

#[cfg(not(windows))]
fn shell(command: &str, cwd: &std::path::Path) -> Command {
    let mut c = Command::new("sh");
    c.arg("-c").arg(command).current_dir(cwd);
    c
}

pub fn run_spawn(label: &str, command: &str, cwd: &std::path::Path) -> i32 { spawn_child(label, command, cwd) }

pub fn run(ctx: &Ctx) -> io::Result<()> {
    let mut out = io::stdout();
    terminal::enable_raw_mode()?;
    let result = event_loop(&mut out, ctx);
    terminal::disable_raw_mode().ok();
    println!();
    result
}

fn event_loop(out: &mut Stdout, ctx: &Ctx) -> io::Result<()> {
    banner(out, ctx)?;
    let mut p = Prompt { buf: vec![], cur: 0, history: vec![], hist_pos: None, sel: 0, exit_armed: false, drawn_cursor_row: None };
    render(out, &mut p)?;

    loop {
        let ev = event::read()?;
        let key = match ev {
            Event::Key(k) if k.kind != KeyEventKind::Release => k,
            Event::Resize(..) => {
                // Re-wrap from the current cursor row; drawn state stays valid.
                render(out, &mut p)?;
                continue;
            }
            _ => continue,
        };
        let ctrl = key.modifiers.contains(KeyModifiers::CONTROL);
        let sugg = p.suggestions();
        let had_armed = p.exit_armed;
        p.exit_armed = false;

        match (key.code, ctrl) {
            (KeyCode::Char('c'), true) => {
                if !p.buf.is_empty() {
                    p.set("");
                } else if had_armed {
                    erase(out, &mut p)?;
                    out.flush()?;
                    return Ok(());
                } else {
                    p.exit_armed = true;
                }
            }
            (KeyCode::Char('d'), true) if p.buf.is_empty() => {
                erase(out, &mut p)?;
                out.flush()?;
                return Ok(());
            }
            (KeyCode::Char('l'), true) => {
                queue!(out, Clear(ClearType::All), MoveTo(0, 0))?;
                p.drawn_cursor_row = None;
                banner(out, ctx)?;
            }
            (KeyCode::Char('u'), true) => p.set(""),
            (KeyCode::Char('a'), true) => p.cur = 0,
            (KeyCode::Char('e'), true) => p.cur = p.buf.len(),
            (KeyCode::Char('w'), true) => {
                let mut i = p.cur;
                while i > 0 && p.buf[i - 1] == ' ' { i -= 1; }
                while i > 0 && p.buf[i - 1] != ' ' { i -= 1; }
                p.buf.drain(i..p.cur);
                p.cur = i;
            }
            (KeyCode::Char(c), _) if !ctrl || key.modifiers.contains(KeyModifiers::ALT) => {
                p.buf.insert(p.cur, c);
                p.cur += 1;
                p.sel = 0;
                p.hist_pos = None;
            }
            (KeyCode::Backspace, _) => {
                if p.cur > 0 {
                    p.buf.remove(p.cur - 1);
                    p.cur -= 1;
                    p.sel = 0;
                }
            }
            (KeyCode::Delete, _) => {
                if p.cur < p.buf.len() { p.buf.remove(p.cur); p.sel = 0; }
            }
            (KeyCode::Left, _) => p.cur = p.cur.saturating_sub(1),
            (KeyCode::Right, _) => p.cur = (p.cur + 1).min(p.buf.len()),
            (KeyCode::Home, _) => p.cur = 0,
            (KeyCode::End, _) => p.cur = p.buf.len(),
            (KeyCode::Esc, _) => p.set(""),
            (KeyCode::Up, _) => {
                if !sugg.is_empty() {
                    p.sel = if p.sel == 0 { sugg.len() - 1 } else { p.sel - 1 };
                } else if !p.history.is_empty() {
                    let pos = p.hist_pos.map_or(p.history.len() - 1, |i| i.saturating_sub(1));
                    p.hist_pos = Some(pos);
                    let h = p.history[pos].clone();
                    p.set(&h);
                }
            }
            (KeyCode::Down, _) => {
                if !sugg.is_empty() {
                    p.sel = (p.sel + 1) % sugg.len();
                } else if let Some(pos) = p.hist_pos {
                    if pos + 1 < p.history.len() {
                        p.hist_pos = Some(pos + 1);
                        let h = p.history[pos + 1].clone();
                        p.set(&h);
                    } else {
                        p.hist_pos = None;
                        p.set("");
                    }
                }
            }
            (KeyCode::Tab, _) => {
                if let Some(c) = sugg.get(p.sel) {
                    p.set(&format!("/{} ", c.name));
                }
            }
            (KeyCode::Enter, _) => {
                let mut line = p.text();
                // Enter on a half-typed command completes it first; commands
                // that need arguments wait for them instead of running bare.
                if let Some(c) = sugg.get(p.sel) {
                    let typed = line.trim_start_matches('/').to_lowercase();
                    if typed != c.name {
                        if c.args.is_empty() || c.args.starts_with('[') {
                            line = format!("/{}", c.name);
                        } else {
                            p.set(&format!("/{} ", c.name));
                            render(out, &mut p)?;
                            continue;
                        }
                    }
                }
                if line.trim().is_empty() {
                    p.set("");
                    render(out, &mut p)?;
                    continue;
                }
                erase(out, &mut p)?;
                emit(out, &format!("{} {}", accent("❯"), line))?;
                if p.history.last().map(|h| h != &line).unwrap_or(true) { p.history.push(line.clone()); }
                p.hist_pos = None;
                p.set("");

                match commands::run(ctx, &line) {
                    Outcome::Exit => { out.flush()?; return Ok(()); }
                    Outcome::Clear => {
                        queue!(out, Clear(ClearType::All), MoveTo(0, 0))?;
                        banner(out, ctx)?;
                    }
                    Outcome::Out(text) => {
                        if !text.is_empty() { emit(out, &text)?; }
                        emit(out, "")?;
                    }
                    Outcome::Spawn { label, command, cwd } => {
                        out.flush()?;
                        terminal::disable_raw_mode()?;
                        spawn_child(&label, &command, &cwd);
                        terminal::enable_raw_mode()?;
                        emit(out, "")?;
                    }
                }
            }
            _ => {}
        }
        render(out, &mut p)?;
    }
}
