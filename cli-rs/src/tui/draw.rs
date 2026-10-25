//! Frame construction and drawing. Every frame is rebuilt as a list of
//! screen rows and only rows that changed are written, so redraws are cheap
//! enough to run on every keystroke and every line of streamed output.

use super::events::todo_line;
use super::*;

fn margin(n: usize) -> String { " ".repeat(n) }

/// Lay several columns side by side, `gap` spaces apart.
fn columns(cols: &[Vec<String>], col_w: usize, gap: usize, rows: usize) -> Vec<String> {
    (0..rows)
        .map(|r| {
            cols.iter()
                .map(|c| pad(&clip(c.get(r).map(|s| s.as_str()).unwrap_or(""), col_w), col_w))
                .collect::<Vec<_>>()
                .join(&" ".repeat(gap))
        })
        .collect()
}

fn heading(text: &str) -> String { bold(&dim(&text.to_uppercase())) }

impl<'a> App<'a> {
    pub(super) fn draw(&mut self, out: &mut Stdout) -> io::Result<()> {
        let (w, h) = terminal::size().map(|(w, h)| (w as usize, h as usize)).unwrap_or((80, 24));
        let (frame, cursor) = self.build_frame(w, h);
        queue!(out, Hide)?;
        if self.prev.len() != frame.len() {
            queue!(out, Clear(ClearType::All))?;
            self.prev.clear();
        }
        for (i, row) in frame.iter().enumerate() {
            if self.prev.get(i) != Some(row) {
                queue!(out, MoveTo(0, i as u16), Print(row), Clear(ClearType::UntilNewLine))?;
            }
        }
        self.prev = frame;
        queue!(out, MoveTo(cursor.0 as u16, cursor.1 as u16), Show)?;
        out.flush()
    }

    fn build_frame(&mut self, w: usize, h: usize) -> (Vec<String>, (usize, usize)) {
        if w < 28 || h < 8 {
            let mut f = vec![String::new(); h];
            if h > 0 { f[h / 2] = format!("{}{}", margin(w.saturating_sub(16) / 2), dim("window too small")); }
            return (f, (0, 0));
        }
        let lay = layout(w, h);
        let mut frame: Vec<String> = vec![String::new(); h];
        let lm = margin(lay.left);

        // ── scrollback ──
        for (i, row) in self.output_rows(&lay).into_iter().enumerate() {
            frame[i] = format!("{lm}{row}");
        }

        // ── command bar ──
        let (box_rows, cursor_col) = self.input_box(&lay);
        for (i, row) in box_rows.into_iter().enumerate() {
            frame[lay.box_top + i] = format!("{lm}{row}");
        }

        // ── panels ──
        if lay.panel_h >= 4 {
            for (i, row) in self.panel_rows(&lay).into_iter().enumerate() {
                if lay.panel_top + i < h - 1 { frame[lay.panel_top + i] = format!("{lm}{row}"); }
            }
        }

        // ── suggestions: dropdown below the bar, or above it when there is no room ──
        let sugg = self.suggestions();
        if !sugg.is_empty() {
            let name_w = sugg.iter().map(|c| c.name.len()).max().unwrap_or(0) + 2;
            let rows: Vec<String> = sugg
                .iter()
                .enumerate()
                .map(|(i, c)| {
                    let body = format!("/{} {}", pad(c.name, name_w), c.desc);
                    let body = truncate(&body, lay.cw.saturating_sub(4));
                    if i == self.p.sel { format!(" {} {}", accent("▸"), accent(&bold(&body))) } else { format!("   {}", dim(&body)) }
                })
                .collect();
            let below = (h - 1).saturating_sub(lay.box_top + 3);
            if rows.len() <= below {
                for (i, r) in rows.into_iter().enumerate() { frame[lay.box_top + 3 + i] = format!("{lm}{r}"); }
            } else {
                let n = rows.len().min(lay.box_top);
                for (i, r) in rows.into_iter().take(n).enumerate() { frame[lay.box_top - n + i] = format!("{lm}{r}"); }
            }
        }

        // ── status bar ──
        frame[h - 1] = self.status_bar(w);

        let reset = if color_on() { "\x1b[0m" } else { "" };
        for row in frame.iter_mut() {
            let clipped = clip(row, w.saturating_sub(1));
            *row = format!("{clipped}{reset}");
        }
        (frame, (lay.left + cursor_col, lay.box_top + 1))
    }

