// Todo priorities used to be a hardcoded high/med/low enum, duplicated in
// three components. They're now user-configurable — stored as an ordered
// list at settings.todos.priorities (id/label/color), with 'high'/'med'/'low'
// still the shipped defaults so existing todo.priority values keep matching.

export const DEFAULT_PRIORITIES = [
  { id: 'high', label: 'High',   color: '#ff4444' },
  { id: 'med',  label: 'Medium', color: '#ffd700' },
  { id: 'low',  label: 'Low',    color: '#4aff91' },
]

export function normalizePriorities(list) {
  if (!Array.isArray(list) || list.length === 0) return DEFAULT_PRIORITIES
  const clean = list.filter(p => p && typeof p.id === 'string' && p.id && typeof p.label === 'string' && p.label)
  return clean.length > 0 ? clean : DEFAULT_PRIORITIES
}

// Completed todos become read-only 6 days after completion — protects
// against accidentally un-completing something long-finished. Shared so
// every place a todo checkbox renders (main Todo page, ProjectDetail's
// per-project tab, ...) enforces the same rule.
const LOCK_AFTER_MS = 6 * 24 * 60 * 60 * 1000

export function isTodoLocked(todo) {
  return !!(todo?.completed && todo.completedAt && (Date.now() - new Date(todo.completedAt).getTime()) > LOCK_AFTER_MS)
}

export function hexToRgba(hex, alpha = 0.12) {
  const h = (hex || '#888888').replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const r = parseInt(full.slice(0, 2), 16) || 0
  const g = parseInt(full.slice(2, 4), 16) || 0
  const b = parseInt(full.slice(4, 6), 16) || 0
  return `rgba(${r},${g},${b},${alpha})`
}

export function findPriority(priorities, id) {
  return (priorities || []).find(p => p.id === id) || { id, label: id || 'none', color: '#888888' }
}

/** Slugifies a label into a unique id within the given priority list. */
export function slugifyPriorityId(label, existing) {
  const base = (label || 'priority').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'priority'
  let id = base, i = 2
  while ((existing || []).some(p => p.id === id)) { id = `${base}-${i}`; i += 1 }
  return id
}
