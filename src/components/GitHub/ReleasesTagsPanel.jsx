import { useState, useEffect, useCallback } from 'react'
import { useToast } from '../Toast/useToast.js'
import SettingsCard from '../Settings/SettingsCard'
import Spinner from '../ProjectDetail/Spinner'
import { TagIcon, PlusIcon, ExternalLinkIcon, RefreshIcon } from '../../constants/SimpleSvgExports'
import CreateReleaseModal from './CreateReleaseModal'

function Badge({ label, color }) {
  return (
    <span style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', background: `${color}22`, color, padding: '1px 6px', borderRadius: 4 }}>
      {label}
    </span>
  )
}

// Merges local git tags with their matching GitHub release (if any) into one
// timeline — a tag with no release is still shown (lightweight tags, or
// tags pushed without ever creating a release).
function mergeTagsAndReleases(tags, releases) {
  const byTag = new Map(releases.map(r => [r.tagName, r]))
  return tags
    .map(t => ({ name: t.name, date: byTag.get(t.name)?.publishedAt || t.date, release: byTag.get(t.name) || null }))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
}

export default function ReleasesTagsPanel({ projects }) {
  const toast = useToast()
  const [projectId, setProjectId] = useState(projects[0]?.id || '')
  const [tags,     setTags]     = useState([])
  const [releases, setReleases] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const [showCreateTag,     setShowCreateTag]     = useState(false)
  const [showCreateRelease, setShowCreateRelease] = useState(false)
  const [tagName,    setTagName]    = useState('')
  const [tagMessage, setTagMessage] = useState('')
  const [creatingTag, setCreatingTag] = useState(false)

  useEffect(() => {
    if (!projectId && projects[0]) Promise.resolve().then(() => setProjectId(projects[0].id))
  }, [projects, projectId])

  const project = projects.find(p => p.id === projectId) || null

  const load = useCallback(() => {
    if (!window.api || !projectId) return
    setLoading(true); setError(null)
    Promise.all([
      window.api.git.listTags(projectId),
      window.api.github.listReleases(projectId).catch(() => []),
    ]).then(([t, r]) => { setTags(t || []); setReleases(r || []) })
      .catch(e => setError(e?.message || String(e)))
      .finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => { Promise.resolve().then(load) }, [load])

  async function createTag() {
    if (!tagName.trim()) return
    setCreatingTag(true)
    try {
      await window.api.git.createTag(projectId, tagName.trim(), tagMessage.trim())
      toast.success('Tag created', tagName.trim())
      setShowCreateTag(false); setTagName(''); setTagMessage('')
      load()
    } catch (e) {
      toast.error('Failed to create tag', e?.message || String(e))
    } finally {
      setCreatingTag(false)
    }
  }

  if (!project) return null
  const merged = mergeTagsAndReleases(tags, releases)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <select value={projectId} onChange={e => setProjectId(e.target.value)}
          style={{ background: 'var(--base)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: 'var(--text)', fontFamily: 'Geist, sans-serif' }}>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={load} title="Refresh" disabled={loading}
          style={{ background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer', color: 'var(--dimmer)', display: 'flex', opacity: loading ? 0.5 : 1 }}>
          <RefreshIcon />
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => setShowCreateTag(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
            <TagIcon /> Create Tag
          </button>
          <button onClick={() => setShowCreateRelease(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, border: 'none', background: '#24292e', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
            <PlusIcon color="#fff" /> Create Release
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ fontSize: 12, color: 'var(--dimmer)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Spinner size={12} /> Loading…
        </div>
      )}
      {!loading && error && <div style={{ fontSize: 12, color: '#ff6b6b' }}>{error}</div>}
      {!loading && !error && merged.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--dimmer)', padding: '20px 0' }}>No tags or releases yet.</div>
      )}

      {!loading && !error && merged.map(item => (
        <SettingsCard key={item.name} style={{ margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <TagIcon />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'Geist Mono, monospace' }}>{item.name}</span>
            {item.release?.draft && <Badge label="draft" color="var(--dimmer)" />}
            {item.release?.prerelease && <Badge label="pre-release" color="#ffd700" />}
            {item.date && <span style={{ fontSize: 11, color: 'var(--dimmer)', marginLeft: 'auto' }}>{new Date(item.date).toLocaleDateString()}</span>}
          </div>
          {item.release?.name && item.release.name !== item.name && (
            <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 8 }}>{item.release.name}</div>
          )}
          {item.release?.body && (
            <div style={{ fontSize: 11, color: 'var(--dimmer)', marginTop: 8, whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto', fontFamily: 'Geist Mono, monospace' }}>
              {item.release.body}
            </div>
          )}
          {item.release?.htmlUrl && (
            <button onClick={() => window.api.system.openExternal(item.release.htmlUrl)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 11, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
              View release <ExternalLinkIcon />
            </button>
          )}
        </SettingsCard>
      ))}

      {showCreateTag && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget && !creatingTag) setShowCreateTag(false) }}
        >
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, maxWidth: 380, width: '90%', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <TagIcon />
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Create Tag</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--dimmer)', marginBottom: 4 }}>Tag name</div>
                <input value={tagName} onChange={e => setTagName(e.target.value)} placeholder="v1.0.0"
                  style={{ width: '100%', background: 'var(--base)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 13, color: 'var(--text)', fontFamily: 'Geist Mono, monospace', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--dimmer)', marginBottom: 4 }}>Message (optional)</div>
                <input value={tagMessage} onChange={e => setTagMessage(e.target.value)}
                  style={{ width: '100%', background: 'var(--base)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 13, color: 'var(--text)', fontFamily: 'Geist, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowCreateTag(false)} disabled={creatingTag}
                style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={createTag} disabled={!tagName.trim() || creatingTag}
                style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: tagName.trim() && !creatingTag ? '#24292e' : 'var(--dimmer)', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'Geist, sans-serif', cursor: tagName.trim() && !creatingTag ? 'pointer' : 'not-allowed' }}>
                {creatingTag ? 'Creating…' : 'Create Tag'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateRelease && (
        <CreateReleaseModal
          project={project}
          tags={tags}
          onClose={() => setShowCreateRelease(false)}
          onCreated={() => { setShowCreateRelease(false); load() }}
        />
      )}
    </div>
  )
}