    // ── scrollback ──

    fn output_rows(&mut self, lay: &Lay) -> Vec<String> {
        let out_h = lay.box_top;
        let need = out_h + self.scroll + 1;
        // Wrap from the newest line backwards, only as far as the screen needs.
        let mut rev: Vec<String> = vec![];
        let mut reached_start = true;
        for line in self.out.iter().rev() {
            let mut wrapped = wrap(line, lay.cw);
            wrapped.reverse();
            rev.extend(wrapped);
            if rev.len() >= need {
                reached_start = false;
                break;
            }
        }
        let mut rows: Vec<String> = vec![];
        if reached_start {
            rows = self.banner(lay, out_h);
            rows.push(String::new());
        }
        rev.reverse();
        rows.extend(rev);

        if rows.len() <= out_h {
            self.scroll = 0;
            return rows;
        }
        let max_scroll = rows.len() - out_h;
        self.scroll = self.scroll.min(max_scroll);
        let end = rows.len() - self.scroll;
        let mut view: Vec<String> = rows[end - out_h..end].to_vec();
        if self.scroll > 0 {
            let note = dim(&format!("↑ {} lines above · PgDn to return", max_scroll - self.scroll));
            if let Some(last) = view.last_mut() { *last = note; }
        }
        view
    }

    fn banner(&self, lay: &Lay, out_h: usize) -> Vec<String> {
        let ver = env!("CARGO_PKG_VERSION");
        let mut text = vec![
            format!("{} {}", bold(&accent("Croco")), dim(&format!("v{ver}"))),
            dim("Projects, todos and git — right from your terminal"),
            String::new(),
            format!("{} {}", dim(greeting()), dim(&format!("· {} projects · {} open todos", self.dash.project_count, self.dash.open_total))),
            dim(&format!("{} storage · {}", if self.ctx.store.sqlite { "sqlite" } else { "json" }, std::env::current_dir().map(|p| p.display().to_string()).unwrap_or_default())),
            String::new(),
            format!("{} commands · {} opens a project prompt · {} sets a todo", accent("/"), accent("cmd <#>"), accent("add")),
        ];
        let cols = if !color_on() { 0 } else if out_h >= 16 && lay.cw >= 64 { 26 } else if out_h >= 10 && lay.cw >= 44 { 16 } else { 0 };
        if cols == 0 {
            return text.into_iter().take(out_h.saturating_sub(1).max(2)).collect();
        }
        let art = logo::render(cols);
        let gap = "   ";
        let offset = art.len().saturating_sub(text.len()) / 2;
        text.truncate(art.len().max(1));
        let avail = lay.cw.saturating_sub(cols + gap.len());
        art.iter()
            .enumerate()
            .map(|(i, l)| {
                let t = if i >= offset { text.get(i - offset).cloned().unwrap_or_default() } else { String::new() };
                format!("{l}{gap}{}", clip(&t, avail))
            })
            .collect()
    }

    // ── command bar ──

