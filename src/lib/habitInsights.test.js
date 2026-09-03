import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  scoreProjects,
  findNeglectedProjects,
  computeDateStreak,
  computeCommitStreaks,
  computeWeeklyTrend,
  computeMonthlyTrend,
  computeYearlyTrend,
  computeHeatmapWeeks,
  computeLanguageMix,
  NEGLECT_THRESHOLD_MS,
} from './habitInsights'

// Fixed reference "now" so date-relative logic (streaks, trends, neglect)
// is deterministic instead of depending on when the test happens to run.
const NOW = new Date('2026-01-15T12:00:00')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('scoreProjects', () => {
  it('combines opens+commits+todos into a score and looks up project names', () => {
    const stats = { p1: { opens: 2, commits: 3, todos: 1 } }
    const projects = [{ id: 'p1', name: 'Croco' }]
    expect(scoreProjects(stats, projects)).toEqual([
      { id: 'p1', name: 'Croco', stat: stats.p1, score: 6 },
    ])
  })

  it('labels a stat with no matching project as deleted', () => {
    const stats = { gone: { opens: 1, commits: 0, todos: 0 } }
    expect(scoreProjects(stats, [])[0].name).toBe('(deleted project)')
  })

  it('handles missing/empty stats', () => {
    expect(scoreProjects(null, [])).toEqual([])
    expect(scoreProjects(undefined, [])).toEqual([])
  })
})

describe('findNeglectedProjects', () => {
  it('excludes projects active within the threshold', () => {
    const recentIso = new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
    const stats = { p1: { lastActivityAt: recentIso } }
    expect(findNeglectedProjects(stats, [{ id: 'p1', name: 'A' }])).toEqual([])
  })

  it('includes projects idle longer than the threshold, quietest first', () => {
    const idle20 = new Date(NOW.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString()
    const idle30 = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const stats = {
      p1: { lastActivityAt: idle20 },
      p2: { lastActivityAt: idle30 },
    }
    const projects = [{ id: 'p1', name: 'Newer-idle' }, { id: 'p2', name: 'Older-idle' }]
    const result = findNeglectedProjects(stats, projects)
    expect(result.map(r => r.id)).toEqual(['p2', 'p1'])
    expect(result[0].quietDays).toBe(30)
  })

  it('respects the limit option', () => {
    const idle = new Date(NOW.getTime() - (NEGLECT_THRESHOLD_MS + 86400000)).toISOString()
    const stats = { p1: { lastActivityAt: idle }, p2: { lastActivityAt: idle }, p3: { lastActivityAt: idle } }
    const projects = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]
    expect(findNeglectedProjects(stats, projects, { limit: 1 })).toHaveLength(1)
  })
})

