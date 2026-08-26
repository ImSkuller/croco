import { useState, useEffect, useCallback } from 'react'
import SettingsCard from '../Settings/SettingsCard'
import Spinner from '../ProjectDetail/Spinner'
import { RefreshIcon, ExternalLinkIcon } from '../../constants/SimpleSvgExports'

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    </div>
  )
}

// One GitHub-linked project's repo metadata — fetched on demand (mount +
// manual refresh) rather than an automatic background poll, to avoid
// burning API rate limits across every linked project at once.
export default function RepoInfoCard({ project }) {
  const [info,    setInfo]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(() => {
    if (!window.api) return
    setLoading(true); setError(null)
    window.api.github.getRepoInfo(project.id)
      .then(setInfo)
      .catch(e => setError(e?.message || String(e)))
      .finally(() => setLoading(false))
  }, [project.id])

  useEffect(() => { Promise.resolve().then(load) }, [load])

  return (
    <SettingsCard style={{ margin: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>{project.emoji || '📁'}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project.name}
        </span>
        <button onClick={load} title="Refresh" disabled={loading}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer', color: 'var(--dimmer)', display: 'flex', flexShrink: 0, opacity: loading ? 0.5 : 1 }}>
          <RefreshIcon />
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', marginTop: 2, marginBottom: 12 }}>
        {project.github}
      </div>

      {loading && (
        <div style={{ fontSize: 12, color: 'var(--dimmer)', display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
          <Spinner size={12} /> Loading…
        </div>
      )}

      {!loading && error && (
        <div style={{ fontSize: 12, color: '#ff6b6b' }}>{error}</div>
      )}

      {!loading && !error && info && (
        <>
          {info.description && (
            <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 12 }}>{info.description}</div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            <Stat label="Stars"  value={info.stars} />
            <Stat label="Forks"  value={info.forks} />
            <Stat label="Issues" value={info.openIssues} />
            <Stat label="PRs"    value={info.openPRs >= 0 ? info.openPRs : '—'} />
          </div>
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: '4px 8px', fontSize: 11, color: 'var(--dimmer)' }}>
            <span>⑂ {info.defaultBranch}</span>
            {info.language    && <span>· {info.language}</span>}
            {info.license     && <span>· {info.license}</span>}
            {info.visibility  && <span>· {info.visibility}</span>}
            {info.archived    && <span style={{ color: '#ff9944' }}>· archived</span>}
          </div>
          {info.htmlUrl && (
            <button
              onClick={() => window.api.system.openExternal(info.htmlUrl)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14, padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
              Open on GitHub <ExternalLinkIcon />
            </button>
          )}
        </>
      )}
    </SettingsCard>
  )
}