    /// Returns the three rows of the bar and the cursor column inside them.
    fn input_box(&self, lay: &Lay) -> (Vec<String>, usize) {
        let inner = lay.cw.saturating_sub(2);
        let title = match self.session_path() {
            Some(p) => format!(" ▸ {p} "),
            None => " ⌂ home ".to_string(),
        };
        let title = truncate(&title, inner.saturating_sub(4));
        let top = format!(
            "{}{}{}{}",
            accent("╭─"),
            bold(&accent(&title)),
            accent(&"─".repeat(inner.saturating_sub(visible_len(&title) + 1))),
            accent("╮")
        );

        let room = inner.saturating_sub(4);
        let start = self.p.cur.saturating_sub(room.saturating_sub(1));
        let shown: String = self.p.buf.iter().skip(start).take(room).collect();
        let shown_w = visible_len(&shown);
        let before_cursor: String = self.p.buf[start..self.p.cur.min(self.p.buf.len())].iter().collect();
        let cursor_col = 4 + visible_len(&before_cursor);
        let mid = format!(
            "{} {} {}{}{}",
            accent("│"),
            accent(if self.session.is_some() { "›" } else { "❯" }),
            shown,
            " ".repeat((room + 1).saturating_sub(shown_w)),
            accent("│")
        );

        let hint = if let Some(u) = self.usage_hint() {
            format!(" {} ", truncate(&u, inner.saturating_sub(6)))
        } else if let Some(g) = self.git_chip() {
            format!(" {g} ")
        } else if self.p.buf.is_empty() {
            " type / for commands ".to_string()
        } else {
            String::new()
        };
        let hint = truncate(&hint, inner.saturating_sub(4));
        let bottom = format!(
            "{}{}{}{}",
            accent("╰─"),
            dim(&hint),
            accent(&"─".repeat(inner.saturating_sub(visible_len(&hint) + 1))),
            accent("╯")
        );
        (vec![top, mid, bottom], cursor_col)
    }

    // ── panels below the bar ──

    fn panel_rows(&self, lay: &Lay) -> Vec<String> {
        let rows = lay.panel_h.saturating_sub(1);
        let (label, cols): (String, Vec<Vec<String>>) = match &self.session {
            None => ("home".to_string(), self.home_columns(lay, rows)),
            Some(_) => ("project".to_string(), self.session_columns(lay, rows)),
        };
        let n = if lay.cw >= 96 { 3 } else if lay.cw >= 62 { 2 } else { 1 };
        let gap = 3;
        let col_w = (lay.cw.saturating_sub(gap * (n - 1))) / n;
        let shown: Vec<Vec<String>> = cols.into_iter().take(n).collect();
        let mut result = vec![format!(
            "{}{}{}",
            dim("─ "),
            accent(&label),
            dim(&format!(" {}", "─".repeat(lay.cw.saturating_sub(label.len() + 3))))
        )];
        result.extend(columns(&shown, col_w, gap, rows));
        result
    }

    fn home_columns(&self, lay: &Lay, rows: usize) -> Vec<Vec<String>> {
        let n = if lay.cw >= 96 { 3 } else if lay.cw >= 62 { 2 } else { 1 };
        let col_w = (lay.cw.saturating_sub(3 * (n - 1))) / n;
        let d = &self.dash;

        let mut todos = vec![format!("{}  {}", heading("Open todos"), accent(&d.open_total.to_string()))];
        if d.todos.is_empty() {
            todos.push(dim("All clear — nothing open."));
        }
        for t in d.todos.iter().take(rows.saturating_sub(1)) {
            todos.push(todo_line(t, col_w));
        }

        let mut projects = vec![heading("Projects")];
        if d.projects.is_empty() {
            projects.push(dim("No projects yet."));
        }
        for p in d.projects.iter().take(rows.saturating_sub(1)) {
            let open = if p.open > 0 { accent(&format!(" {}", p.open)) } else { String::new() };
            let name_room = col_w.saturating_sub(4 + 9 + 3);
            projects.push(format!(
                "{} {} {}{}",
                accent(&format!("{:>2}", p.number)),
                pad(&truncate(&p.name, name_room), name_room),
                dim(&pad(&p.ago, 9)),
                open
            ));
        }

        let mut week = vec![heading("Completion")];
        for (label, rate) in &d.rates {
            week.push(format!("{} {} {}", dim(&pad(label, 8)), bar(*rate, col_w.saturating_sub(8 + 1 + 5).clamp(4, 16)), bold(&format!("{rate}%"))));
        }
        week.push(String::new());
        week.push(dim("open 1 · cmd 2 · todos 3"));
        week.push(dim("git 1 status · github 2 prs"));
        vec![todos, projects, week]
    }

