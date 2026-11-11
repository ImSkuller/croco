import { NoteIcon2, PinIcon } from '../../constants/SimpleSvgExports'
import { EmptyState } from '../ui/EmptyState'

export default function NotesTab({ navigate, pinnedNoteIds, project, projectNotes, togglePinNote }) {
  return (
    <div>
      <button
        onClick={() => navigate('/note-editor', { state: { projectId: project.id } })}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--r-md)', border: '1px dashed var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'Geist, sans-serif', marginBottom: 16, transition: 'all var(--transition-fast)' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--orange)'; e.currentTarget.style.color = 'var(--orange)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--dim)' }}
      >
        + New Note for this project
      </button>

      {projectNotes.length === 0 ? (
        <EmptyState compact icon={<NoteIcon2 size={24} />} title="No notes for this project yet" body="Click above to create one." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...projectNotes]
            .sort((a, b) => {
              const ap = pinnedNoteIds.includes(a.id) ? 0 : 1
              const bp = pinnedNoteIds.includes(b.id) ? 0 : 1
              return ap - bp
            })
            .map(note => {
              const pinned = pinnedNoteIds.includes(note.id)
              return (
                <div
                  key={note.id}
                  className="note-row"
                  onClick={() => navigate(`/note-editor/${note.id}`)}
                  style={{ background: pinned ? 'rgba(74,158,255,0.05)' : 'var(--card)', border: `1px solid ${pinned ? 'rgba(74,158,255,0.2)' : 'var(--border)'}`, borderRadius: 'var(--r-lg)', padding: '14px 16px', cursor: 'pointer', transition: 'all var(--transition-fast)', position: 'relative' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = pinned ? 'rgba(74,158,255,0.4)' : 'var(--border-bright)'; e.currentTarget.style.background = pinned ? 'rgba(74,158,255,0.08)' : 'var(--card-hover)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = pinned ? 'rgba(74,158,255,0.2)' : 'var(--border)'; e.currentTarget.style.background = pinned ? 'rgba(74,158,255,0.05)' : 'var(--card)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, display: 'flex', color: 'var(--dimmer)' }}>{note.emoji || <NoteIcon2 size={14} />}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.title}</span>
                    {pinned && <span style={{ fontSize: 9, color: 'var(--accent)', fontFamily: 'Geist Mono, monospace' }}>PINNED</span>}
                    <button
                      onClick={e => { e.stopPropagation(); togglePinNote(note.id) }}
                      title={pinned ? 'Unpin' : 'Pin to top'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', opacity: pinned ? 1 : 0, padding: '0 2px', color: pinned ? 'var(--accent)' : 'var(--dimmer)', flexShrink: 0, transition: 'opacity var(--transition-fast)' }}
                      className="note-pin-btn"
                    >
                      <PinIcon size={12} />
                    </button>
                    <span style={{ fontSize: 9, fontFamily: 'Geist Mono, monospace', color: 'var(--dimmer)', flexShrink: 0 }}>{note.time}</span>
                  </div>
                  {note.preview && (
                    <div style={{ fontSize: 11, color: 'var(--dimmer)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.preview}</div>
                  )}
                </div>
              )
            })
          }
        </div>
      )}
    </div>
  )
}
