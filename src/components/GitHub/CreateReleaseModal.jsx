import { useState, useEffect } from 'react'
import { useToast } from '../Toast/useToast.js'

// Suggests the next patch version from the most recent tag (e.g. v1.2.3 -> v1.2.4).
// Returns '' (no suggestion) if the latest tag isn't plain semver-ish.
function suggestNextTag(tags) {
  const latest = tags[0]?.name
  if (!latest) return 'v1.0.0'
  const m = latest.match(/^(v?)(\d+)\.(\d+)\.(\d+)$/)
  if (!m) return ''
  const [, prefix, maj, min, patch] = m
  return `${prefix}${maj}.${min}.${Number(patch) + 1}`
}

function inputStyle(mono, extra = {}) {
  return {
    width: '100%', background: 'var(--base)', border: '1px solid var(--border)', borderRadius: 7,
    padding: '8px 12px', fontSize: 13, color: 'var(--text)',
    fontFamily: mono ? 'Geist Mono, monospace' : 'Geist, sans-serif',
    outline: 'none', boxSizing: 'border-box', ...extra,
  }
}

function Row({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--dimmer)', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  )
}

// Calls the GitHub Releases API directly (which auto-creates the remote tag
// if it doesn't exist) — a heavier, richer sibling to the plain "Create Tag"
// action in ReleasesTagsPanel, which only does a local `git tag` + push.
export default function CreateReleaseModal({ project, tags, onClose, onCreated }) {
  const toast = useToast()
  const [tagName,    setTagName]    = useState(suggestNextTag(tags))
  const [target,     setTarget]     = useState('main')
  const [name,       setName]       = useState('')
  const [body,       setBody]       = useState('')
  const [draft,      setDraft]      = useState(false)
  const [prerelease, setPrerelease] = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')

  // Prefill target branch + release notes (commits since the last tag) once,
  // on open — the user can still freely edit both before publishing.
  useEffect(() => {
    if (!window.api) return
    window.api.git.status(project.id).then(s => {
      if (s?.branch) setTarget(s.branch)
    }).catch(() => {})
    window.api.git.getCommitsBetween(project.id, tags[0]?.name || null, 'HEAD')
      .then(commits => {
        if (commits?.length) setBody(commits.map(c => `- ${c.message}`).join('\n'))
      }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  async function submit() {
    if (!tagName.trim()) return
    setLoading(true); setError('')
    try {
      const result = await window.api.github.createRelease(project.id, {
        tagName: tagName.trim(),
        target: target.trim() || 'main',
        name: name.trim() || tagName.trim(),
        body, draft, prerelease,
      })
      toast.success('Release published', tagName.trim())
      onCreated?.(result)
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget && !loading) onClose() }}
    >
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, maxWidth: 480, width: '90%', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Create Release</span>
          <span style={{ fontSize: 12, color: 'var(--dimmer)' }}>{project.name}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Row label="Tag">
            <input value={tagName} onChange={e => setTagName(e.target.value)} placeholder="v1.0.0" style={inputStyle(true)} />
          </Row>
          <Row label="Target branch">
            <input value={target} onChange={e => setTarget(e.target.value)} style={inputStyle(true)} />
          </Row>
          <Row label="Title (optional)">
            <input value={name} onChange={e => setName(e.target.value)} placeholder={tagName || 'Release title'} style={inputStyle(false)} />
          </Row>
          <Row label="Release notes">
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={8} style={inputStyle(false, { resize: 'vertical' })} />
          </Row>
          <div style={{ display: 'flex', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--dim)', cursor: 'pointer' }}>
              <input type="checkbox" checked={draft} onChange={e => setDraft(e.target.checked)} /> Draft
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--dim)', cursor: 'pointer' }}>
              <input type="checkbox" checked={prerelease} onChange={e => setPrerelease(e.target.checked)} /> Pre-release
            </label>
          </div>
          {error && (
            <div style={{ fontSize: 11, color: '#ff5555', background: 'rgba(255,68,68,0.07)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: 6, padding: '8px 12px', fontFamily: 'Geist Mono, monospace' }}>
              {error}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} disabled={loading}
            style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={submit} disabled={!tagName.trim() || loading}
            style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: tagName.trim() && !loading ? '#24292e' : 'var(--dimmer)', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'Geist, sans-serif', cursor: tagName.trim() && !loading ? 'pointer' : 'not-allowed' }}>
            {loading ? 'Publishing…' : 'Publish Release'}
          </button>
        </div>
      </div>
    </div>
  )
}