    fn session_columns(&self, lay: &Lay, rows: usize) -> Vec<Vec<String>> {
        let n = if lay.cw >= 96 { 3 } else if lay.cw >= 62 { 2 } else { 1 };
        let col_w = (lay.cw.saturating_sub(3 * (n - 1))) / n;
        let Some(s) = &self.session else { return vec![] };

        let mut info = vec![heading("Project"), bold(&s.name)];
        info.push(dim(&truncate(&s.cwd.display().to_string(), col_w)));
        match &s.git {
            Some(g) => {
                let state = if g.dirty == 0 { green("clean") } else { yellow(&format!("{} changed", g.dirty)) };
                info.push(format!("{} {}  {}", accent("⎇"), g.branch, state));
                if !g.last.is_empty() { info.push(dim(&truncate(&format!("↳ {}", g.last), col_w))); }
            }
            None => info.push(dim("not a git repository")),
        }
        if !s.github.is_empty() { info.push(dim(&format!("github.com/{}", s.github))); }

        let mut todos = vec![format!("{}  {}", heading("Todos"), accent(&self.dash.scoped_todos.len().to_string()))];
        if self.dash.scoped_todos.is_empty() {
            todos.push(dim("None open for this project."));
            todos.push(dim("/add <title> to create one"));
        }
        for t in self.dash.scoped_todos.iter().take(rows.saturating_sub(1)) {
            todos.push(todo_line(t, col_w));
        }

        let mut scripts = vec![heading("Scripts")];
        for (k, c) in &s.commands {
            scripts.push(format!("{} {}", accent(&pad(k, 6)), dim(&truncate(c, col_w.saturating_sub(7)))));
        }
        if s.commands.is_empty() { scripts.push(dim("No scripts set up.")); }
        scripts.push(String::new());
        scripts.push(dim("home · exit to leave"));
        vec![info, todos, scripts]
    }

    // ── status bar ──

    fn status_bar(&self, w: usize) -> String {
        let mode = match &self.session {
            Some(s) => chip(&format!(" ▸ {} ", truncate(&s.name, 24))),
            None => chip(" ⌂ home "),
        };
        let clock = Local::now();
        let icon = if (6..18).contains(&clock.hour()) { "☀" } else { "☾" };
        let right = dim(&format!("{icon} {}  ", clock.format("%H:%M")));

        let middle = if let Some(j) = &self.job {
            format!(
                " {} {} {}",
                accent(SPINNER[self.spin % SPINNER.len()]),
                truncate(&j.label, w.saturating_sub(40).max(10)),
                dim("· Ctrl+C to stop")
            )
        } else if self.quit_armed {
            dim(" Press Ctrl+C again to exit").to_string()
        } else if w >= 96 {
            dim(" Tab complete · ↑↓ history · PgUp/PgDn scroll · Ctrl+L clear · Ctrl+C exit").to_string()
        } else if w >= 60 {
            dim(" Tab complete · ↑↓ history · PgUp/PgDn scroll").to_string()
        } else {
            String::new()
        };

        // The clock on the right always wins; hints give way when space is short.
        let budget = w.saturating_sub(1 + visible_len(&mode) + visible_len(&right));
        let middle = clip(&middle, budget);
        let used = visible_len(&mode) + visible_len(&middle) + visible_len(&right);
        let fill = w.saturating_sub(used + 1);
        format!("{mode}{middle}{}{right}", " ".repeat(fill))
    }
}
