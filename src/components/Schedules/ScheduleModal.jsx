import { useState } from 'react'
import { hexToRgba } from '../../lib/todoPriorities.js'
import { NoteIcon2 } from '../../constants/SimpleSvgExports.jsx'

export default function ScheduleModal({ schedule, priorities, projects, notes, onSave, onClose }) {
  const isEdit = !!schedule
  const [title,       setTitle]       = useState(schedule?.title || '')
  const [description, setDescription] = useState(schedule?.description || '')
  const [priority,    setPriority]    = useState(schedule?.priority || priorities[Math.min(1, priorities.length - 1)]?.id || priorities[0]?.id)
  const [projectId,   setProjectId]   = useState(schedule?.projectId || '')
  const [dueDate,     setDueDate]     = useState(schedule?.dueDate || '')
  const [dueTime,     setDueTime]     = useState(schedule?.dueTime || '')
  const [noteIds,     setNoteIds]     = useState(schedule?.noteIds || [])

  const relevantNotes = projectId ? notes.filter(n => n.projectId === projectId || (noteIds || []).includes(n.id)) : notes

  const toggleNote = (id) => {
    setNoteIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleSave = () => {
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      description: description.trim(),
      priority,
      projectId: projectId || null,
      dueDate: dueDate || null,
      dueTime: dueTime || null,
      noteIds,
    })
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 480, maxHeight: '86vh', overflowY: 'auto',
          background: 'var(--surface)', border: '1px solid var(--border-bright)',
          borderRadius: 14, boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          animation: 'pmFadeDown 0.15s cubic-bezier(0.16,1,0.3,1) both',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{isEdit ? 'Edit Schedule' : 'New Schedule'}</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 10.5, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Title</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleSave() }}
              placeholder="e.g. Submit tax filing"
              style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', color: 'var(--text)', fontSize: 13, fontFamily: 'Geist, sans-serif', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 10.5, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional details..."
              rows={3}
              style={{ width: '100%', resize: 'vertical', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', color: 'var(--text)', fontSize: 12.5, fontFamily: 'Geist, sans-serif', outline: 'none', lineHeight: 1.5 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10.5, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Expiry date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', color: dueDate ? 'var(--text)' : 'var(--dimmer)', fontSize: 12, fontFamily: 'Geist Mono, monospace', outline: 'none', colorScheme: 'dark' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10.5, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Expiry time</label>
              <input
                type="time"
                value={dueTime}
                onChange={e => setDueTime(e.target.value)}
                disabled={!dueDate}
                style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', color: dueTime ? 'var(--text)' : 'var(--dimmer)', fontSize: 12, fontFamily: 'Geist Mono, monospace', outline: 'none', colorScheme: 'dark', opacity: dueDate ? 1 : 0.5 }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 10.5, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Priority</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {priorities.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPriority(p.id)}
                  style={{
                    padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 11, fontFamily: 'Geist Mono, monospace',
                    background: priority === p.id ? hexToRgba(p.color) : 'var(--card)',
                    color:      priority === p.id ? p.color : 'var(--dimmer)',
                    outline:    priority === p.id ? `1px solid ${p.color}40` : '1px solid var(--border)',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 10.5, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Project</label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--dim)', borderRadius: 7, padding: '7px 10px', fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: 'pointer', outline: 'none' }}
            >
              <option value="">No project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 10.5, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              Attach notes {noteIds.length > 0 && `(${noteIds.length})`}
            </label>
            {relevantNotes.length === 0 ? (
              <div style={{ fontSize: 11.5, color: 'var(--dimmer)', padding: '8px 0' }}>No notes available to attach yet.</div>
            ) : (
              <div style={{ maxHeight: 140, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--card)' }}>
                {relevantNotes.map(n => (
                  <label
                    key={n.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 12 }}
                  >
                    <input type="checkbox" checked={noteIds.includes(n.id)} onChange={() => toggleNote(n.id)} style={{ cursor: 'pointer' }} />
                    <NoteIcon2 />
                    <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button onClick={onClose} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={!title.trim()} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: title.trim() ? 'var(--accent)' : 'var(--border)', color: title.trim() ? '#000' : 'var(--dimmer)', fontSize: 12, fontWeight: 600, cursor: title.trim() ? 'pointer' : 'default', fontFamily: 'Geist, sans-serif' }}>
              {isEdit ? 'Save Changes' : 'Create Schedule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
