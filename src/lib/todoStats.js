// Pure todo-completion math for the Patterns page. Everything is derived
// from the live todos cache (createdAt / completedAt / trashedAt), so the
// numbers are exact for any window instead of leaning on lifetime counters.

export const TODO_RANGES = [
  { id: 'daily',    label: 'Today',    days: 1 },
  { id: 'weekly',   label: '7 days',   days: 7 },
  { id: 'monthly',  label: '30 days',  days: 30 },
  { id: 'quarter',  label: '3 months', days: 90 },
  { id: 'lifetime', label: 'Lifetime', days: null },
]

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

// Window start: "Today" = since local midnight; N days = midnight N-1 days
// ago (so a 7-day window includes today plus the six days before it).
export function rangeStart(range, now = new Date()) {
  if (!range || range.days == null) return null
  const s = startOfDay(now)
  s.setDate(s.getDate() - (range.days - 1))
  return s
}

// A todo is "in play" for a window when it was created inside it or
// finished inside it. The rate is finished-in-window ÷ in-play, so ticking
// off an old task today counts, and a task created today but still open
// counts against you — both feel right to the person looking at the number.
export function todoCompletionStats(todos, range, now = new Date()) {
  const live = (todos || []).filter(t => !t.trashedAt)
  const open = live.filter(t => !t.completed).length
  const start = rangeStart(range, now)
  const inWindow = iso => {
    if (!iso) return false
    const t = new Date(iso).getTime()
    if (Number.isNaN(t)) return false
    return start == null || t >= start.getTime()
  }

  let created = 0
  let completed = 0
  let inPlay = 0
  for (const t of live) {
    const madeIn = inWindow(t.createdAt)
    const doneIn = !!t.completed && inWindow(t.completedAt)
    if (madeIn) created++
    if (doneIn) completed++
    if (madeIn || doneIn) inPlay++
  }
  const rate = inPlay > 0 ? Math.round((completed / inPlay) * 100) : 0
  return { open, created, completed, inPlay, rate }
}
