//! Keyboard handling, command dispatch and the project prompt.

use super::*;

impl<'a> App<'a> {
    /// Commands matching what is being typed (exact match first). Inside a
    /// project prompt only a leading `/` asks for croco commands, so ordinary
    /// shell words aren't hijacked.
    pub(super) fn suggestions(&self) -> Vec<&'static Cmd> {
        let t = self.p.text();
        let slash = t.starts_with('/');
        if self.session.is_some() && !slash { return vec![]; }
        let rest = t.trim_start_matches('/').to_lowercase();
        if rest.is_empty() && !slash { return vec![]; }
        if rest.contains(char::is_whitespace) { return vec![]; }
        let mut hits: Vec<&'static Cmd> = COMMANDS.iter().filter(|c| c.name.starts_with(&rest)).collect();
        hits.sort_by_key(|c| c.name != rest);
        hits.truncate(MAX_SUGGESTIONS);
        hits
    }

    /// While typing arguments, the usage line of the command being typed.
    pub(super) fn usage_hint(&self) -> Option<String> {
        let t = self.p.text();
        let slash = t.starts_with('/');
        if self.session.is_some() && !slash { return None; }
        let rest = t.trim_start_matches('/');
        let (name, _) = rest.split_once(char::is_whitespace)?;
        let c = COMMANDS.iter().find(|c| c.name == name.to_lowercase())?;
        Some(format!("{} {}", c.name, c.args))
    }

    pub(super) fn handle(&mut self, ev: Event) -> io::Result<()> {
        self.dirty = true;
        match ev {
            Event::Resize(..) => { self.prev.clear(); }
            Event::Paste(text) => {
                for c in text.chars() {
                    let c = if c == '\n' || c == '\r' || c == '\t' { ' ' } else { c };
                    self.p.buf.insert(self.p.cur, c);
                    self.p.cur += 1;
                }
                self.p.sel = 0;
                self.scroll = 0;
            }
            Event::Key(key) if key.kind != KeyEventKind::Release => self.handle_key(key.code, key.modifiers),
            _ => {}
        }
        Ok(())
    }

    fn handle_key(&mut self, code: KeyCode, mods: KeyModifiers) {
        let ctrl = mods.contains(KeyModifiers::CONTROL);
        let alt = mods.contains(KeyModifiers::ALT);
        let sugg = self.suggestions();
        let was_armed = self.quit_armed;
        self.quit_armed = false;
        let page = 8usize;

        match (code, ctrl) {
            (KeyCode::Char('c'), true) => {
                if self.job.is_some() {
                    self.kill_job();
                    self.push(dim("^C"));
                } else if !self.p.buf.is_empty() {
                    self.p.set("");
                } else if was_armed {
                    self.quit = true;
                } else {
                    self.quit_armed = true;
                }
            }
            (KeyCode::Char('d'), true) if self.p.buf.is_empty() => {
                if self.session.is_some() { self.go_home(); } else { self.quit = true; }
            }
            (KeyCode::Char('l'), true) => { self.out.clear(); self.scroll = 0; self.prev.clear(); }
            (KeyCode::Char('u'), true) => self.p.set(""),
            (KeyCode::Char('a'), true) => self.p.cur = 0,
            (KeyCode::Char('e'), true) => self.p.cur = self.p.buf.len(),
            (KeyCode::Char('w'), true) => {
                let mut i = self.p.cur;
                while i > 0 && self.p.buf[i - 1] == ' ' { i -= 1; }
                while i > 0 && self.p.buf[i - 1] != ' ' { i -= 1; }
                self.p.buf.drain(i..self.p.cur);
                self.p.cur = i;
            }
            (KeyCode::Char(c), _) if !ctrl || alt => {
                self.p.buf.insert(self.p.cur, c);
                self.p.cur += 1;
                self.p.sel = 0;
                self.p.hist_pos = None;
                self.scroll = 0;
            }
            (KeyCode::Backspace, _) => {
                if self.p.cur > 0 {
                    self.p.buf.remove(self.p.cur - 1);
                    self.p.cur -= 1;
                    self.p.sel = 0;
                }
            }
            (KeyCode::Delete, _) => {
                if self.p.cur < self.p.buf.len() { self.p.buf.remove(self.p.cur); self.p.sel = 0; }
            }
            (KeyCode::Left, _) => self.p.cur = self.p.cur.saturating_sub(1),
            (KeyCode::Right, _) => self.p.cur = (self.p.cur + 1).min(self.p.buf.len()),
            (KeyCode::Home, _) => self.p.cur = 0,
            (KeyCode::End, _) => self.p.cur = self.p.buf.len(),
            (KeyCode::PageUp, _) => self.scroll = self.scroll.saturating_add(page),
            (KeyCode::PageDown, _) => self.scroll = self.scroll.saturating_sub(page),
            (KeyCode::Esc, _) => { self.p.set(""); self.scroll = 0; }
            (KeyCode::Up, _) => {
                if !sugg.is_empty() {
                    self.p.sel = if self.p.sel == 0 { sugg.len() - 1 } else { self.p.sel - 1 };
                } else if !self.p.history.is_empty() {
                    let pos = self.p.hist_pos.map_or(self.p.history.len() - 1, |i| i.saturating_sub(1));
                    self.p.hist_pos = Some(pos);
                    let h = self.p.history[pos].clone();
                    self.p.set(&h);
                }
            }
            (KeyCode::Down, _) => {
                if !sugg.is_empty() {
                    self.p.sel = (self.p.sel + 1) % sugg.len();
                } else if let Some(pos) = self.p.hist_pos {
                    if pos + 1 < self.p.history.len() {
                        self.p.hist_pos = Some(pos + 1);
                        let h = self.p.history[pos + 1].clone();
                        self.p.set(&h);
                    } else {
                        self.p.hist_pos = None;
                        self.p.set("");
                    }
                }
            }
            (KeyCode::Tab, _) => {
                if let Some(c) = sugg.get(self.p.sel) {
                    let slash = if self.p.text().starts_with('/') { "/" } else { "" };
                    self.p.set(&format!("{slash}{} ", c.name));
                }
            }
            (KeyCode::Enter, _) => {
                let mut line = self.p.text();
                // Enter on a half-typed command completes it first; commands
                // that need arguments wait for them instead of running bare.
                if let Some(c) = sugg.get(self.p.sel) {
                    let typed = line.trim_start_matches('/').to_lowercase();
                    if typed != c.name {
                        let slash = if line.starts_with('/') { "/" } else { "" };
                        if c.args.is_empty() || c.args.starts_with('[') {
                            line = format!("{slash}{}", c.name);
                        } else {
                            self.p.set(&format!("{slash}{} ", c.name));
                            return;
                        }
                    }
                }
                if line.trim().is_empty() {
                    self.p.set("");
                    return;
                }
                self.submit(line);
            }
            _ => {}
        }
    }

    fn submit(&mut self, line: String) {
        let line = line.trim().to_string();
        self.scroll = 0;
        self.progress_active = false;
        let echo = format!("{} {}", accent(&self.prompt_label()), line);
        self.push(echo);
        if self.p.history.last() != Some(&line) { self.p.history.push(line.clone()); }
        self.p.hist_pos = None;
        self.p.set("");

        if self.session.is_some() {
            self.run_in_session(&line);
        } else {
            self.run_croco(&line);
        }
    }

    /// A line typed at the project prompt: croco's own navigation words and
    /// `/commands` are handled here, everything else is a shell command that
    /// runs in the project's current directory.
    fn run_in_session(&mut self, line: &str) {
        if line.starts_with('/') {
            return self.run_croco(line);
        }
        let (word, rest) = match line.split_once(char::is_whitespace) {
            Some((w, r)) => (w.to_lowercase(), r.trim().to_string()),
            None => (line.to_lowercase(), String::new()),
        };
        match word.as_str() {
            "home" | "exit" | "quit" => self.go_home(),
            "clear" | "cls" => { self.out.clear(); self.scroll = 0; }
            "cd" | "chdir" => self.cd(&rest),
            "cmd" if !rest.is_empty() => self.run_croco(line),
            "projects" => self.run_croco(line),
            _ => {
                let Some(cwd) = self.session.as_ref().map(|s| s.cwd.clone()) else { return };
                if is_interactive(line) {
                    self.pending_spawn = Some((line.to_string(), line.to_string(), cwd));
                } else {
                    self.start_job(line, line, &cwd);
                }
            }
        }
    }

    fn cd(&mut self, arg: &str) {
        let Some(sess) = self.session.as_mut() else { return };
        let mut a = arg.trim().trim_matches('"');
        if a.len() >= 2 && a[..2].eq_ignore_ascii_case("/d") {
            a = a[2..].trim().trim_matches('"');
        }
        if a.is_empty() {
            sess.cwd = sess.root.clone();
            return;
        }
        let p = PathBuf::from(a);
        let target = normalize(&if p.is_absolute() { p } else { sess.cwd.join(p) });
        if target.is_dir() {
            sess.cwd = target;
        } else {
            let msg = format!("{} no such directory: {a}", red("✗"));
            self.push(msg);
        }
    }

    /// Short "project/sub/dir" label for the prompt box.
    pub(super) fn session_path(&self) -> Option<String> {
        let s = self.session.as_ref()?;
        let rel = s.cwd.strip_prefix(&s.root).ok().map(|r| r.to_string_lossy().replace('\\', "/")).unwrap_or_else(|| s.cwd.display().to_string());
        Some(if rel.is_empty() { s.name.clone() } else { format!("{}/{}", s.name, rel) })
    }

    pub(super) fn git_chip(&self) -> Option<String> {
        let g = self.session.as_ref()?.git.as_ref()?;
        Some(if g.dirty == 0 { format!("⎇ {}", g.branch) } else { format!("⎇ {} ±{}", g.branch, g.dirty) })
    }
}


pub(super) fn todo_line(t: &DashTodo, width: usize) -> String {
    let tag = priority_tag(&t.priority);
    let due = t.due.as_ref().map(|(l, late)| if *late { red(l) } else { dim(l) }).unwrap_or_default();
    let due_w = visible_len(&due);
    let room = width.saturating_sub(7 + if due_w > 0 { due_w + 1 } else { 0 });
    let title = truncate(&t.title, room);
    if due_w > 0 {
        format!("{} {} {} {}", dim("○"), tag, pad(&title, room), due)
    } else {
        format!("{} {} {}", dim("○"), tag, title)
    }
}
