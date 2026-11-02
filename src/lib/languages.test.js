import { describe, it, expect } from 'vitest'
import { aggregateLanguages, codeLanguagesOf, languagesNeedRefresh } from './languages.js'

const proj = langs => ({ languages: langs })

describe('aggregateLanguages', () => {
  it('weights by bytes, not by each project’s rounded percentage', () => {
    const big = proj([{ name: 'Rust', color: '#r', count: 3_000_000, pct: 100 }])
    const tiny = proj([{ name: 'JavaScript', color: '#j', count: 40, pct: 100 }])
    const mix = aggregateLanguages([big, tiny])
    expect(mix[0].name).toBe('Rust')
    expect(mix[0].pct).toBe(100)
    expect(mix.find(l => l.name === 'JavaScript').pct).toBe(0)
  })

  it('leaves out data and markup languages when a project has real code', () => {
    const p = proj([
      { name: 'JSON', count: 900, pct: 90 },
      { name: 'TypeScript', color: '#t', count: 100, pct: 10 },
    ])
    expect(aggregateLanguages([p]).map(l => l.name)).toEqual(['TypeScript'])
    expect(codeLanguagesOf(p)).toHaveLength(1)
  })

  it('keeps them for a project that has nothing else', () => {
    const docs = proj([{ name: 'Markdown', color: '#m', count: 50, pct: 100 }])
    expect(aggregateLanguages([docs]).map(l => l.name)).toEqual(['Markdown'])
  })

  it('merges the same language across projects and tolerates missing data', () => {
    const mix = aggregateLanguages([
      proj([{ name: 'Go', count: 10 }]),
      proj([{ name: 'Go', count: 30 }, { name: 'Python', count: 60 }]),
      {}, null,
    ])
    expect(mix.map(l => [l.name, l.count, l.pct])).toEqual([['Python', 60, 60], ['Go', 40, 40]])
  })
})

describe('languagesNeedRefresh', () => {
  const now = new Date('2026-11-02T00:00:00Z').getTime()
  it('refreshes caches that were never stamped or are older than 3 days', () => {
    expect(languagesNeedRefresh({}, now)).toBe(true)
    expect(languagesNeedRefresh({ languagesScannedAt: '2026-10-28T00:00:00Z' }, now)).toBe(true)
    expect(languagesNeedRefresh({ languagesScannedAt: '2026-11-01T00:00:00Z' }, now)).toBe(false)
    expect(languagesNeedRefresh({ languagesScannedAt: 'garbage' }, now)).toBe(true)
  })
})
