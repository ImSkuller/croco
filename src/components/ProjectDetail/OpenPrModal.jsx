import { useState, useEffect } from 'react'
import { BranchIcon, XCircleIcon } from '../../constants/SimpleSvgExports'
import { TextInput } from '../Settings/Exports'
import { useToast } from '../Toast/useToast.js'

// "Open a Pull Request" for the branch currently checked out — the backend
// command (github_create_pull_request) predates this UI. Base defaults to
// the repo's real default branch from the GitHub API, falling back to the
// Settings → Defaults branch if that lookup fails (offline, no token).
export default function OpenPrModal({ projectId, headBranch, fallbackBase, onClose }) {
  const toast = useToast()
  const [title, setTitle] = useState(headBranch.replace(/[-_/]+/g, ' '))
  const [body,  setBody]  = useState('')
  const [base,  setBase]  = useState(fallbackBase || 'main')
  const [draft, setDraft] = useState(false)
  const [busy,  setBusy]  = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null) // { url, number }

  useEffect(() => {
    let cancelled = false
    window.api?.github.getRepoInfo(projectId)
      .then(info => { if (!cancelled && info?.defaultBranch) setBase(info.defaultBranch) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [projectId])

  const sameBranch = base.trim() === headBranch
  const canSubmit = title.trim() && base.trim() && !sameBranch && !busy

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true); setError('')
    try {
      const r = await window.api.github.createPullRequest(projectId, title.trim(), headBranch, base.trim(), body, draft)
      setResult(r)
      toast.success(draft ? 'Draft PR opened' : 'Pull request opened', `#${r.number}`)
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const inputStyle = { width: '100%', background: 'var(--base)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '8px 12px', fontSize: 13, color: 'var(--text)', fontFamily: 'Geist, sans-serif', outline: 'none', boxSizing: 'border-box' }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget && !busy) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div className="glass-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 24, maxWidth: 480, width: '90%', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <BranchIcon />
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Open a Pull Request</span>
        </div>

        {result ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>Opened <span style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--accent)' }}>#{result.number}</span> — <span style={{ fontFamily: 'Geist Mono, monospace' }}>{headBranch}</span> → <span style={{ fontFamily: 'Geist Mono, monospace' }}>{base}</span></div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}>Close</button>
              {result.url && (
                <button onClick={() => window.api.system.openExternal(result.url)} style={{ padding: '8px 16px', borderRadius: 'var(--r-md)', border: 'none', background: '#24292e', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}>View on GitHub</button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--dim)', fontFamily: 'Geist Mono, monospace' }}>
                <span style={{ color: 'var(--text)' }}>{headBranch}</span>
                <span>→</span>
                <input value={base} onChange={e => setBase(e.target.value)} style={{ ...inputStyle, width: 160, padding: '4px 8px', fontSize: 12, fontFamily: 'Geist Mono, monospace' }} />
              </div>
              {sameBranch && <div style={{ fontSize: 11, color: '#ff6b6b' }}>Base and head are the same branch — pick a different base.</div>}
              <div>
                <div style={{ fontSize: 11, color: 'var(--dimmer)', marginBottom: 4 }}>Title</div>
                <TextInput value={title} onChange={setTitle} placeholder="What does this change?" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--dimmer)', marginBottom: 4 }}>Description (optional, markdown)</div>
                <textarea value={body} onChange={e => setBody(e.target.value)} rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--dim)', cursor: 'pointer' }}>
                <input type="checkbox" checked={draft} onChange={e => setDraft(e.target.checked)} /> Open as draft
              </label>
              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ff6b6b' }}>
                  <XCircleIcon size={12} /> {error}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={onClose} disabled={busy} style={{ padding: '8px 16px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}>Cancel</button>
              <button onClick={submit} disabled={!canSubmit} style={{ padding: '8px 18px', borderRadius: 'var(--r-md)', border: 'none', background: canSubmit ? '#24292e' : 'var(--dimmer)', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'Geist, sans-serif', cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
                {busy ? 'Opening…' : draft ? 'Open Draft PR' : 'Open Pull Request'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
