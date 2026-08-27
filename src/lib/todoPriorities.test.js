import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PRIORITIES,
  normalizePriorities,
  isTodoLocked,
  hexToRgba,
  findPriority,
  slugifyPriorityId,
} from './todoPriorities'

describe('normalizePriorities', () => {
  it('returns defaults when given nothing', () => {
    expect(normalizePriorities(undefined)).toBe(DEFAULT_PRIORITIES)
    expect(normalizePriorities(null)).toBe(DEFAULT_PRIORITIES)
  })

  it('returns defaults for an empty list', () => {
    expect(normalizePriorities([])).toBe(DEFAULT_PRIORITIES)
  })

  it('returns defaults when not an array', () => {
    expect(normalizePriorities('nonsense')).toBe(DEFAULT_PRIORITIES)
  })

  it('keeps a valid custom list as-is', () => {
    const custom = [{ id: 'urgent', label: 'Urgent', color: '#ff0000' }]
    expect(normalizePriorities(custom)).toEqual(custom)
  })

  it('filters out malformed entries but keeps valid ones', () => {
    const mixed = [
      { id: 'ok', label: 'OK', color: '#fff' },
      { id: '', label: 'Missing id' },
      { label: 'No id field' },
      { id: 'no-label', label: '' },
      null,
    ]
    expect(normalizePriorities(mixed)).toEqual([{ id: 'ok', label: 'OK', color: '#fff' }])
  })

  it('falls back to defaults if every entry is malformed', () => {
    expect(normalizePriorities([{ id: '' }, null])).toBe(DEFAULT_PRIORITIES)
  })
})

describe('isTodoLocked', () => {
  it('is false for an incomplete todo', () => {
    expect(isTodoLocked({ completed: false, completedAt: null })).toBe(false)
  })

  it('is false for a todo completed recently', () => {
    const justNow = new Date().toISOString()
    expect(isTodoLocked({ completed: true, completedAt: justNow })).toBe(false)
  })

  it('is true for a todo completed more than 6 days ago', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    expect(isTodoLocked({ completed: true, completedAt: eightDaysAgo })).toBe(true)
  })

  it('is false for a todo completed just under 6 days ago', () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    expect(isTodoLocked({ completed: true, completedAt: fiveDaysAgo })).toBe(false)
  })

  it('handles a null todo gracefully', () => {
    expect(isTodoLocked(null)).toBe(false)
    expect(isTodoLocked(undefined)).toBe(false)
  })
})

describe('hexToRgba', () => {
  it('converts a 6-digit hex to rgba with the given alpha', () => {
    expect(hexToRgba('#ff4444', 0.5)).toBe('rgba(255,68,68,0.5)')
  })

  it('expands a 3-digit shorthand hex', () => {
    expect(hexToRgba('#f44', 0.5)).toBe('rgba(255,68,68,0.5)')
  })

  it('defaults alpha to 0.12', () => {
    expect(hexToRgba('#000000')).toBe('rgba(0,0,0,0.12)')
  })

  it('falls back to a neutral grey for missing input', () => {
    expect(hexToRgba(undefined)).toBe('rgba(136,136,136,0.12)')
  })
})

describe('findPriority', () => {
  it('finds an existing priority by id', () => {
    expect(findPriority(DEFAULT_PRIORITIES, 'high')).toEqual(DEFAULT_PRIORITIES[0])
  })

  it('returns a synthetic fallback for an unknown id', () => {
    expect(findPriority(DEFAULT_PRIORITIES, 'urgent')).toEqual({ id: 'urgent', label: 'urgent', color: '#888888' })
  })

  it('handles a null/undefined priorities list', () => {
    expect(findPriority(null, 'high')).toEqual({ id: 'high', label: 'high', color: '#888888' })
  })
})

describe('slugifyPriorityId', () => {
  it('slugifies a simple label', () => {
    expect(slugifyPriorityId('Urgent', [])).toBe('urgent')
  })

  it('slugifies punctuation and spaces into single hyphens', () => {
    expect(slugifyPriorityId('Super Urgent!!', [])).toBe('super-urgent')
  })

  it('disambiguates against an existing id with a numeric suffix', () => {
    const existing = [{ id: 'urgent' }]
    expect(slugifyPriorityId('Urgent', existing)).toBe('urgent-2')
  })

  it('keeps incrementing the suffix until it finds a free id', () => {
    const existing = [{ id: 'urgent' }, { id: 'urgent-2' }, { id: 'urgent-3' }]
    expect(slugifyPriorityId('Urgent', existing)).toBe('urgent-4')
  })

  it('falls back to "priority" for an empty/symbol-only label', () => {
    expect(slugifyPriorityId('!!!', [])).toBe('priority')
  })
})
