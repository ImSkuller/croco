import { useState, useEffect, useMemo } from 'react'
import { useData, EMPTY_LIST } from '../../lib/store'
import SettingsCard from '../Settings/SettingsCard'
import Spinner from '../ProjectDetail/Spinner'
import WeeklyTrendCard from '../Patterns/WeeklyTrendCard'
import MonthlyTrendCard from './MonthlyTrendCard'
import YearlyTrendCard from './YearlyTrendCard'
import ProjectAttentionCard from '../Patterns/ProjectAttentionCard'
import { computeDateStreak } from '../../lib/habitInsights'

const RANGES = [
  { id: 'weekly',  label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly',  label: 'Yearly' },
]

// Activity dashboard — "Overall" reuses the already cross-project-aggregated
// commitDates from the personality profile (see Patterns.jsx); a single
// project instead fetches its own commit dates via git_get_commit_dates and
// dedupes them to one-per-day, matching the Overall profile's semantics so
// switching scope doesn't silently change what a "commit" bar means.
export default function InsightsPanel({ projects }) {
  const profile     = useData('personality')
  const allProjects = useData('projects') || EMPTY_LIST

  const [scope, setScope] = useState('overall') // 'overall' | projectId
  const [range, setRange] = useState('weekly')
  const [projectDates, setProjectDates] = useState(null)
  const [loadingDates, setLoadingDates] = useState(false)

  useEffect(() => {
    if (scope === 'overall' || !window.api) { Promise.resolve().then(() => setProjectDates(null)); return }
    Promise.resolve().then(() => setLoadingDates(true))
    window.api.git.getCommitDates(scope, 1000)
      .then(dates => setProjectDates([...new Set(dates)]))
      .catch(() => setProjectDates([]))
      .finally(() => setLoadingDates(false))
  }, [scope])

  const commitDates = scope === 'overall' ? (profile?.commitDates || []) : (projectDates || [])
  const streak = useMemo(() => computeDateStreak(commitDates), [commitDates])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <select value={scope} onChange={e => setScope(e.target.value)}
          style={{ background: 'var(--base)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: 'var(--text)', fontFamily: 'Geist, sans-serif' }}>
          <option value="overall">Overall (all projects)</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <div style={{ display: 'flex', gap: 4, background: 'var(--base)', border: '1px solid var(--border)', borderRadius: 7, padding: 3 }}>
          {RANGES.map(r => (
            <button key={r.id} onClick={() => setRange(r.id)}
              style={{
                padding: '5px 12px', borderRadius: 5, border: 'none', cursor: 'pointer',
                fontSize: 11, fontFamily: 'Geist, sans-serif', fontWeight: range === r.id ? 600 : 400,
                background: range === r.id ? 'var(--accent)' : 'transparent',
                color: range === r.id ? '#000' : 'var(--dim)',
              }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loadingDates ? (
        <div style={{ fontSize: 12, color: 'var(--dimmer)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Spinner size={12} /> Loading commit history…
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, alignContent: 'start' }}>
          {range === 'weekly'  && <WeeklyTrendCard  commitDates={commitDates} />}
          {range === 'monthly' && <MonthlyTrendCard commitDates={commitDates} />}
          {range === 'yearly'  && <YearlyTrendCard  commitDates={commitDates} />}

          <SettingsCard style={{ margin: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Commit Streak</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{streak.current}</span>
              <span style={{ fontSize: 11, color: 'var(--dimmer)' }}>day streak</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--dimmer)', marginTop: 4 }}>Longest: {streak.longest} days</div>
          </SettingsCard>

          {scope === 'overall' && (
            <ProjectAttentionCard projectStats={profile?.projectStats || {}} projects={allProjects} />
          )}
        </div>
      )}
    </div>
  )
}
