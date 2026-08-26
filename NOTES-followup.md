# Follow-up notes

Things noticed while working through the remediation brief that are out of
scope for the current phase. Not acted on yet.

## From Phase 0 baseline

- `npm audit` reports 8 vulnerabilities (2 low, 1 moderate, 5 high) in
  `node_modules` as of the 2026-08-26 baseline. Not triaged — belongs in
  Phase 2 (supply chain: `npm audit --audit-level=high` in CI).
- `npm run build` warns that `dist/assets/index-*.js` is 791 KB
  (min+gzip 200 KB), above Vite's 500 KB chunk-size-warning threshold. No
  code-splitting today. Not a Phase 0 concern; worth a look during Phase 4
  (page splitting) or Phase 5 (perf) since large pages like
  `ProjectDetail.jsx`/`Settings.jsx`/`Onboarding.jsx` are likely the bulk
  of it.
- `npm run lint` baseline has 5 pre-existing `react-hooks/exhaustive-deps`
  warnings (0 errors): `GitHub/InsightsPanel.jsx:40`,
  `layout/AppShell.jsx:22`, `pages/NoteEditor.jsx:83`,
  `pages/ProjectDetail.jsx:139` and `:204`. Recorded as baseline, not fixed
  — fixing these isn't Phase 0 scope and at least one (`ProjectDetail.jsx`)
  overlaps with the Phase 4 page-splitting work anyway.