describe('computeDateStreak', () => {
  it('is all zeros for empty input', () => {
    expect(computeDateStreak([])).toEqual({ current: 0, longest: 0, hitToday: false })
    expect(computeDateStreak(null)).toEqual({ current: 0, longest: 0, hitToday: false })
  })

  it('detects hitToday when today is in the list', () => {
    expect(computeDateStreak(['2026-01-15']).hitToday).toBe(true)
  })

  it('computes a simple current streak ending today', () => {
    const r = computeDateStreak(['2026-01-13', '2026-01-14', '2026-01-15'])
    expect(r).toEqual({ current: 3, longest: 3, hitToday: true })
  })

  it('applies the grace day when nothing is logged yet today', () => {
    // "today" (01-15) absent, but yesterday continues an unbroken run —
    // the streak should still read as alive through yesterday.
    const r = computeDateStreak(['2026-01-13', '2026-01-14'])
    expect(r.hitToday).toBe(false)
    expect(r.current).toBe(2)
  })

  it('resets current to 0 once the gap exceeds the grace day', () => {
    const r = computeDateStreak(['2026-01-10'])
    expect(r.current).toBe(0)
  })

  it('finds the longest streak even if it is not the current one', () => {
    const r = computeDateStreak(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-10'])
    expect(r.longest).toBe(4)
    expect(r.current).toBe(0)
  })
})

describe('computeCommitStreaks', () => {
  it('renames hitToday to committedToday', () => {
    expect(computeCommitStreaks(['2026-01-15'])).toEqual({ current: 1, longest: 1, committedToday: true })
  })
})

describe('computeWeeklyTrend', () => {
  it('returns an all-zero array for empty input', () => {
    expect(computeWeeklyTrend([], 4)).toEqual([0, 0, 0, 0])
  })

  it('buckets a commit into the current week (last slot)', () => {
    const trend = computeWeeklyTrend(['2026-01-15'], 4)
    expect(trend[3]).toBe(1)
    expect(trend.slice(0, 3)).toEqual([0, 0, 0])
  })

  it('ignores commits older than the requested window', () => {
    const trend = computeWeeklyTrend(['2020-01-01'], 4)
    expect(trend).toEqual([0, 0, 0, 0])
  })

  it('buckets every day of the current week into the same last slot, not just Sunday', () => {
    // Regression test: NOW is Thursday 2026-01-15. Every day from this
    // week's Sunday (01-11) through today used to land at an out-of-range
    // index for every day except Sunday itself, silently dropping them.
    for (const d of ['2026-01-11', '2026-01-12', '2026-01-13', '2026-01-14', '2026-01-15']) {
      const trend = computeWeeklyTrend([d], 4)
      expect(trend).toEqual([0, 0, 0, 1])
    }
  })

  it('buckets a non-Sunday day from last week into the second-to-last slot, not the current one', () => {
    // Regression test: a Wednesday from the prior week used to be
    // miscounted into the current week's bucket instead of "1 week ago".
    const trend = computeWeeklyTrend(['2026-01-07'], 4)
    expect(trend).toEqual([0, 0, 1, 0])
  })
})

describe('computeMonthlyTrend', () => {
  it('buckets a commit into the current month (last slot)', () => {
    const trend = computeMonthlyTrend(['2026-01-15'], 3)
    expect(trend[2]).toBe(1)
  })

  it('buckets a commit from last month into the second-to-last slot', () => {
    const trend = computeMonthlyTrend(['2025-12-01'], 3)
    expect(trend[1]).toBe(1)
    expect(trend[2]).toBe(0)
  })
})

describe('computeYearlyTrend', () => {
  it('buckets a commit into the current year (last slot)', () => {
    expect(computeYearlyTrend(['2026-06-01'], 3)[2]).toBe(1)
  })

  it('buckets a commit from last year correctly', () => {
    const trend = computeYearlyTrend(['2025-06-01'], 3)
    expect(trend[1]).toBe(1)
    expect(trend[2]).toBe(0)
  })
})

describe('computeHeatmapWeeks', () => {
  it('marks today as a filled, non-future cell', () => {
    const weeks = computeHeatmapWeeks(['2026-01-15'], 4)
    const flat = weeks.flat()
    const todayCell = flat.find(c => c.date === '2026-01-15')
    expect(todayCell.count).toBe(1)
    expect(todayCell.future).toBe(false)
  })

  it('marks dates after today as future', () => {
    const weeks = computeHeatmapWeeks([], 4)
    const flat = weeks.flat()
    expect(flat.some(c => c.future)).toBe(true)
  })

  it('produces `weeks` columns of 7 days each', () => {
    const weeks = computeHeatmapWeeks([], 6)
    expect(weeks).toHaveLength(6)
    expect(weeks.every(col => col.length === 7)).toBe(true)
  })
})

describe('computeLanguageMix', () => {
  it('aggregates language counts across projects and computes percentages', () => {
    const projects = [
      { languages: [{ name: 'JavaScript', color: '#f1e05a', count: 3 }] },
      { languages: [{ name: 'JavaScript', color: '#f1e05a', count: 1 }, { name: 'Rust', color: '#dea584', count: 4 }] },
    ]
    const mix = computeLanguageMix(projects)
    // Both languages tie at count 4 — the sort is stable, so ties keep
    // first-seen order (JavaScript appears in the first project passed in).
    expect(mix).toEqual([
      { name: 'JavaScript', color: '#f1e05a', count: 4, pct: 50 },
      { name: 'Rust', color: '#dea584', count: 4, pct: 50 },
    ])
  })

  it('ignores projects with no detected languages', () => {
    expect(computeLanguageMix([{ }, { languages: [] }])).toEqual([])
  })

  it('handles an empty project list', () => {
    expect(computeLanguageMix([])).toEqual([])
    expect(computeLanguageMix(undefined)).toEqual([])
  })
})
