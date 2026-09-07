# UI Audit — Phase 4.1

Written against commit `792a40d` (post-Phase-3). All numbers below are from
running the greps/scripts shown, not estimated — re-run them to check drift.

## 1. Scale of the inline-style problem

```
grep -rc "style={{" src --include=*.jsx | awk -F: '{sum+=$2} END {print sum}'
```

| Location | Count |
|---|---|
| `src/pages/` | 979 |
| `src/components/` | 696 |
| Total in `src/` | 2019 |

Per-file, `src/pages/`, worst first:

| File | inline styles | lines | useState |
|---|---|---|---|
| ProjectDetail.jsx | 214 | 1698 | 67 |
| Onboarding.jsx | 103 | 841 | 19 |
| Notes.jsx | 84 | — | — |
| Settings.jsx | 81 | 1156 | 53 |
| ProjectForm.jsx | 78 | — | — |
| Todo.jsx | 72 | — | — |
| Favourites.jsx | 71 | — | — |
| Ideas.jsx | 66 | — | — |
| Dashboard.jsx | 52 | — | — |
| NoteEditor.jsx | 45 | — | — |
| Projects.jsx | 40 | — | — |
| Activity.jsx | 33 | — | — |
| EasterEggs.jsx | 22 | — | — |
| GitHub.jsx | 10 | — | — |
| Patterns.jsx | 8 | — | — |

**Why this blocks the Style axis:** inline `style={{}}` always beats a CSS
class in specificity. `applyStyle()` in `appearanceStyle.js` can only reach
the handful of things actually styled through `.pm-card`/`.pm-btn-*`/the
token layer — everything else (the vast majority of the UI) is invisible
to it. A Style can recolor a few shared primitives; it cannot restructure
layout, density, or chrome anywhere a page hardcodes its own `style={{}}`.
This is the literal, mechanical reason Phase 4.2's extraction isn't
optional cleanup — it's the prerequisite for Style to do anything at all.

**Radius drift**, as one concrete symptom of the same root cause (values
extracted via `grep -roh "borderRadius: [0-9]*"`):

```
91× borderRadius: 7      54× borderRadius: 6      33× borderRadius: 5
70× borderRadius: 8      51× borderRadius: 4       8× borderRadius: 9
57× borderRadius: 10     27× borderRadius: 12       8× borderRadius: 14
17× borderRadius: 3      17× borderRadius: 20       + 2,11,16,18,24 (1-2× each)
```

17 distinct pixel values in active use, against 4 declared tokens
(`--r-sm` 6, `--r-md` 8, `--r-lg` 14, `--r-xl` 18). `7` (91 uses) and `10`
(57 uses) are each used *more* than any actual token value except `8`/`6`
— this isn't occasional drift, it's a second, informal radius scale that
grew up in parallel with the real one, entirely inline and entirely
untouched by Style or Theme.

## 2. Visual primitives — where each is reimplemented

| Primitive | Shared version | Duplicate inline reimplementations |
|---|---|---|
| Card | `.pm-card` (index.css) | Used inconsistently — many pages hand-roll `background: var(--card); border: 1px solid var(--border); borderRadius: <one of 17 values>` instead of the class. |
| Primary/secondary button | `.pm-btn-primary` / `.pm-btn-secondary` | `Dashboard/TopBtn.jsx`, `Todo/TopBtn.jsx`, `Todo/RowBtn.jsx`, `Projects/TopBtn.jsx`, `Projects/CardBtn.jsx`, `Projects/IconBtn.jsx`, `Projects/ViewBtn.jsx`, `ProjectDetail/DepsBtn.jsx`, `Settings/Buttons.jsx` (`SmallBtn`, `SaveBtn`) — **9 separate button components**, each with its own inline hover-state `useState` + inline style object, none sharing the CSS classes that already exist for exactly this. |
| Chip | none | `Dashboard/FavChip.jsx`, `ProjectDetail/Chip.jsx` — two, independently styled. |
| Badge | none | `ProjectDetail/VisBadge.jsx`, `Projects/VisibilityBadge.jsx` — same concept (visibility: public/hidden), two components, two names for the same thing. |
| Tab | none | `Projects/FilterTab.jsx`, `Todo/FilterTab.jsx`, `Todo/PriorityTab.jsx` — three, all hand-rolled. |
| Modal | none | `GitHub/CreateReleaseModal.jsx`, `ProjectDetail/ConfirmModal.jsx`, `Settings/ConfirmModal.jsx`, `Schedules/ScheduleModal.jsx`, `Todo/PriorityManagerModal.jsx` — **5 modal implementations**, each re-declaring its own backdrop/overlay/panel styling (visible already in `ProjectDetail.jsx`'s inline "Publish to GitHub" modal at line ~1576, which isn't even componentized). |
| Empty state | none found | Every page that needs one (Projects, Notes, Todo, Favourites, Activity) writes its own icon+text block inline. |
| Input / TextInput | `Settings/TextInput.jsx` exists but is Settings-scoped; other pages (ProjectForm, Notes, Todo) hand-roll `<input style={{...}}>` directly. |

