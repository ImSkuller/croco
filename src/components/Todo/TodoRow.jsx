import { useState } from 'react'
import { CheckIcon, TrashIcon, EditIcon } from '../../constants/SimpleSvgExports.jsx'
import RowBtn from './RowBtn.jsx'
import { DEFAULT_PRIORITIES, findPriority, hexToRgba, isTodoLocked } from '../../lib/todoPriorities.js'

// Actual component
export default function TodoRow({ todo, last, onToggle, onDelete, onEdit, editingId, editText, setEditText, onSaveEdit, editInputRef, priorities = DEFAULT_PRIORITIES }) {
  const [hovered,  setHovered]  = useState(false)
  const [expanded, setExpanded] = useState(false)
  const isEditing = editingId === todo.id
  const isLong    = todo.title.length > 55

  const isLockedCompleted = isTodoLocked(todo)

  const overdue = todo.dueDate && !todo.completed && new Date(todo.dueDate) < new Date()
  const dueStr  = todo.dueDate
    ? new Date(todo.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          12,
        padding:      '12px 16px',
        borderBottom: last ? 'none' : '1px solid var(--border)',
        background:   hovered ? 'var(--hover-bg)' : 'transparent',
        transition:   'background 0.1s',
        cursor:       'default',
      }}
    >
      {/* Checkbox */}
      <button
        onClick={() => !isLockedCompleted && onToggle(todo.id)}
        title={isLockedCompleted ? 'Completed more than 6 days ago — cannot be reversed' : undefined}
        style={{
          width: 18, height: 18, borderRadius: 5, flexShrink: 0,
          border:      todo.completed ? 'none' : '1px solid var(--border-bright)',
          background:  todo.completed ? 'var(--green)' : 'transparent',
          display:     'flex', alignItems: 'center', justifyContent: 'center',
          cursor:      isLockedCompleted ? 'not-allowed' : 'pointer',
          opacity:     isLockedCompleted ? 0.65 : 1,
          transition:  'all 0.15s',
        }}
      >
        {todo.completed && <CheckIcon />}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {isEditing ? (
          <input
            ref={editInputRef}
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onSaveEdit(todo.id); if (e.key === 'Escape') { onSaveEdit(todo.id) } }}
            onBlur={() => onSaveEdit(todo.id)}
            style={{ width: '100%', background: 'var(--border)', border: '1px solid var(--orange)', borderRadius: 5, padding: '3px 8px', color: 'var(--text)', fontSize: 13, fontFamily: 'Geist, sans-serif', outline: 'none' }}
          />
        ) : (
          <>
            <div
              onDoubleClick={() => !todo.completed && onEdit(todo)}
              style={{
                fontSize:       13,
                color:          todo.completed ? 'var(--dimmer)' : 'var(--text)',
                textDecoration: todo.completed ? 'line-through' : 'none',
                whiteSpace:     expanded ? 'normal' : 'nowrap',
                overflow:       expanded ? 'visible' : 'hidden',
                textOverflow:   expanded ? 'clip' : 'ellipsis',
                wordBreak:      expanded ? 'break-word' : 'normal',
                transition:     'all 0.12s',
              }}
            >
              {todo.title}
            </div>
            {isLong && !todo.completed && (
              <button
                onClick={e => { e.stopPropagation(); setExpanded(x => !x) }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 9, color: 'var(--dimmer)', padding: '1px 0',
                  fontFamily: 'Geist Mono, monospace',
                  display: 'flex', alignItems: 'center', gap: 2,
                  marginTop: 2, lineHeight: 1,
                }}
              >
                {expanded ? '▲ collapse' : '▼ show more'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Project tag */}
        {todo.project && (
          <span style={{ fontSize: 10, color: 'var(--blue)', fontFamily: 'Geist Mono, monospace', background: 'rgba(74,158,255,0.08)', padding: '2px 6px', borderRadius: 4 }}>
            {todo.project}
          </span>
        )}

        {/* Completion date (shown on completed todos) */}
        {todo.completed && todo.completedAt && (
          <span style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
            ✓ {new Date(todo.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}

        {/* Due date */}
        {dueStr && !todo.completed && (
          <span style={{
            fontSize: 10, fontFamily: 'Geist Mono, monospace',
            color:    overdue ? '#ff4444' : 'var(--dimmer)',
            background: overdue ? 'rgba(255,68,68,0.08)' : 'transparent',
            padding:  '2px 6px', borderRadius: 4,
          }}>
            {overdue ? '⚠ ' : ''}{dueStr}
          </span>
        )}

        {/* Priority */}
        {todo.priority && (() => {
          const p = findPriority(priorities, todo.priority)
          return (
            <span style={{
              fontSize: 10, fontFamily: 'Geist Mono, monospace',
              padding: '2px 6px', borderRadius: 4,
              background: todo.completed ? 'var(--border)' : hexToRgba(p.color, 0.12),
              color:      todo.completed ? 'var(--dimmer)' : p.color,
              opacity:    todo.completed ? 0.7 : 1,
            }}>
              {p.label}
            </span>
          )
        })()}

        {/* Actions (visible on hover) */}
        <div style={{ display: 'flex', gap: 3, opacity: hovered ? 1 : 0, transition: 'opacity 0.12s' }}>
          {!todo.completed && (
            <RowBtn title="Edit (or double-click)" onClick={() => onEdit(todo)}>
              <EditIcon />
            </RowBtn>
          )}
          <RowBtn title="Delete" danger onClick={() => onDelete(todo.id)}>
            <TrashIcon />
          </RowBtn>
        </div>
      </div>
    </div>
  )
}
