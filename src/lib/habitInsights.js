// Shared calculations over the habits.json profile (see personality.rs)
// used by both the Patterns page widgets and the Suggestions engine — kept
// in one place so the two never quietly disagree on the same numbers.

export const NEGLECT_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

function scoreOf(stat) {
  return (stat.opens || 0) + (stat.commits || 0) + (stat.todos || 0)
}

/** Ranks projects by combined opens+commits+todos activity. */
export function scoreProjects(projectStats, projects) {
  const projectById = new Map(projects.map(p => [p.id, p]))
  return Object.entries(projectStats || {}).map(([id, stat]) => ({
    id,
    name: projectById.get(id)?.name || '(deleted project)',
    stat,
    score: scoreOf(stat),
  }))
}

/** Projects whose lastActivityAt is older than NEGLECT_THRESHOLD_MS, quietest first. */
export function findNeglectedProjects(projectStats, projects, { limit = 3 } = {}) {
  const now = Date.now()
  return scoreProjects(projectStats, projects)
    .filter(r => r.stat.lastActivityAt && now - new Date(r.stat.lastActivityAt).getTime() > NEGLECT_THRESHOLD_MS)
    .map(r => ({ ...r, quietDays: Math.floor((now - new Date(r.stat.lastActivityAt).getTime()) / 86400000) }))
    .sort((a, b) => b.quietDays - a.quietDays)
    .slice(0, limit)
}

function toLocalDateStr(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Current/longest streak from any array of unique local YYYY-MM-DD strings.
 * Shared by the commit streak (habits.json `commitDates`, from git log) and
 * the app-login streak (`appOpenDates`, from personality_track_app_open).
 */
export function computeDateStreak(dates) {
  if (!dates || dates.length === 0) return { current: 0, longest: 0, hitToday: false }
  const days = dates.map(d => new Date(`${d}T00:00:00`))
  let longest = 1, run = 1
  for (let i = 1; i < days.length; i++) {
    const diffDays = Math.round((days[i] - days[i - 1]) / 86400000)
    run = diffDays === 1 ? run + 1 : 1
    if (run > longest) longest = run
  }
  const daySet = new Set(dates)
  const hitToday = daySet.has(toLocalDateStr(new Date()))
  const cursor = new Date()
  // Grace day: if nothing logged yet today, the streak still counts as
  // "alive" through yesterday rather than resetting to 0 at midnight.
  if (!hitToday) cursor.setDate(cursor.getDate() - 1)
  let current = 0
  while (daySet.has(toLocalDateStr(cursor))) {
    current += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return { current, longest, hitToday }
}

/** Current/longest commit streaks from habits.json's `commitDates` (unique local YYYY-MM-DD strings). */
export function computeCommitStreaks(commitDates) {
  const { current, longest, hitToday } = computeDateStreak(commitDates)
  return { current, longest, committedToday: hitToday }
}

/** Commit counts bucketed into the last `weeks` calendar weeks (Sun–Sat), oldest first. */
export function computeWeeklyTrend(commitDates, weeks = 12) {
  const counts = new Array(weeks).fill(0)
  if (!commitDates || commitDates.length === 0) return counts
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startOfThisWeek = new Date(today)
  startOfThisWeek.setDate(today.getDate() - today.getDay())
  for (const d of commitDates) {
    const day = new Date(`${d}T00:00:00`)
    // Align to each date's own week-start (Sunday) before diffing, so the
    // division is always a whole number of weeks. Diffing startOfThisWeek
    // directly against `day` (a point *within* its week) produced a
    // fractional value that `Math.floor` rounded the wrong way for any day
    // after the week's Sunday — silently dropping the current week's own
    // commits (index landed one past the end of the array) while
    // miscounting last week's commits into the current-week bucket.
    const startOfDayWeek = new Date(day)
    startOfDayWeek.setDate(day.getDate() - day.getDay())
    const weeksAgo = Math.round((startOfThisWeek - startOfDayWeek) / (7 * 86400000))
    const idx = weeks - 1 - weeksAgo
    if (idx >= 0 && idx < weeks) counts[idx] += 1
  }
  return counts
}

/** Commit counts bucketed into the last `months` calendar months, oldest first. */
export function computeMonthlyTrend(commitDates, months = 12) {
  const counts = new Array(months).fill(0)
  if (!commitDates || commitDates.length === 0) return counts
  const today = new Date()
  const thisMonthIndex = today.getFullYear() * 12 + today.getMonth()
  for (const d of commitDates) {
    const day = new Date(`${d}T00:00:00`)
    const dayMonthIndex = day.getFullYear() * 12 + day.getMonth()
    const idx = months - 1 - (thisMonthIndex - dayMonthIndex)
    if (idx >= 0 && idx < months) counts[idx] += 1
  }
  return counts
}

/** Commit counts bucketed into the last `years` calendar years, oldest first. */
export function computeYearlyTrend(commitDates, years = 5) {
  const counts = new Array(years).fill(0)
  if (!commitDates || commitDates.length === 0) return counts
  const thisYear = new Date().getFullYear()
  for (const d of commitDates) {
    const day = new Date(`${d}T00:00:00`)
    const idx = years - 1 - (thisYear - day.getFullYear())
    if (idx >= 0 && idx < years) counts[idx] += 1
  }
  return counts
}

/** Day-cell grid for a GitHub-style contribution heatmap, oldest first, `weeks` columns of 7 days. */
export function computeHeatmapWeeks(commitDates, weeks = 26) {
  const daySet = new Set(commitDates || [])
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(today.getDate() - today.getDay() - (weeks - 1) * 7)
  const cols = []
  for (let w = 0; w < weeks; w++) {
    const col = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(start)
      date.setDate(start.getDate() + w * 7 + d)
      const key = toLocalDateStr(date)
      col.push({ date: key, count: daySet.has(key) ? 1 : 0, future: date > today })
    }
    cols.push(col)
  }
  return cols
}

/**
 * Aggregates each project's already-detected `languages` (file counts +
 * colors, populated lazily by projects_detect_languages when a project's
 * detail page is opened) into an overall mix across every tracked project.
 * Projects that haven't been opened yet simply contribute nothing — this
 * reads whatever's already cached rather than triggering fresh detection.
 */
export function computeLanguageMix(projects) {
  const byName = new Map()
  let total = 0
  for (const p of projects || []) {
    for (const lang of p.languages || []) {
      const count = lang.count || 0
      if (count <= 0) continue
      const prev = byName.get(lang.name) || { name: lang.name, color: lang.color, count: 0 }
      prev.count += count
      byName.set(lang.name, prev)
      total += count
    }
  }
  return [...byName.values()]
    .map(l => ({ ...l, pct: total > 0 ? Math.round((l.count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)
}