**Consolidation target for Phase 4.2**: one `src/components/ui/` set —
`Card`, `Button` (primary/secondary/icon variants via props, not separate
files), `Chip`, `Badge`, `Tab`, `Modal`, `EmptyState`, `Input` — with
per-feature wrappers kept only where they add real behavior (e.g. a
`RowBtn` that's genuinely table-row-specific), not where they're purely a
copy with different inline colors.

## 3. Density, spacing, and hierarchy

- The 8px spacing scale (`--sp-1` through `--sp-6`) exists but is
  **advisory, not enforced** — the vast majority of the 2019 inline style
  objects use raw pixel margins/paddings/gaps (`padding: '14px 16px'`,
  `gap: 10`, `marginBottom: 14`) rather than the scale. Values like `10`,
  `14`, `18`, `22` appear constantly alongside the scale's `8/16/24/32`,
  meaning there effectively is no enforced rhythm — hierarchy is
  eyeballed per-component, not derived from a system.
- Nesting depth is a real problem in the larger pages: `ProjectDetail.jsx`
  routinely nests card-inside-panel-inside-card (e.g. the Deps tab and the
  Files tab both wrap already-carded content in another bordered
  container), which is exactly the "boxes inside boxes" pattern Phase 4.4
  is meant to replace with spacing-driven hierarchy.
- `ProjectDetail.jsx` (1698 lines, 67 `useState`) and `Settings.jsx` (1156
  lines, 53 `useState`) are both well past the point where per-page state
  is legible. Neither uses `useReducer` anywhere; every one of those
  ~120 combined `useState` calls is independent, so related flags (e.g.
  ProjectDetail's git-op-in-progress states, or its various modal/tab/
  loading booleans) have no enforced relationship to each other and can
  drift into contradictory combinations.

## 4. Color: decorative vs. semantic

- `--green`/`--red`/`--yellow` are used both semantically (status,
  correctly) and decoratively (e.g. arbitrary UI chrome picks a status
  color because it "looks nice," not because it encodes a state) in
  several places across Dashboard and Patterns — grep for `var(--green)`
  outside of anything status-shaped to confirm exact sites before Phase
  4.4 does the "status color only encodes status" pass.
- `--dash-accent-card-bg` (a gradient) and `--accent-glow`/`--card-hover-
  lift` exist specifically so the Dashboard's accent card and hover states
  look more "designed." Under the minimal Style's own stated rules ("no
  gradients... no hover lift"), these three tokens are exactly what a
  minimal Style must override to nothing — they're already structured as
  overridable tokens (see `html.style-natural` already zeroing
  `--card-hover-lift` and flattening `--dash-accent-card-bg`), so Phase
  4.4 has a template to follow, not new plumbing to build.
- The Futuristic theme's glow/scan-line treatment (`index.css` lines
  353–402: neon grid background, glowing card borders, text-shadow
  headings, glow scrollbar) is the single largest block of
  theme-specific CSS in the file — more than the other 7 themes'
  color-only overrides combined. It's a legitimate, distinct visual
  identity (see §5), but it's also the theme most likely to visually
  fight a future minimal Style's "no decoration that doesn't carry
  information" rule if the two are ever combined; worth an explicit
  compatibility check once Style 4.4 exists.

