import { useState, useEffect, useCallback } from 'react'
import SettingsCard from '../Settings/SettingsCard'
import Spinner from '../ProjectDetail/Spinner'
import { ExternalLinkIcon, RefreshIcon, PlayIcon } from '../../constants/SimpleSvgExports'

// Read-only view of recent GitHub Actions runs for a linked project.
function runColor(run) {
  if (run.status !== 'completed') return '#ffd700'
  switch (run.conclusion) {
    case 'success':   return '#4aff91'
    case 'failure':   return '#ff4444'
    case 'timed_out': return '#ff4444'
    case 'cancelled': return 'var(--dimmer)'
    case 'skipped':   return 'var(--dimmer)'
    default:          return 'var(--dim)'
  }
}
function runLabel(run) {
  if (run.status !== 'completed') return run.status.replace('_', ' ')
  return run.conclusion || 'completed'
}
function ago(iso) {
  if (!iso) return ''
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function ActionsPanel({ projects }) {
  const [projectId, setProjectId] = useState(projects[0]?.id || '')
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!projectId && projects[0]) Promise.resolve().then(() => setProjectId(projects[0].id))
  }, [projects, projectId])

  const load = useCallback(() => {
    if (!window.api || !projectId) return
    setLoading(true); setError(null)
    window.api.github.listWorkflowRuns(projectId, 20)
      .then(r => setRuns(r || []))
      .catch(e => setError(e?.message || String(e)))
      .finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => { Promise.resolve().then(load) }, [load])

  const project = projects.find(p => p.id === projectId) || null
  if (!project) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <select value={projectId} onChange={e => setProjectId(e.target.value)}
          style={{ background: 'var(--base)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '7px 10px', fontSize: 12, color: 'var(--text)', fontFamily: 'Geist, sans-serif' }}>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={load} title="Refresh" disabled={loading}
          style={{ background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer', color: 'var(--dimmer)', display: 'flex', opacity: loading ? 0.5 : 1 }}>
          <RefreshIcon />
        </button>
        {project.github && (
          <button onClick={() => window.api.system.openExternal(`https://github.com/${project.github}/actions`)}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
            <ExternalLinkIcon size={12} /> All runs on GitHub
          </button>
        )}
      </div>

      {loading && (
        <div style={{ fontSize: 12, color: 'var(--dimmer)', display: 'flex', alignItems: 'center', gap: 8 }}><Spinner size={12} /> Loading…</div>
      )}
      {!loading && error && <div style={{ fontSize: 12, color: '#ff6b6b' }}>{error}</div>}
      {!loading && !error && runs.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--dimmer)', padding: '20px 0' }}>No workflow runs yet — this repo has no GitHub Actions history.</div>
      )}

      {!loading && !error && runs.map(run => (
        <SettingsCard key={run.id} style={{ margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: runColor(run), marginTop: 5, flexShrink: 0, boxShadow: run.status !== 'completed' ? '0 0 0 3px rgba(255,215,0,0.15)' : 'none' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{run.displayTitle || run.name}</span>
                <span style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', background: `${runColor(run)}22`, color: runColor(run), padding: '1px 6px', borderRadius: 'var(--r-sm)', textTransform: 'uppercase' }}>
                  {runLabel(run)}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--dimmer)', marginTop: 4, fontFamily: 'Geist Mono, monospace', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span><PlayIcon size={9} /> {run.name}</span>
                <span>#{run.runNumber}</span>
                {run.branch && <span>{run.branch}</span>}
                {run.headSha && <span>{run.headSha}</span>}
                <span>{run.event}</span>
                <span>{ago(run.updatedAt || run.createdAt)}</span>
              </div>
            </div>
            {run.htmlUrl && (
              <button onClick={() => window.api.system.openExternal(run.htmlUrl)} title="Open on GitHub"
                style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', flexShrink: 0 }}>
                <ExternalLinkIcon />
              </button>
            )}
          </div>
        </SettingsCard>
      ))}
    </div>
  )
}
