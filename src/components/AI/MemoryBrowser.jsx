import { useState, useEffect, useCallback } from 'react'
import { PlusCircleIcon, EditIcon, TrashIcon } from '../../constants/SimpleSvgExports'
import { useToast } from '../Toast/useToast.js'

const EMPTY_DRAFT = { title: '', body: '', tags: '', importance: 3 }

// Shared list+editor for both Memories and Encyclopedia — same shape,
// different backend namespace (kind: 'memory' | 'encyclopedia'). Every
// entry really is a .md file on disk (ai_brain.rs) — this is just a form
// over that file's frontmatter + body.
export default function MemoryBrowser({ kind }) {
  const toast = useToast()
  const api = window.api?.ai?.brain
  const [entries, setEntries] = useState(null)
  const [editingId, setEditingId] = useState(null) // null = not editing, 'new' = creating
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    if (!api) return
    const fn = kind === 'memory' ? api.memoryList : api.encyclopediaList
    fn().then(setEntries).catch(() => setEntries([]))
  }, [api, kind])

  useEffect(() => { load() }, [load])

  const startEdit = async (entry) => {
    const getFn = kind === 'memory' ? api.memoryGet : api.encyclopediaGet
    const full = await getFn(entry.id).catch(() => null)
    if (!full) return
    setDraft({ title: full.title, body: full.body, tags: (full.tags || []).join(', '), importance: full.importance })
    setEditingId(entry.id)
  }

  const startNew = () => { setDraft(EMPTY_DRAFT); setEditingId('new') }

  const save = async () => {
    if (!draft.title.trim() || !api) return
    setSaving(true)
    const tags = draft.tags.split(',').map(t => t.trim()).filter(Boolean)
    try {
      if (editingId === 'new') {
        if (kind === 'memory') await api.memoryCreate(draft.title, draft.body, null, tags, draft.importance)
        else await api.encyclopediaCreate(draft.title, draft.body, tags, draft.importance)
      } else {
        const updateFn = kind === 'memory' ? api.memoryUpdate : api.encyclopediaUpdate
        await updateFn(editingId, { title: draft.title, body: draft.body, tags, importance: draft.importance })
      }
      setEditingId(null)
      load()
      toast.success(kind === 'memory' ? 'Memory saved' : 'Encyclopedia entry saved')
    } catch (e) {
      toast.error('Could not save', e.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    const delFn = kind === 'memory' ? api.memoryDelete : api.encyclopediaDelete
    await delFn(id).catch(() => {})
    load()
  }

  if (editingId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640 }}>
        <input
          value={draft.title}
          onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
          placeholder="Title"
          style={{ background: 'var(--base)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text)', fontFamily: 'Geist, sans-serif' }}
        />
        <textarea
          value={draft.body}
          onChange={e => setDraft(d => ({ ...d, body: e.target.value }))}
          placeholder="Write it as markdown — this is exactly what gets saved to the .md file."
          rows={10}
          style={{ background: 'var(--base)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text)', fontFamily: 'Geist Mono, monospace', resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            value={draft.tags}
            onChange={e => setDraft(d => ({ ...d, tags: e.target.value }))}
            placeholder="tags, comma, separated"
            style={{ flex: 1, background: 'var(--base)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--text)', fontFamily: 'Geist Mono, monospace' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--dim)' }}>
            Importance
            <select
              value={draft.importance}
              onChange={e => setDraft(d => ({ ...d, importance: Number(e.target.value) }))}
              style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px' }}
            >
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={save} disabled={saving} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#000', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => setEditingId(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={startNew}
        style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 12, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}
      >
        <PlusCircleIcon size={13} /> New {kind === 'memory' ? 'Memory' : 'Entry'}
      </button>

      {entries === null ? (
        <div style={{ fontSize: 12, color: 'var(--dimmer)' }}>Loading…</div>
      ) : entries.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--dimmer)' }}>Nothing here yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).map(e => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{e.title}</div>
                <div style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', marginTop: 2 }}>
                  {(e.tags || []).join(', ') || 'no tags'} · importance {e.importance}/5
                </div>
              </div>
              <button onClick={() => startEdit(e)} title="Edit" style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)' }}><EditIcon size={14} /></button>
              <button onClick={() => remove(e.id)} title="Delete" style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)' }}><TrashIcon size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