## 5. Theme-by-theme critique

Real contrast numbers (WCAG relative-luminance formula, computed directly
from each theme's hex values — not eyeballed):

| Theme | text/base | text/card | dim/base | dim/card | dimmer/base | dimmer/card | black-on-accent (button text) |
|---|---|---|---|---|---|---|---|
| Default | 16.76 | 15.73 | 6.69 | 6.28 | 3.35 | 3.14 | 16.56 |
| Catppuccin Latte | 7.06 | 6.04 | 5.53 | 4.73 | 4.37 | 3.73 | **3.88 — FAILS AA (4.5:1)** |
| Catppuccin Frappé | 9.83 | 8.06 | 6.77 | 5.55 | 4.76 | 3.90 | 9.54 |
| Catppuccin Macchiato | 11.73 | 9.92 | 7.83 | 6.62 | 4.48 | 3.79 | 9.76 |
| Catppuccin Mocha | 12.97 | 11.34 | 8.42 | 7.37 | 4.64 | 4.06 | 10.34 |
| NeoVim Dark | 11.45 | 10.59 | 7.61 | 7.04 | 3.53 | 3.27 | 12.61 |
| Vim Classic | 11.05 | 8.56 | 6.36 | 4.93 | 3.86 | **2.99 — borderline FAILS (3:1)** | 7.78 |
| Futuristic | 18.23 | 17.27 | 9.21 | 8.73 | 4.02 | 3.81 | 14.91 |

Methodology note: `text` is checked against AA's 4.5:1 normal-text
threshold; `dim`/`dimmer` against the 3:1 large-text/UI-component
threshold since that's how they're predominantly used in this codebase
(11–13px captions/labels) — but that assumption hasn't been verified
against every one of the ~2000 call sites, so treat any `dim`/`dimmer`
reading between 3.0 and 4.5 as "needs a closer look once 4.2 catalogs
actual font sizes," not a confirmed pass.

**Two real, confirmed failures:**

1. **Catppuccin Latte's primary button is a real accessibility bug
   today**, not a Phase 4 hypothetical: `.pm-btn-primary` hardcodes
   `color: #000` on `background: var(--accent)`, and Latte's accent
   (`#8839ef`) only gives black text 3.88:1 — under the 4.5:1 AA
   threshold for normal-size text. Every primary button in the app is
   under-contrast on this one theme. Worth fixing independent of the rest
   of Phase 4 (either lighten Latte's accent or make button text
   theme-aware instead of hardcoded black).
2. **Vim Classic's `dimmer`-on-`card` pairing is borderline** (2.99 vs.
   3:1) — right at the line, likely to read as a fail depending on actual
   font weight/size at each use site.

**Are the 8 themes actually distinct, or the same layout with swapped
hex values?** Structurally identical — every theme overrides the same
~15 color tokens and nothing else (no unique layout, spacing, or
component-shape changes; that's Style's job, not Theme's, and correctly
so per the architecture). Visually:

- The 4 Catppuccin variants (Latte/Frappé/Macchiato/Mocha) are one
  palette family at 4 lightness steps — genuinely a single design
  decision offered as 4 options, not 4 independent design efforts. Keeping
  all 4 is reasonable *if* Catppuccin's own popularity justifies it
  (it's a well-known, actively-used palette people specifically look
  for), but from a "is this pulling its weight as a maintenance surface"
  standpoint, shipping Frappé/Macchiato/Mocha and dropping Latte (the
  only light theme, and the one with the confirmed contrast bug) is a
  defensible cut if the goal is fewer-but-better.
- NeoVim Dark and Vim Classic are both "text-editor inspired dark
  themes" and read as fairly similar in practice (both muted, desaturated,
  low-chroma) — the strongest overlap in the set outside the Catppuccin
  family itself.
- Futuristic is the only theme with real, independent visual effort
  beyond palette swapping (§4) — genuinely distinct, and arguably the
  best case for "this earns its keep," though its glow/gradient-heavy
  identity is also the one most explicitly at odds with a minimal-Style
  design philosophy if the two ever need to coexist.
- Default is the baseline the whole token system was designed around and
  isn't a candidate for removal.

