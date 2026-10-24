//! Tiny ANSI styling layer. No dependency: colours are plain escape codes and
//! switch off for NO_COLOR or when stdout isn't a terminal.

use chrono::{DateTime, Local, NaiveDate, Utc};
use std::sync::atomic::{AtomicBool, Ordering};

static COLOR: AtomicBool = AtomicBool::new(true);

pub fn set_color(on: bool) {
    COLOR.store(on, Ordering::Relaxed);
}

fn paint(code: &str, s: &str) -> String {
    if COLOR.load(Ordering::Relaxed) {
        format!("\x1b[{code}m{s}\x1b[0m")
    } else {
        s.to_string()
    }
}

pub fn accent(s: &str) -> String { paint("38;2;255;107;53", s) }
pub fn bold(s: &str) -> String { paint("1", s) }
pub fn dim(s: &str) -> String { paint("2", s) }
pub fn green(s: &str) -> String { paint("32", s) }
pub fn red(s: &str) -> String { paint("31", s) }
pub fn yellow(s: &str) -> String { paint("33", s) }
pub fn blue(s: &str) -> String { paint("34", s) }

/// Display width ignoring ANSI escapes (characters, not bytes).
pub fn visible_len(s: &str) -> usize {
    let mut n = 0;
    let mut in_esc = false;
    for c in s.chars() {
        if in_esc {
            if c.is_ascii_alphabetic() { in_esc = false; }
        } else if c == '\x1b' {
            in_esc = true;
        } else {
            n += 1;
        }
    }
    n
}

pub fn pad(s: &str, width: usize) -> String {
    let len = visible_len(s);
    if len >= width { s.to_string() } else { format!("{s}{}", " ".repeat(width - len)) }
}

/// Truncate plain text to `max` chars, adding an ellipsis.
pub fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max { return s.to_string(); }
    let mut out: String = s.chars().take(max.saturating_sub(1)).collect();
    out.push('…');
    out
}

pub fn bar(pct: u32, width: usize) -> String {
    let filled = ((pct as usize * width) + 50) / 100;
    let filled = filled.min(width);
    format!("{}{}", accent(&"█".repeat(filled)), dim(&"░".repeat(width - filled)))
}

pub fn priority_tag(p: &str) -> String {
    match p {
        "high" => red("high"),
        "low" => blue("low "),
        "med" => yellow("med "),
        other => dim(&truncate(other, 4)),
    }
}

pub fn rel_time(iso: &str) -> String {
    let Ok(t) = DateTime::parse_from_rfc3339(iso) else { return "never".into() };
    let secs = (Utc::now() - t.with_timezone(&Utc)).num_seconds();
    match secs {
        s if s < 0 => "just now".into(),
        s if s < 60 => "just now".into(),
        s if s < 3600 => format!("{}m ago", s / 60),
        s if s < 86_400 => format!("{}h ago", s / 3600),
        s if s < 86_400 * 30 => format!("{}d ago", s / 86_400),
        s if s < 86_400 * 365 => format!("{}mo ago", s / (86_400 * 30)),
        s => format!("{}y ago", s / (86_400 * 365)),
    }
}

/// "today", "tomorrow", "in 3d", "overdue 2d" for a YYYY-MM-DD due date.
pub fn due_label(date: &str) -> Option<(String, bool)> {
    let d = NaiveDate::parse_from_str(date.get(..10)?, "%Y-%m-%d").ok()?;
    let diff = (d - Local::now().date_naive()).num_days();
    Some(match diff {
        0 => ("today".to_string(), false),
        1 => ("tomorrow".to_string(), false),
        n if n > 1 => (format!("in {n}d"), false),
        n => (format!("overdue {}d", -n), true),
    })
}

/// First visible character of `s`, skipping ANSI escapes.
pub fn visible_start(s: &str) -> Option<char> {
    let mut in_esc = false;
    for c in s.chars() {
        if in_esc {
            if c.is_ascii_alphabetic() { in_esc = false; }
        } else if c == '\x1b' {
            in_esc = true;
        } else {
            return Some(c);
        }
    }
    None
}
