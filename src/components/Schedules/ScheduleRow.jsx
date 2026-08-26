import { useState } from 'react'
import { CheckIcon, TrashIcon, EditIcon, NoteIcon2 } from '../../constants/SimpleSvgExports.jsx'
import RowBtn from '../Todo/RowBtn.jsx'
import { findPriority, hexToRgba, isTodoLocked } from '../../lib/todoPriorities.js'
import { useNavigate } from 'react-router-dom'

function formatDueAt(dueDate, dueTime) {
  if (!dueDate) return null
  const d = new Date(dueTime ? `${dueDate}T${dueTime}` : dueDate)
  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return dueTime ? `${dateStr}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : dateStr
}

export default function ScheduleRow({ schedule, last, priorities, notesById, onToggle, onDelete, onEdit }) {
  const [hovered,  setHovered]  = useState(false)
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()

  const isLocked = isTodoLocked(schedule)
  const dueAtMs  = schedule.dueDate ? new Date(schedule.dueTime ? `${schedule.dueDate}T${schedule.dueTime}` : schedule.dueDate).getTime() : null
  const overdue  = dueAtMs && !schedule.completed && dueAtMs < new Date()
  const dueStr   = formatDueAt(schedule.dueDate, schedule.dueTime)
  const attachedNotes = (schedule.noteIds || []).map(id => notesById[id]).filter(Boolean)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '12px 16px',
        borderBottom: last ? 'none' : '1px solid var(--border)',
        background: hovered ? 'var(--hover-bg)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Checkbox */}
        <button
          onClick={() => !isLocked && onToggle(schedule.id)}
          title={isLocked ? 'Completed more than 6 days ago — cannot be reversed' : undefined}
          style={{
            width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
            border:      schedule.completed ? 'none' : '1px solid var(--border-bright)',
            background:  schedule.completed ? 'var(--green)' : 'transparent',
            display:     'flex', alignItems: 'center', justifyContent: 'center',
            cursor:      isLocked ? 'not-allowed' : 'pointer',
            opacity:     isLocked ? 0.65 : 1,
            transition:  'all 0.15s',
          }}
        >
          {schedule.completed && <CheckIcon />}
        </button>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span
              onDoubleClick={() => !schedule.completed && onEdit(schedule)}
              style={{
                fontSize: 13, fontWeight: 500,
                color: schedule.completed ? 'var(--dimmer)' : 'var(--text)',
                textDecoration: schedule.completed ? 'line-through' : 'none',
              }}
            >
              {schedule.title}
            </span>

            {schedule.project && (
              <span style={{ fontSize: 10, color: 'var(--blue)', fontFamily: 'Geist Mono, monospace', background: 'rgba(74,158,255,0.08)', padding: '2px 6px', borderRadius: 4 }}>
                {schedule.project}
              </span>
            )}

            {dueStr && (
              <span style={{
                fontSize: 10, fontFamily: 'Geist Mono, monospace',
                color:    overdue ? '#ff4444' : 'var(--dimmer)',
                background: overdue ? 'rgba(255,68,68,0.08)' : 'transparent',
                padding:  '2px 6px', borderRadius: 4,
              }}>
                {overdue ? '⚠ ' : '🕐 '}{dueStr}
              </span>
            )}

            {schedule.priority && (() => {
              const p = findPriority(priorities, schedule.priority)
              return (
                <span style={{
                  fontSize: 10, fontFamily: 'Geist Mono, monospace',
                  padding: '2px 6px', borderRadius: 4,
                  background: schedule.completed ? 'var(--border)' : hexToRgba(p.color, 0.12),
                  color:      schedule.completed ? 'var(--dimmer)' : p.color,
                  opacity:    schedule.completed ? 0.7 : 1,
                }}>
                  {p.label}
                </span>
              )
            })()}
          </div>

          {schedule.description && (
            <div
              onClick={() => setExpanded(x => !x)}
              style={{
                marginTop: 4, fontSize: 12, color: 'var(--dim)', lineHeight: 1.5, cursor: 'pointer',
                whiteSpace: expanded ? 'pre-wrap' : 'nowrap',
                overflow: expanded ? 'visible' : 'hidden',
                textOverflow: expanded ? 'clip' : 'ellipsis',
                maxWidth: expanded ? 'none' : 520,
              }}
            >
              {schedule.description}
            </div>
          )}

          {attachedNotes.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {attachedNotes.map(n => (
                <button
                  key={n.id}
                  onClick={() => navigate(`/note-editor/${n.id}`)}
                  title={`Open note: ${n.title}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 10, color: 'var(--purple)', background: 'rgba(180,140,242,0.08)',
                    border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer',
                    fontFamily: 'Geist Mono, monospace',
                  }}
                >
                  <NoteIcon2 /> {n.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 3, opacity: hovered ? 1 : 0, transition: 'opacity 0.12s', flexShrink: 0 }}>
          {!schedule.completed && (
            <RowBtn title="Edit" onClick={() => onEdit(schedule)}>
              <EditIcon />
            </RowBtn>
          )}
          <RowBtn title="Delete" danger onClick={() => onDelete(schedule.id)}>
            <TrashIcon />
          </RowBtn>
        </div>
      </div>
    </div>
  )
}