**Recommendation to bring back for your sign-off before any theme is
cut** (per the brief, this list needs approval, not unilateral action):
keep Default, Futuristic, and one Catppuccin variant (Mocha — best
contrast numbers of the four); retire Latte (confirmed contrast bug, only
light option so hardest to keep consistent, least differentiated from
its own siblings), Frappé, Macchiato (redundant with Mocha), and pick one
of NeoVim Dark / Vim Classic to keep, not both. That's 8 → 4, matching
the brief's "four excellent ones are better than eight mediocre ones."
`normalizeThemeId` already falls back to Default for any removed id, so
this is safe for existing users regardless of which specific themes are
chosen.

## 6. Style axis critique

- **Default**: "the current Croco look" — this is the baseline everything
  else in this audit describes, not a distinct design decision.
- **Apple**: frosted glass, blur, spring motion, pill-shaped buttons.
  Coherent and well-executed for what it's going for (see the dedicated
  `html.style-apple` block, including its own shadow/transition scale) —
  but it's also the aesthetic Phase 4.4 explicitly wants the *new default*
  Style to move away from ("no gradients, no glows... no drop shadows on
  resting elements"). Keep as an opt-in alternative; don't let it
  influence the new default's design language.
- **Natural**: already does exactly what Phase 4.4 is asking for, just
  partially — flattens the accent-card gradient, removes card-hover lift,
  quiets shadows and motion durations, drops heading text-shadow/tracking.
  It's the closest existing thing to the target minimal Style, but it
  only touches flourish tokens (§4) — it has no layout tokens at all
  (density, sidebar width, content max-width, grid-vs-list default), so
  it can't do what 4.3/4.4 ask for on its own. Natural is the right
  starting point to extend, not a separate effort to duplicate.
- **Pasta Galaxy**: `status: 'coming-soon'`, and grepping the entire
  codebase for `pasta-galaxy`/`pastaGalaxy` turns up exactly one line —
  its own entry in `STYLES` in `appearanceStyle.js`. Zero CSS, zero
  special-cased logic anywhere else. This is dead weight in the UI today
  (a picker option that does nothing when selected beyond falling back to
  Default via `normalizeStyleId`) — confirms the brief's suspicion.
  Recommend removing the entry rather than building it; nothing in this
  audit suggests what "Pasta Galaxy" was meant to be, and inventing a
  fourth Style direction isn't in scope for Phase 4 as briefed (which
  asks for exactly one new minimal Style, not two).

## 7. Fonts

`index.css:1` imports 12 font families from `fonts.googleapis.com` at
runtime on every launch — a startup network dependency, a privacy leak,
and a broken-offline first paint, exactly as CLAUDE.md already flags.
Actually-used families, cross-referenced against `--font-body`/`--font-
mono`/`--font-display` token usage and the `fontBody`/`fontDisplay`
picker options users can select in Settings: `Geist`, `Geist Mono`,
`Inter`, `IBM Plex Sans`, `Nunito`, `DM Sans`, `Space Grotesk`, `Manrope`,
`Lora`, `Playfair Display`, `JetBrains Mono`, `Fira Code` — all 12 are
reachable from the Settings font picker (not dead), but only 2 are ever
the *default* (`Geist` body, `Lora` display), meaning most users load
10 unused families on every cold start just because the picker offers
them. Self-hosting only the weights actually offered (not every weight
in each family's `@import`, several of which request 5 weights per
family that the UI never uses) is a real, bounded win — variable fonts
(most of these ship variable-font builds) could cut this further.

## 8. Recommended Phase 4.2 order

Given the size (2019 inline styles, page-by-page with visual proof
required), suggest working largest-impact-first rather than alphabetical:
`ProjectDetail.jsx` (214 inline styles, worst offender, also the one most
overdue for the `useState`→`useReducer` consolidation) → `Settings.jsx`
(81 + 53 useState, same consolidation need) → `Onboarding.jsx` (103) →
the shared `src/components/ui/` primitives (build these *during* the
ProjectDetail pass, since extracting its duplicated buttons/modals is
what surfaces what the shared set needs to contain) → remaining pages in
descending inline-style count.
