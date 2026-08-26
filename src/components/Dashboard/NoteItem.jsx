import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function NoteItem({ note }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={() => navigate(`/note-editor/${note.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: hovered ? 'var(--hover-bg)' : 'transparent', transition: 'background 0.1s' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>{note.emoji || '📝'}</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{note.title}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--dimmer)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 5 }}>{note.preview}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {note.project
          ? <span style={{ fontSize: 10, color: 'var(--blue)', fontFamily: 'Geist Mono, monospace' }}>{note.project}</span>
          : <span style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>general</span>
        }
        <span style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>{note.time}</span>
      </div>
    </div>
  )
}
