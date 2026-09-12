import { useState, useEffect, useCallback } from 'react'
import { useToast } from '../Toast/useToast.js'
import SettingsCard from '../Settings/SettingsCard'
import Spinner from '../ProjectDetail/Spinner'
import { IssueIcon, BranchIcon, PlusIcon, ExternalLinkIcon, RefreshIcon } from '../../constants/SimpleSvgExports'

const STATE_FILTERS = ['open', 'closed', 'all']

function StateBadge({ item, kind }) {
  const label = kind === 'pr'
    ? (item.merged ? 'merged' : item.draft ? 'draft' : item.state)
    : item.state
  const color = kind === 'pr'
    ? (item.merged ? '#a855f7' : item.state === 'open' ? '#4aff91' : '#ff4444')
    : (item.state === 'open' ? '#4aff91' : '#a855f7')
  return (
    <span style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', background: `${color}22`, color, padding: '1px 6px', borderRadius: 'var(--r-sm)', textTransform: 'uppercase' }}>
      {label}
    </span>
  )
}

const MERGE_METHODS = [
  { id: 'merge',  label: 'Merge'  },
  { id: 'squash', label: 'Squash' },
  { id: 'rebase', label: 'Rebase' },
]

function Row({ item, kind, projectId, onChanged }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [showComment, setShowComment] = useState(false)
  const [comment, setComment] = useState('')
  const [mergeMethod, setMergeMethod] = useState('merge')

  const run = async (fn, successMsg) => {
    setBusy(true)
    try {
      await fn()
      if (successMsg) toast.success(successMsg)
      onChanged()
    } catch (e) {
      toast.error('Action failed', e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const canClose = kind === 'issue' ? item.state === 'open' : (item.state === 'open' && !item.merged)
  const canReopen = kind === 'issue' && item.state === 'closed'
  const canMerge = kind === 'pr' && item.state === 'open' && !item.merged && !item.draft

  return (
    <SettingsCard style={{ margin: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ display: 'flex', color: 'var(--dimmer)', marginTop: 2 }}>
          {kind === 'pr' ? <BranchIcon /> : <IssueIcon />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{item.title}</span>
            <StateBadge item={item} kind={kind} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--dimmer)', marginTop: 4, fontFamily: 'Geist Mono, monospace' }}>
            #{item.number} by {item.author || 'unknown'}
            {kind === 'pr' && item.headBranch && ` — ${item.headBranch} → ${item.baseBranch}`}
          </div>
          {kind === 'issue' && (item.labels || []).length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
              {item.labels.map(l => (
                <span key={l.name} style={{ fontSize: 9, fontFamily: 'Geist Mono, monospace', padding: '1px 6px', borderRadius: 'var(--r-sm)', background: `#${l.color}22`, color: `#${l.color}` }}>
                  {l.name}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {kind === 'issue' && (
              <button onClick={() => setShowComment(v => !v)} disabled={busy}
                style={{ padding: '4px 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 11, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}>
                Comment
              </button>
            )}
            {canClose && (
              <button onClick={() => run(() => kind === 'issue'
                  ? window.api.github.setIssueState(projectId, item.number, 'closed')
                  : window.api.github.closePullRequest(projectId, item.number), 'Closed')}
                disabled={busy}
                style={{ padding: '4px 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', color: '#ff6b6b', fontSize: 11, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}>
                Close
              </button>
            )}
            {canReopen && (
              <button onClick={() => run(() => window.api.github.setIssueState(projectId, item.number, 'open'), 'Reopened')}
                disabled={busy}
                style={{ padding: '4px 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', color: '#4aff91', fontSize: 11, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}>
                Reopen
              </button>
            )}
            {canMerge && (
              <>
                <select value={mergeMethod} onChange={e => setMergeMethod(e.target.value)}
                  style={{ background: 'var(--base)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '4px 6px', fontSize: 11, color: 'var(--dim)', fontFamily: 'Geist Mono, monospace' }}>
                  {MERGE_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <button onClick={() => run(() => window.api.github.mergePullRequest(projectId, item.number, mergeMethod), 'Merged')}
                  disabled={busy}
                  style={{ padding: '4px 10px', borderRadius: 'var(--r-md)', border: 'none', background: '#a855f7', color: '#fff', fontSize: 11, fontWeight: 600, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}>
                  Merge
                </button>
              </>
            )}
          </div>

          {showComment && (
            <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
              <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} placeholder="Write a comment…"
                style={{ flex: 1, background: 'var(--base)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '7px 10px', fontSize: 12, color: 'var(--text)', fontFamily: 'Geist, sans-serif', outline: 'none', resize: 'vertical' }} />
              <button
                onClick={() => run(async () => {
                  await window.api.github.commentOnIssue(projectId, item.number, comment.trim())
                  setComment(''); setShowComment(false)
                }, 'Comment posted')}
                disabled={busy || !comment.trim()}
                style={{ padding: '0 14px', borderRadius: 'var(--r-md)', border: 'none', background: comment.trim() ? '#24292e' : 'var(--dimmer)', color: '#fff', fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: comment.trim() ? 'pointer' : 'not-allowed' }}>
                Post
              </button>
            </div>
          )}
        </div>
        {item.htmlUrl && (
          <button onClick={() => window.api.system.openExternal(item.htmlUrl)} title="Open on GitHub"
            style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', flexShrink: 0 }}>
            <ExternalLinkIcon />
          </button>
        )}
      </div>
    </SettingsCard>
  )
}

export default function IssuesPrsPanel({ projects }) {
  const toast = useToast()
  const [projectId, setProjectId] = useState(projects[0]?.id || '')
  const [tab,       setTab]       = useState('issues') // 'issues' | 'prs'
  const [stateFilter, setStateFilter] = useState('open')
  const [issues,    setIssues]    = useState([])
  const [prs,       setPrs]       = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)

  const [showCreate, setShowCreate] = useState(false)
  const [newTitle,   setNewTitle]   = useState('')
  const [newBody,    setNewBody]    = useState('')
  const [creating,   setCreating]   = useState(false)

  useEffect(() => {
    if (!projectId && projects[0]) Promise.resolve().then(() => setProjectId(projects[0].id))
  }, [projects, projectId])

  const project = projects.find(p => p.id === projectId) || null

  const load = useCallback(() => {
    if (!window.api || !projectId) return
    setLoading(true); setError(null)
    Promise.all([
      window.api.github.listIssues(projectId, stateFilter).catch(() => []),
      window.api.github.listPullRequests(projectId, stateFilter).catch(() => []),
    ]).then(([i, p]) => { setIssues(i || []); setPrs(p || []) })
      .catch(e => setError(e?.message || String(e)))
      .finally(() => setLoading(false))
  }, [projectId, stateFilter])

  useEffect(() => { Promise.resolve().then(load) }, [load])

  async function createIssue() {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      await window.api.github.createIssue(projectId, newTitle.trim(), newBody.trim())
      toast.success('Issue created', newTitle.trim())
      setShowCreate(false); setNewTitle(''); setNewBody('')
      load()
    } catch (e) {
      toast.error('Failed to create issue', e?.message || String(e))
    } finally {
      setCreating(false)
    }
  }

  if (!project) return null
  const list = tab === 'issues' ? issues : prs

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <select value={projectId} onChange={e => setProjectId(e.target.value)}
          style={{ background: 'var(--base)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '7px 10px', fontSize: 12, color: 'var(--text)', fontFamily: 'Geist, sans-serif' }}>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--border)', borderRadius: 'var(--r-md)' }}>
          {[{ id: 'issues', label: `Issues (${issues.length})` }, { id: 'prs', label: `Pull Requests (${prs.length})` }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: '5px 10px', borderRadius: 'var(--r-md)', border: 'none', cursor: 'pointer',
                fontSize: 11, fontFamily: 'Geist Mono, monospace',
                background: tab === t.id ? 'var(--card)' : 'transparent',
                color: tab === t.id ? 'var(--text)' : 'var(--dimmer)',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}
          style={{ background: 'var(--base)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '6px 9px', fontSize: 11, color: 'var(--dim)', fontFamily: 'Geist Mono, monospace' }}>
          {STATE_FILTERS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <button onClick={load} title="Refresh" disabled={loading}
          style={{ background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer', color: 'var(--dimmer)', display: 'flex', opacity: loading ? 0.5 : 1 }}>
          <RefreshIcon />
        </button>

        {tab === 'issues' && (
          <button onClick={() => setShowCreate(true)}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--r-md)', border: 'none', background: '#24292e', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
            <PlusIcon color="#fff" /> New Issue
          </button>
        )}
      </div>

      {loading && (
        <div style={{ fontSize: 12, color: 'var(--dimmer)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Spinner size={12} /> Loading…
        </div>
      )}
      {!loading && error && <div style={{ fontSize: 12, color: '#ff6b6b' }}>{error}</div>}
      {!loading && !error && list.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--dimmer)', padding: '20px 0' }}>No {stateFilter === 'all' ? '' : stateFilter} {tab === 'issues' ? 'issues' : 'pull requests'}.</div>
      )}

      {!loading && !error && list.map(item => (
        <Row key={item.id} item={item} kind={tab === 'issues' ? 'issue' : 'pr'} projectId={projectId} onChanged={load} />
      ))}

      {showCreate && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget && !creating) setShowCreate(false) }}
        >
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 24, maxWidth: 420, width: '90%', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <IssueIcon />
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>New Issue</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--dimmer)', marginBottom: 4 }}>Title</div>
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Something isn't working"
                  style={{ width: '100%', background: 'var(--base)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '8px 12px', fontSize: 13, color: 'var(--text)', fontFamily: 'Geist, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--dimmer)', marginBottom: 4 }}>Description (optional)</div>
                <textarea value={newBody} onChange={e => setNewBody(e.target.value)} rows={4}
                  style={{ width: '100%', background: 'var(--base)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '8px 12px', fontSize: 13, color: 'var(--text)', fontFamily: 'Geist, sans-serif', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowCreate(false)} disabled={creating}
                style={{ padding: '8px 16px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={createIssue} disabled={!newTitle.trim() || creating}
                style={{ padding: '8px 18px', borderRadius: 'var(--r-md)', border: 'none', background: newTitle.trim() && !creating ? '#24292e' : 'var(--dimmer)', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'Geist, sans-serif', cursor: newTitle.trim() && !creating ? 'pointer' : 'not-allowed' }}>
                {creating ? 'Creating…' : 'Create Issue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
