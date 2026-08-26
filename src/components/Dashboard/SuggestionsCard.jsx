import { useState, useMemo } from 'react'
import SectionHeader from './SectionHeader'
import { computeSuggestions } from '../../lib/suggestions'

// Suggestion ids are a small, bounded set (4 heuristics, at most 2 extra for
// neglected projects) — the dismissed-map never grows large enough to need
// active pruning; an expired snooze simply stops filtering anything out
// below, whether or not its stale key still lingers in localStorage.
const STORAGE_KEY = 'croco:dismissed-suggestions'
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000 // 3 days

function readDismissed() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} }
}

function writeDismissed(map) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)) } catch { /* localStorage unavailable — non-fatal */ }
}

const SEVERITY_COLOR = {
  warning: '#ff9944',
  info: 'var(--accent)',
}

function filterActive(suggestions, dismissed) {
  const now = Date.now()
  return suggestions.filter(s => !(dismissed[s.id] > now))
}

function withSnoozed(dismissed, id) {
  return { ...dismissed, [id]: Date.now() + SNOOZE_MS }
}

export default function SuggestionsCard({ profile, projects, todos }) {
  const [dismissed, setDismissed] = useState(readDismissed)

  const suggestions = useMemo(
    () => filterActive(computeSuggestions({ profile, projects, todos }), dismissed),
    [profile, projects, todos, dismissed]
  )

  const snooze = (id) => {
    const next = withSnoozed(dismissed, id)
    setDismissed(next)
    writeDismissed(next)
  }

  if (suggestions.length === 0) return null

  return (
    <div>
      <SectionHeader title="Suggestions" action="See patterns ›" link="/patterns" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {suggestions.map(s => (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: SEVERITY_COLOR[s.severity] || 'var(--dim)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{s.title}</div>
              <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>{s.body}</div>
            </div>
            <button
              onClick={() => snooze(s.id)}
              title="Remind me in 3 days"
              style={{
                flexShrink: 0, padding: '4px 10px', borderRadius: 7, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--dim)', fontSize: 11, cursor: 'pointer', fontFamily: 'Geist, sans-serif',
              }}
            >
              Remind later
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
