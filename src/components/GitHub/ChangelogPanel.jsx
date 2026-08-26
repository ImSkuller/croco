import { useState, useEffect, useCallback } from 'react'
import SettingsCard from '../Settings/SettingsCard'
import Spinner from '../ProjectDetail/Spinner'
import DiffView from '../ProjectDetail/DiffView'
import { authorColor, initials } from '../../lib/projectDetailHelpers'

function selectStyle() {
  return { background: 'var(--base)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: 'var(--text)', fontFamily: 'Geist Mono, monospace', minWidth: 140 }
}

// Compares any two refs (tags or branches) for a linked project — the
// "view changes from a previous version" feature. Diff rendering is reused
// from DiffView (the same component GitPanel uses for per-file diffs).
export default function ChangelogPanel({ projects }) {
  const [projectId, setProjectId] = useState(projects[0]?.id || '')
  const [tags,     setTags]     = useState([])
  const [branches, setBranches] = useState([])
  const [fromRef,  setFromRef]  = useState('')
  const [toRef,    setToRef]    = useState('')
  const [loadingRefs, setLoadingRefs] = useState(true)

  const [commits, setCommits] = useState(null)
  const [diff,    setDiff]    = useState('')
  const [comparing, setComparing] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!projectId && projects[0]) Promise.resolve().then(() => setProjectId(projects[0].id))
  }, [projects, projectId])

  useEffect(() => {
    if (!window.api || !projectId) return
    Promise.resolve().then(() => { setLoadingRefs(true); setCommits(null); setDiff(''); setError(null) })
    Promise.all([
      window.api.git.listTags(projectId),
      window.api.git.getBranches(projectId),
    ]).then(([t, b]) => {
      setTags(t || []); setBranches(b || [])
      setFromRef(t?.[0]?.name || '')
      setToRef(b?.find(x => x.current)?.name || 'HEAD')
    }).catch(e => setError(e?.message || String(e)))
      .finally(() => setLoadingRefs(false))
  }, [projectId])

  const compare = useCallback(() => {
    if (!window.api || !projectId || !fromRef || !toRef) {
      setError('Select both a "From" and "To" ref')
      return
    }
    setComparing(true); setError(null)
    Promise.all([
      window.api.git.getCommitsBetween(projectId, fromRef, toRef),
      window.api.git.diffBetweenRefs(projectId, fromRef, toRef),
    ]).then(([c, d]) => { setCommits(c || []); setDiff(d?.diff || '') })
      .catch(e => setError(e?.message || String(e)))
      .finally(() => setComparing(false))
  }, [projectId, fromRef, toRef])

  const refOptions = [...tags.map(t => t.name), ...branches.map(b => b.name)]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 820 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <select value={projectId} onChange={e => setProjectId(e.target.value)} style={{ ...selectStyle(), fontFamily: 'Geist, sans-serif' }}>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <span style={{ fontSize: 11, color: 'var(--dimmer)' }}>From</span>
        <select value={fromRef} onChange={e => setFromRef(e.target.value)} disabled={loadingRefs} style={selectStyle()}>
          <option value="">— select —</option>
          {refOptions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <span style={{ fontSize: 11, color: 'var(--dimmer)' }}>To</span>
        <select value={toRef} onChange={e => setToRef(e.target.value)} disabled={loadingRefs} style={selectStyle()}>
          <option value="HEAD">HEAD</option>
          {refOptions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <button onClick={compare} disabled={loadingRefs || comparing || !fromRef || !toRef}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: 'none', background: (!loadingRefs && !comparing && fromRef && toRef) ? 'var(--orange)' : 'var(--dimmer)', color: '#000', fontSize: 12, fontWeight: 600, cursor: (!loadingRefs && !comparing && fromRef && toRef) ? 'pointer' : 'not-allowed', fontFamily: 'Geist, sans-serif' }}>
          {comparing ? 'Comparing…' : 'Compare'}
        </button>
      </div>

      {error && <div style={{ fontSize: 12, color: '#ff6b6b' }}>{error}</div>}

      {comparing && (
        <div style={{ fontSize: 12, color: 'var(--dimmer)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Spinner size={12} /> Comparing {fromRef}…{toRef}
        </div>
      )}

      {!comparing && commits && (
        <>
          <SettingsCard style={{ margin: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Commits ({commits.length})
            </div>
            {commits.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--dimmer)', padding: '10px 0' }}>No commits between these refs.</div>
            ) : commits.map(c => (
              <div key={c.hash} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                  background: authorColor(c.author || ''),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 7, fontWeight: 800, color: '#000',
                }}>{initials(c.author || '')}</div>
                <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'var(--orange)', flexShrink: 0, paddingTop: 2 }}>{c.hash}</span>
                <span style={{ fontSize: 12, color: 'var(--text)', flex: 1, lineHeight: 1.4 }}>{c.message}</span>
                <span style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', flexShrink: 0 }}>{c.date}</span>
              </div>
            ))}
          </SettingsCard>

          <SettingsCard style={{ margin: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Full Diff</div>
            <div style={{ marginLeft: -70 }}>
              <DiffView loading={false} text={diff} />
            </div>
          </SettingsCard>
        </>
      )}
    </div>
  )
}
