import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { computeSuggestions } from './suggestions'

const NOW = new Date('2026-01-15T12:00:00')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('computeSuggestions', () => {
  it('returns nothing without a habits profile', () => {
    expect(computeSuggestions({ profile: null, projects: [], todos: [] })).toEqual([])
  })

  it('flags overdue todos', () => {
    const todos = [{ completed: false, dueDate: '2026-01-01', title: 'Ship it' }]
    const result = computeSuggestions({ profile: {}, projects: [], todos })
    expect(result.find(s => s.id === 'overdue-todos')).toMatchObject({
      severity: 'warning',
      title: '1 todo overdue',
    })
  })

  it('does not flag a completed todo even if its due date passed', () => {
    const todos = [{ completed: true, dueDate: '2026-01-01', title: 'Done' }]
    const result = computeSuggestions({ profile: {}, projects: [], todos })
    expect(result.find(s => s.id === 'overdue-todos')).toBeUndefined()
  })

  it('does not flag a todo due in the future', () => {
    const todos = [{ completed: false, dueDate: '2026-02-01', title: 'Later' }]
    const result = computeSuggestions({ profile: {}, projects: [], todos })
    expect(result.find(s => s.id === 'overdue-todos')).toBeUndefined()
  })

  it('warns when a commit streak is at risk of ending today', () => {
    const profile = { commitDates: ['2026-01-13', '2026-01-14'] } // 2-day streak, nothing committed today
    const result = computeSuggestions({ profile, projects: [], todos: [] })
    expect(result.find(s => s.id === 'streak-risk')).toMatchObject({ severity: 'warning' })
  })

  it('does not warn about streak risk once committed today', () => {
    const profile = { commitDates: ['2026-01-14', '2026-01-15'] }
    const result = computeSuggestions({ profile, projects: [], todos: [] })
    expect(result.find(s => s.id === 'streak-risk')).toBeUndefined()
  })

  it('surfaces neglected projects', () => {
    const idle = new Date(NOW.getTime() - 20 * 86400000).toISOString()
    const profile = { projectStats: { p1: { lastActivityAt: idle } } }
    const projects = [{ id: 'p1', name: 'Old Project' }]
    const result = computeSuggestions({ profile, projects, todos: [] })
    expect(result.find(s => s.id === 'neglected:p1')).toMatchObject({ severity: 'info' })
  })

  it('flags a high-priority backlog once it exceeds 3 open items', () => {
    const todos = Array.from({ length: 4 }, () => ({ completed: false, priority: 'high' }))
    const result = computeSuggestions({ profile: {}, projects: [], todos })
    expect(result.find(s => s.id === 'priority-backlog')).toMatchObject({
      severity: 'info',
      title: '4 high-priority todos open',
    })
  })

  it('does not flag a backlog of exactly 3 high-priority todos', () => {
    const todos = Array.from({ length: 3 }, () => ({ completed: false, priority: 'high' }))
    const result = computeSuggestions({ profile: {}, projects: [], todos })
    expect(result.find(s => s.id === 'priority-backlog')).toBeUndefined()
  })

  it('caps the total number of suggestions returned', () => {
    const idle = new Date(NOW.getTime() - 20 * 86400000).toISOString()
    const profile = {
      commitDates: [], // triggers no streak-risk (current === 0)
      projectStats: Object.fromEntries(
        Array.from({ length: 5 }, (_, i) => [`p${i}`, { lastActivityAt: idle }])
      ),
    }
    const projects = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }))
    const todos = [
      { completed: false, dueDate: '2026-01-01', title: 'Overdue' },
      ...Array.from({ length: 4 }, () => ({ completed: false, priority: 'high' })),
    ]
    const result = computeSuggestions({ profile, projects, todos })
    expect(result.length).toBeLessThanOrEqual(5)
  })
})
