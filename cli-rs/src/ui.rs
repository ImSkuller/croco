//! Tiny ANSI styling layer. No styling dependency: colours are plain escape
//! codes, they switch off for NO_COLOR or when stdout isn't a terminal, and
//! the accent colour follows the desktop app's theme (see `Theme`).

use chrono::{DateTime, Local, NaiveDate, Timelike, Utc};
use serde_json::Value;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use unicode_width::UnicodeWidthChar;

static COLOR: AtomicBool = AtomicBool::new(true);
static ACCENT: AtomicU32 = AtomicU32::new(0x7FD98A);
static THEME_ID: AtomicU32 = AtomicU32::new(0);

pub fn set_color(on: bool) {
    COLOR.store(on, Ordering::Relaxed);
}

pub fn color_on() -> bool {
    COLOR.load(Ordering::Relaxed)
}

// ── theme ────────────────────────────────────────────────────────────────────

/// Light green that matches the logo (daytime on the default theme).
pub const DAY_GREEN: (u8, u8, u8) = (127, 217, 138);
/// Light blue, the colour of the Rio macaws (night time on the default theme).
pub const NIGHT_BLUE: (u8, u8, u8) = (124, 200, 255);

// 0 = default (follows the time of day), otherwise a fixed palette.
const THEMES: &[(&str, u32, (u8, u8, u8))] = &[
    ("theme-catppuccin-mocha", 1, (203, 166, 247)),
    ("theme-neovim", 2, (115, 218, 202)),
    ("theme-futuristic", 3, (0, 240, 255)),
];

pub fn init_theme(settings: &Value) {
    let id = settings["appearance"]["theme"].as_str().unwrap_or("default");
    let code = THEMES.iter().find(|t| t.0 == id).map(|t| t.1).unwrap_or(0);
    THEME_ID.store(code, Ordering::Relaxed);
    refresh_theme();
}

/// Re-evaluates the accent. Only the default theme changes over time: green
/// from 06:00 to 18:00, light blue otherwise.
pub fn refresh_theme() {
    let code = THEME_ID.load(Ordering::Relaxed);
    let (r, g, b) = match THEMES.iter().find(|t| t.1 == code) {
        Some(t) => t.2,
        None => {
            let h = Local::now().hour();
            if (6..18).contains(&h) { DAY_GREEN } else { NIGHT_BLUE }
        }
    };
    ACCENT.store(((r as u32) << 16) | ((g as u32) << 8) | b as u32, Ordering::Relaxed);
}

pub fn accent_rgb() -> (u8, u8, u8) {
    let v = ACCENT.load(Ordering::Relaxed);
    ((v >> 16) as u8, (v >> 8) as u8, v as u8)
}

// ── painting ─────────────────────────────────────────────────────────────────

fn paint(code: &str, s: &str) -> String {
    if color_on() {
        format!("\x1b[{code}m{s}\x1b[0m")
    } else {
        s.to_string()
    }
}

pub fn accent(s: &str) -> String {
    let (r, g, b) = accent_rgb();
    paint(&format!("38;2;{r};{g};{b}"), s)
}
/// Accent-coloured background with dark text — used for mode chips.
pub fn chip(s: &str) -> String {
    let (r, g, b) = accent_rgb();
    paint(&format!("48;2;{r};{g};{b};38;2;16;16;16;1"), s)
}
pub fn bold(s: &str) -> String { paint("1", s) }
pub fn dim(s: &str) -> String { paint("2", s) }
pub fn green(s: &str) -> String { paint("32", s) }
pub fn red(s: &str) -> String { paint("31", s) }
pub fn yellow(s: &str) -> String { paint("33", s) }
pub fn blue(s: &str) -> String { paint("34", s) }

// ── measuring ────────────────────────────────────────────────────────────────

fn skip_escape(chars: &mut std::iter::Peekable<std::str::Chars>) {
    // after ESC: CSI = '[' params final-byte(@-~); anything else: swallow one char
    match chars.peek() {
        Some('[') => {
            chars.next();
            for c in chars.by_ref() {
                if ('@'..='~').contains(&c) { break; }
            }
        }
        Some(_) => { chars.next(); }
        None => {}
    }
}

/// Display width ignoring ANSI escapes (double-width glyphs count as 2).
pub fn visible_len(s: &str) -> usize {
    let mut n = 0;
    let mut it = s.chars().peekable();
    while let Some(c) = it.next() {
        if c == '\x1b' {
            skip_escape(&mut it);
        } else {
            n += UnicodeWidthChar::width(c).unwrap_or(0);
        }
    }
    n
}

pub fn pad(s: &str, width: usize) -> String {
    let len = visible_len(s);
    if len >= width { s.to_string() } else { format!("{s}{}", " ".repeat(width - len)) }
}

/// Truncate plain text to `max` columns, adding an ellipsis.
pub fn truncate(s: &str, max: usize) -> String {
    if visible_len(s) <= max { return s.to_string(); }
    let mut out = String::new();
    let mut w = 0;
    for c in s.chars() {
        let cw = UnicodeWidthChar::width(c).unwrap_or(0);
        if w + cw + 1 > max { break; }
        out.push(c);
        w += cw;
    }
    out.push('…');
    out
}

