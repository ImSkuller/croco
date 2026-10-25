//! `croco` — Croco in your terminal.
//!
//!   croco                 interactive prompt (Claude Code-style)
//!   croco <command> ...   run one command and exit (todos, add, stats, …)
//!
//! Reads and writes the same data as the desktop app; see `store.rs`.

mod commands;
mod logo;
mod store;
mod tui;
mod ui;

use commands::{Ctx, Outcome};
use std::io::IsTerminal;

#[cfg(windows)]
fn ansi_ok() -> bool {
    crossterm::ansi_support::supports_ansi()
}

#[cfg(not(windows))]
fn ansi_ok() -> bool {
    true
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();

    let want_color = std::env::var_os("NO_COLOR").is_none() && std::io::stdout().is_terminal();
    // On Windows this also switches the console into VT mode where needed.
    ui::set_color(want_color && ansi_ok());

    let ctx = Ctx::new(store::Store::open());
    ui::init_theme(&ctx.store.settings());
    let interactive = std::io::stdin().is_terminal() && std::io::stdout().is_terminal();

    if args.is_empty() {
        if interactive {
            if let Err(e) = tui::run(&ctx, None) {
                eprintln!("croco: {e}");
                std::process::exit(1);
            }
        } else {
            println!("croco {} — {}", env!("CARGO_PKG_VERSION"), commands::summary(&ctx));
            println!("Run `croco help` for commands.");
        }
        return;
    }

    // `croco cmd <project>` jumps straight into that project's prompt.
    if args[0] == "cmd" && args.len() > 1 && interactive {
        if let Err(e) = tui::run(&ctx, Some(&args[1..].join(" "))) {
            eprintln!("croco: {e}");
            std::process::exit(1);
        }
        return;
    }

    let line = match args[0].as_str() {
        "-h" | "--help" => "help".to_string(),
        "-V" | "--version" => "version".to_string(),
        _ => args.join(" "),
    };
    match commands::run(&ctx, &line) {
        Outcome::Out(text) => {
            if !text.is_empty() { println!("{text}"); }
            // Errors are printed with a leading ✗ — surface that to scripts.
            if ui::visible_start(&text) == Some('✗') { std::process::exit(1); }
        }
        Outcome::Clear | Outcome::Exit | Outcome::Home => {}
        Outcome::Shell => {
            eprintln!("{} `croco cmd <project>` needs an interactive terminal.", ui::red("✗"));
            std::process::exit(1);
        }
        // One-shot use has no screen to stream into — run it directly.
        Outcome::Job { label, command, cwd } | Outcome::Spawn { label, command, cwd } => {
            std::process::exit(tui::run_spawn(&label, &command, &cwd));
        }
    }
}
