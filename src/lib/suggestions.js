// Rule-based "JARVIS-style" proactive suggestions — deterministic heuristics
// over the existing habits.json profile + projects/todos, no AI involved.
// That's a deliberate choice: it works with zero configuration and no
// external API dependency.
import { findNeglectedProjects, computeCommitStreaks } from './habitInsights'

const MAX_SUGGESTIONS = 5

function overdueTodoSuggestion(todos) {
  const now = new Date()
  const overdue = todos.filter(t => !t.completed && t.dueDate && new Date(t.dueDate) < now)
  if (overdue.length === 0) return null
  return {
    id: 'overdue-todos',
    severity: 'warning',
    title: `${overdue.length} todo${overdue.length === 1 ? '' : 's'} overdue`,
    body: overdue.length === 1
      ? `"${overdue[0].title}" is past its due date.`
      : `${overdue.length} todos are past their due date.`,
  }
}

function streakRiskSuggestion(profile) {
  const { current, committedToday } = computeCommitStreaks(profile?.commitDates)
  if (current === 0 || committedToday) return null
  return {
    id: 'streak-risk',
    severity: 'warning',
    title: `${current}-day commit streak ends today`,
    body: `You haven't committed yet today — commit something to keep your ${current}-day streak alive.`,
  }
}

function neglectedProjectSuggestions(profile, projects) {
  return findNeglectedProjects(profile?.projectStats, projects, { limit: 2 }).map(r => ({
    id: `neglected:${r.id}`,
    severity: 'info',
    title: `${r.name} has been quiet`,
    body: `No activity in ${r.name} for ${r.quietDays} days.`,
  }))
}

function priorityBacklogSuggestion(todos) {
  const count = todos.filter(t => !t.completed && t.priority === 'high').length
  if (count <= 3) return null
  return {
    id: 'priority-backlog',
    severity: 'info',
    title: `${count} high-priority todos open`,
    body: `You have ${count} open todos marked high priority — worth triaging.`,
  }
}

/**
 * @param {{ profile: object|null, projects: object[], todos: object[] }} args
 * @returns {Array<{id: string, severity: 'warning'|'info', title: string, body: string}>}
 */
export function computeSuggestions({ profile, projects, todos }) {
  if (!profile) return []
  const suggestions = [
    streakRiskSuggestion(profile),
    overdueTodoSuggestion(todos || []),
    ...neglectedProjectSuggestions(profile, projects || []),
    priorityBacklogSuggestion(todos || []),
  ].filter(Boolean)
  return suggestions.slice(0, MAX_SUGGESTIONS)
}
