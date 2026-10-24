import { describe, it, expect } from 'vitest'
import { TODO_RANGES, todoCompletionStats, rangeStart } from './todoStats.js'

const NOW = new Date('2026-10-24T15:00:00')
const range = id => TODO_RANGES.find(r => r.id === id)
const iso = (daysAgo, hour = 10) => {
  const d = new Date(NOW)
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

describe('todoCompletionStats', () => {
  const todos = [
    { id: 'a', createdAt: iso(0), completed: true,  completedAt: iso(0, 12) },
    { id: 'b', createdAt: iso(0), completed: false },
    { id: 'c', createdAt: iso(3), completed: true,  completedAt: iso(2) },
    { id: 'd', createdAt: iso(40), completed: true, completedAt: iso(0, 9) },
    { id: 'e', createdAt: iso(40), completed: false },
    { id: 'f', createdAt: iso(0), completed: true, completedAt: iso(0), trashedAt: iso(0) },
  ]

  it('ignores trashed todos and counts open ones globally', () => {
    expect(todoCompletionStats(todos, range('lifetime'), NOW).open).toBe(2)
  })

  it('daily window counts work created or finished today', () => {
    const s = todoCompletionStats(todos, range('daily'), NOW)
    expect(s).toMatchObject({ created: 2, completed: 2, inPlay: 3, rate: 67 })
  })

  it('weekly window picks up the task finished two days ago', () => {
    const s = todoCompletionStats(todos, range('weekly'), NOW)
    expect(s.completed).toBe(3)
    expect(s.inPlay).toBe(4)
    expect(s.rate).toBe(75)
  })

  it('lifetime covers everything non-trashed', () => {
    const s = todoCompletionStats(todos, range('lifetime'), NOW)
    expect(s).toMatchObject({ completed: 3, inPlay: 5, rate: 60 })
  })

  it('is 0% (not NaN) for an empty window', () => {
    expect(todoCompletionStats([], range('monthly'), NOW).rate).toBe(0)
  })

  it('rangeStart is local midnight N-1 days back', () => {
    const s = rangeStart(range('weekly'), NOW)
    expect(s.getHours()).toBe(0)
    expect(Math.round((startOfDayMs(NOW) - s.getTime()) / 864e5)).toBe(6)
  })
})

function startOfDayMs(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime() }
