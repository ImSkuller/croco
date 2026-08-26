import { useState } from 'react'
import { TrashIcon, DragIcon } from '../../constants/SimpleSvgExports.jsx'
import { hexToRgba } from '../../lib/todoPriorities.js'

const NEW_PRIORITY_COLORS = ['#ff4444', '#ffd700', '#4aff91', '#4a9eff', '#a855f7', '#ff6b35', '#e8e4dc']

export default function PriorityManagerModal({ priorities, todos, onAdd, onEdit, onReorder, onDelete, onClose }) {
  const [dragId,        setDragId]        = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null) // priority id awaiting a second click
  const [addingLabel,   setAddingLabel]   = useState('')
  const [addingColor,   setAddingColor]   = useState(NEW_PRIORITY_COLORS[0])

  const countFor = (id) => todos.filter(t => t.priority === id).length

  const dragProps = (id) => ({
    draggable: true,
    onDragStart: () => setDragId(id),
    onDragOver: (e) => e.preventDefault(),
    onDrop: () => { onReorder(dragId, id); setDragId(null) },
    onDragEnd: () => setDragId(null),
  })

  const handleAdd = () => {
    if (!addingLabel.trim()) return
    onAdd(addingLabel.trim(), addingColor)
    setAddingLabel('')
    setAddingColor(NEW_PRIORITY_COLORS[(priorities.length + 1) % NEW_PRIORITY_COLORS.length])
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
          width: 440, maxHeight: '80vh', overflowY: 'auto',
          background: 'var(--surface)', border: '1px solid var(--border-bright)',
          borderRadius: 14, boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          animation: 'pmFadeDown 0.15s cubic-bezier(0.16,1,0.3,1) both',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Manage Priorities</span>
          <button
            onClick={onClose}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', fontSize: 18, lineHeight: 1, padding: 0 }}
          >×</button>
        </div>

        <div style={{ padding: '10px 12px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--dimmer)', padding: '4px 6px 10px', lineHeight: 1.5 }}>
            Drag to reorder — order here sets the order priority sections appear in on the Todo page.
          </div>

          {priorities.map(p => (
            <div
              key={p.id}
              {...dragProps(p.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 8px', borderRadius: 8, marginBottom: 4,
                background: dragId === p.id ? 'var(--card-hover)' : 'var(--card)',
                border: '1px solid var(--border)',
                cursor: 'grab',
              }}
            >
              <span style={{ color: 'var(--dimmer)', display: 'flex', flexShrink: 0 }}><DragIcon /></span>

              <input
                type="color"
                value={p.color}
                onChange={e => onEdit(p.id, { color: e.target.value })}
                style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', padding: 0, flexShrink: 0, background: 'var(--card)' }}
              />

              <input
                value={p.label}
                onChange={e => onEdit(p.id, { label: e.target.value })}
                style={{
                  flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
                  fontSize: 12.5, color: 'var(--text)', fontFamily: 'Geist, sans-serif', padding: '3px 4px', borderRadius: 4,
                }}
                onFocus={e => e.currentTarget.style.background = hexToRgba(p.color, 0.08)}
                onBlur={e => e.currentTarget.style.background = 'transparent'}
              />

              <span style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', flexShrink: 0 }}>
                {countFor(p.id)} task{countFor(p.id) === 1 ? '' : 's'}
              </span>

              {confirmDelete === p.id ? (
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => { onDelete(p.id); setConfirmDelete(null) }}
                    disabled={priorities.length <= 1}
                    title={priorities.length <= 1 ? "Can't delete the last priority" : `Delete — ${countFor(p.id)} task(s) will move to another priority`}
                    style={{ fontSize: 10, padding: '3px 7px', borderRadius: 5, border: '1px solid rgba(255,68,68,0.4)', background: 'rgba(255,68,68,0.15)', color: '#ff6666', cursor: priorities.length <= 1 ? 'not-allowed' : 'pointer', fontFamily: 'Geist Mono, monospace' }}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    style={{ fontSize: 10, padding: '3px 7px', borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dimmer)', cursor: 'pointer', fontFamily: 'Geist Mono, monospace' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(p.id)}
                  disabled={priorities.length <= 1}
                  title={priorities.length <= 1 ? "Can't delete the last priority" : 'Delete priority'}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                    border: 'none', background: 'none', color: 'var(--dimmer)',
                    cursor: priorities.length <= 1 ? 'not-allowed' : 'pointer',
                    opacity: priorities.length <= 1 ? 0.4 : 1,
                  }}
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          ))}

          {/* Add new priority */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px', marginTop: 6, borderRadius: 8, border: '1px dashed var(--border-bright)' }}>
            <input
              type="color"
              value={addingColor}
              onChange={e => setAddingColor(e.target.value)}
              style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', padding: 0, flexShrink: 0, background: 'var(--card)' }}
            />
            <input
              value={addingLabel}
              onChange={e => setAddingLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              placeholder="New priority name..."
              style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', fontSize: 12.5, color: 'var(--text)', fontFamily: 'Geist, sans-serif' }}
            />
            <button
              onClick={handleAdd}
              disabled={!addingLabel.trim()}
              style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 6, border: 'none',
                background: addingLabel.trim() ? 'var(--accent)' : 'var(--border)',
                color: addingLabel.trim() ? '#000' : 'var(--dimmer)',
                fontWeight: 600, cursor: addingLabel.trim() ? 'pointer' : 'default',
                fontFamily: 'Geist, sans-serif',
              }}
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
