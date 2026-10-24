import { useState, useMemo } from 'react'
import SettingsCard from '../Settings/SettingsCard'
import { TODO_RANGES, todoCompletionStats } from '../../lib/todoStats'

// Completion rate for a chosen window (today / 7 days / 30 days / 3 months /
// lifetime), computed from the live todos cache. The Dashboard only shows
// how many todos are open right now — the "how am I doing over time" view
// lives here.
export default function TodoCompletionCard({ todos }) {
  const [rangeId, setRangeId] = useState(() => {
    try { return localStorage.getItem('croco:patterns:todoRange') || 'weekly' } catch { return 'weekly' }
  })
  const range = TODO_RANGES.find(r => r.id === rangeId) || TODO_RANGES[1]
  const stats = useMemo(() => todoCompletionStats(todos, range), [todos, range])

  const pick = id => {
    setRangeId(id)
    try { localStorage.setItem('croco:patterns:todoRange', id) } catch { /* private mode */ }
  }

  return (
    <SettingsCard style={{ margin: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Todo Completion</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
        {TODO_RANGES.map(r => (
          <button
            key={r.id}
            onClick={() => pick(r.id)}
            style={{
              padding: '3px 8px', borderRadius: 'var(--r-sm)', fontSize: 10.5, cursor: 'pointer',
              fontFamily: 'Geist, sans-serif', border: '1px solid var(--border)',
              background: r.id === range.id ? 'var(--accent)' : 'transparent',
              color: r.id === range.id ? '#fff' : 'var(--dim)',
            }}
          >{r.label}</button>
        ))}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', marginTop: 12 }}>{stats.rate}%</div>
      <div style={{ height: 6, borderRadius: 'var(--r-sm)', background: 'var(--border)', marginTop: 8, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${stats.rate}%`, background: 'var(--accent)', borderRadius: 'var(--r-sm)' }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--dimmer)', marginTop: 8 }}>
        {stats.completed} completed · {stats.created} created · {stats.open} open now
      </div>
    </SettingsCard>
  )
}
