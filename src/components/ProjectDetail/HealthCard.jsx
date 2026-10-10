import { useState, useEffect, useCallback } from 'react'
import InfoSection from './InfoSection'
import { RefreshIcon } from '../../constants/SimpleSvgExports'

// One-glance project health: ahead/behind + uncommitted changes (both
// already fetched by ProjectDetail.jsx for the Git tab — reused here as
// props, not re-fetched, per CLAUDE.md's "debounce, don't poll" rule and
// to avoid a second ahead/behind network round trip for the same data),
// plus two new checks fetched once on mount and cached until the user
// explicitly hits refresh: stale local branches and outdated dependencies.
export default function HealthCard({ projectId, isRepo, gitStatus, aheadBehind }) {
  const [staleBranches, setStaleBranches] = useState(null) // null = not loaded yet
  const [outdatedDeps,  setOutdatedDeps]  = useState(null)
  // Starts true (the initial mount load is always in flight) rather than
  // being flipped on by a synchronous setState call from inside an
  // effect — only the manual "Recheck" button (a real event handler, not
  // an effect) sets it back to true for a reload.
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    if (!window.api || !projectId) return
    Promise.all([
      isRepo ? window.api.git.getStaleBranches(projectId).catch(() => []) : Promise.resolve([]),
      window.api.projects.checkOutdatedDeps(projectId).catch(() => ({ type: 'unsupported', outdatedCount: null })),
    ]).then(([stale, deps]) => {
      setStaleBranches(stale)
      setOutdatedDeps(deps)
    }).finally(() => setLoading(false))
  }, [projectId, isRepo])

  useEffect(() => { load() }, [load])

  const staleCount = staleBranches?.length ?? 0
  const uncommittedCount = gitStatus?.total ?? 0
  const ahead  = aheadBehind?.ahead  ?? 0
  const behind = aheadBehind?.behind ?? 0

  return (
    <InfoSection label="Project Health">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <HealthCell
          label="Uncommitted"
          value={isRepo ? uncommittedCount : '—'}
          tone={!isRepo ? 'neutral' : uncommittedCount === 0 ? 'good' : 'warn'}
        />
        <HealthCell
          label="Ahead / Behind"
          value={isRepo ? (aheadBehind?.unavailable ? 'n/a' : `${ahead} / ${behind}`) : '—'}
          tone={!isRepo || aheadBehind?.unavailable ? 'neutral' : (behind > 0 ? 'warn' : 'good')}
        />
        <HealthCell
          label="Stale branches"
          value={isRepo ? (staleBranches === null ? '…' : staleCount) : '—'}
          tone={!isRepo ? 'neutral' : staleCount === 0 ? 'good' : 'warn'}
          title={staleCount > 0 ? staleBranches.map(b => `${b.name}${b.merged ? ' (merged)' : b.daysSinceCommit != null ? ` (${b.daysSinceCommit}d old)` : ''}`).join('\n') : undefined}
        />
        <HealthCell
          label="Outdated deps"
          value={outdatedDeps?.type === 'unsupported' || outdatedDeps == null ? '—' : (outdatedDeps.outdatedCount ?? '…')}
          tone={outdatedDeps?.type === 'unsupported' || outdatedDeps == null ? 'neutral' : (outdatedDeps.outdatedCount > 0 ? 'warn' : 'good')}
        />
      </div>
      <button
        onClick={() => { setLoading(true); load() }}
        disabled={loading}
        title="Re-check stale branches and outdated dependencies"
        style={{
          display: 'flex', alignItems: 'center', gap: 5, marginTop: 8,
          background: 'none', border: 'none', color: 'var(--dimmer)', fontSize: 10,
          cursor: loading ? 'default' : 'pointer', padding: 0, opacity: loading ? 0.5 : 1,
          fontFamily: 'Geist Mono, monospace',
        }}
      >
        <RefreshIcon size={9} /> {loading ? 'Checking…' : 'Recheck'}
      </button>
    </InfoSection>
  )
}

function HealthCell({ label, value, tone, title }) {
  const color = tone === 'good' ? 'var(--green)' : tone === 'warn' ? 'var(--orange)' : 'var(--dimmer)'
  return (
    <div title={title} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '12px 14px' }}>
      <div style={{ fontSize: 20, fontWeight: 600, color, fontFamily: 'Geist Mono, monospace', letterSpacing: -0.5, lineHeight: 1, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 9.5, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    </div>
  )
}