/// Cut a styled string to `max` visible columns (escape codes are kept, a
/// reset is appended if the cut left a style open).
pub fn clip(s: &str, max: usize) -> String {
    if visible_len(s) <= max { return s.to_string(); }
    let mut out = String::new();
    let mut w = 0;
    let mut it = s.chars().peekable();
    while let Some(c) = it.next() {
        if c == '\x1b' {
            out.push(c);
            if let Some(&'[') = it.peek() {
                out.push(it.next().unwrap_or('['));
                for d in it.by_ref() {
                    out.push(d);
                    if ('@'..='~').contains(&d) { break; }
                }
            }
            continue;
        }
        let cw = UnicodeWidthChar::width(c).unwrap_or(0);
        if w + cw > max { break; }
        out.push(c);
        w += cw;
    }
    out.push_str("\x1b[0m");
    out
}

/// Hard-wrap a styled line to `width` columns. Styles active at a break are
/// re-applied on the continuation so colours survive wrapping.
pub fn wrap(s: &str, width: usize) -> Vec<String> {
    let width = width.max(1);
    if visible_len(s) <= width { return vec![s.to_string()]; }
    let mut rows = vec![];
    let mut cur = String::new();
    let mut w = 0;
    let mut active: Vec<String> = vec![];
    let mut it = s.chars().peekable();
    while let Some(c) = it.next() {
        if c == '\x1b' {
            let mut seq = String::from('\x1b');
            if let Some(&'[') = it.peek() {
                seq.push(it.next().unwrap_or('['));
                for d in it.by_ref() {
                    seq.push(d);
                    if ('@'..='~').contains(&d) { break; }
                }
            }
            if seq == "\x1b[0m" || seq == "\x1b[m" { active.clear(); } else { active.push(seq.clone()); }
            cur.push_str(&seq);
            continue;
        }
        let cw = UnicodeWidthChar::width(c).unwrap_or(0);
        if w + cw > width {
            if !active.is_empty() { cur.push_str("\x1b[0m"); }
            rows.push(std::mem::take(&mut cur));
            cur.push_str(&active.concat());
            w = 0;
        }
        cur.push(c);
        w += cw;
    }
    if !cur.is_empty() { rows.push(cur); }
    rows
}

pub fn bar(pct: u32, width: usize) -> String {
    let filled = (((pct as usize * width) + 50) / 100).min(width);
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
    let mut it = s.chars().peekable();
    while let Some(c) = it.next() {
        if c == '\x1b' {
            skip_escape(&mut it);
        } else {
            return Some(c);
        }
    }
    None
}

/// Make arbitrary child-process output safe to draw: keeps colour (SGR)
/// sequences, drops every other escape/control code, expands tabs.
pub fn sanitize(line: &str) -> String {
    let mut out = String::with_capacity(line.len());
    let mut it = line.chars().peekable();
    while let Some(c) = it.next() {
        match c {
            '\x1b' => {
                if let Some(&'[') = it.peek() {
                    it.next();
                    let mut seq = String::new();
                    let mut fin = None;
                    for d in it.by_ref() {
                        if ('@'..='~').contains(&d) { fin = Some(d); break; }
                        seq.push(d);
                    }
                    if fin == Some('m') && color_on() {
                        out.push_str("\x1b[");
                        out.push_str(&seq);
                        out.push('m');
                    }
                } else {
                    it.next(); // OSC and friends: drop the next char; the rest prints as text
                }
            }
            '\t' => out.push_str("    "),
            c if c.is_control() => {}
            c => out.push(c),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn fixed_themes_use_their_palette_and_default_follows_the_clock() {
        init_theme(&json!({ "appearance": { "theme": "theme-neovim" } }));
        assert_eq!(accent_rgb(), (115, 218, 202));
        init_theme(&json!({ "appearance": { "theme": "theme-futuristic" } }));
        assert_eq!(accent_rgb(), (0, 240, 255));
        init_theme(&json!({}));
        let c = accent_rgb();
        assert!(c == DAY_GREEN || c == NIGHT_BLUE);
        // unknown theme ids fall back to the default behaviour
        init_theme(&json!({ "appearance": { "theme": "retired-theme" } }));
        let c = accent_rgb();
        assert!(c == DAY_GREEN || c == NIGHT_BLUE);
    }

    #[test]
    fn visible_len_ignores_escapes_and_counts_wide_glyphs() {
        assert_eq!(visible_len("\x1b[31mred\x1b[0m"), 3);
        assert_eq!(visible_len("日本"), 4);
    }

    #[test]
    fn wrap_splits_to_width_and_keeps_colour_on_continuations() {
        let rows = wrap("\x1b[31mabcdefgh\x1b[0m", 3);
        assert_eq!(rows.len(), 3);
        assert!(rows.iter().all(|r| visible_len(r) <= 3));
        assert!(rows[1].starts_with("\x1b[31m"));
    }

    #[test]
    fn clip_never_exceeds_the_width() {
        assert!(visible_len(&clip("\x1b[1mhello world\x1b[0m", 5)) <= 5);
    }

    #[test]
    fn sanitize_drops_cursor_codes_but_keeps_colour() {
        set_color(true);
        assert_eq!(sanitize("a\x1b[2Kb\x1b[32mc"), "ab\x1b[32mc");
        assert_eq!(sanitize("x\ty"), "x    y");
    }
}
