import { useState } from 'react'
import { TrashIcon, EditIcon, AlertTriangleIcon } from '../../constants/SimpleSvgExports.jsx'
import RowBtn from './RowBtn.jsx'
import { DEFAULT_PRIORITIES, findPriority, hexToRgba, isTodoLocked } from '../../lib/todoPriorities.js'

const COLUMNS = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'doing',   label: 'Doing' },
  { id: 'done',    label: 'Done' },
]

// Old todos never had a `status` field — derive one from `completed` so
// they land in a sensible column instead of vanishing from the board.
// `completed` is the source of truth (the list-view checkbox only flips it),
// so a stale `status` can never leave a finished task in Doing or an
// un-ticked one in Done.
function statusOf(todo) {
  if (todo.completed) return 'done'
  return todo.status && todo.status !== 'done' ? todo.status : 'backlog'
}

function KanbanCard({ todo, priorities, onEdit, onDelete, editingId, editText, setEditText, onSaveEdit, onCancelEdit, editInputRef, locked, dragProps }) {
  const [hovered, setHovered] = useState(false)
  const isEditing = editingId === todo.id
  const p = todo.priority ? findPriority(priorities, todo.priority) : null
  const overdue = todo.dueDate && !todo.completed && new Date(todo.dueDate) < new Date()

  return (
    <div
      {...(locked ? {} : dragProps)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
        padding: '10px 12px', marginBottom: 8, cursor: locked ? 'default' : 'grab',
        opacity: locked ? 0.7 : 1,
      }}
    >
      {isEditing ? (
        <input
          ref={editInputRef}
          value={editText}
          onChange={e => setEditText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSaveEdit(todo.id); if (e.key === 'Escape') onCancelEdit() }}
          onBlur={() => onSaveEdit(todo.id)}
          style={{ width: '100%', background: 'var(--border)', border: '1px solid var(--orange)', borderRadius: 'var(--r-sm)', padding: '3px 8px', color: 'var(--text)', fontSize: 12.5, fontFamily: 'Geist, sans-serif', outline: 'none' }}
        />
      ) : (
        <div
          onDoubleClick={() => !todo.completed && onEdit(todo)}
          style={{
            fontSize: 12.5, color: todo.completed ? 'var(--dimmer)' : 'var(--text)',
            textDecoration: todo.completed ? 'line-through' : 'none',
            wordBreak: 'break-word', marginBottom: 6,
          }}
        >
          {todo.title}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {todo.project && (
          <span style={{ fontSize: 9.5, color: 'var(--blue)', fontFamily: 'Geist Mono, monospace', background: 'rgba(74,158,255,0.08)', padding: '2px 5px', borderRadius: 'var(--r-sm)' }}>
            {todo.project}
          </span>
        )}
        {p && (
          <span style={{ fontSize: 9.5, fontFamily: 'Geist Mono, monospace', padding: '2px 5px', borderRadius: 'var(--r-sm)', background: hexToRgba(p.color, 0.12), color: p.color }}>
            {p.label}
          </span>
        )}
        {todo.dueDate && !todo.completed && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9.5, fontFamily: 'Geist Mono, monospace', color: overdue ? '#ff4444' : 'var(--dimmer)' }}>
            {overdue && <AlertTriangleIcon size={9} />}
            {new Date(todo.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, opacity: hovered ? 1 : 0, transition: 'opacity var(--transition-fast)' }}>
          {!todo.completed && (
            <RowBtn title="Edit (or double-click)" onClick={() => onEdit(todo)}>
              <EditIcon size={11} />
            </RowBtn>
          )}
          <RowBtn title="Delete" danger onClick={() => onDelete(todo.id)}>
            <TrashIcon size={11} />
          </RowBtn>
        </div>
      </div>
    </div>
  )
}

// Board view for the Todo page — an alternate rendering of the same
// `todos` list List view already filters down to (search/priority/
// project all apply before this component sees anything), with drag-and-
// drop between Backlog/Doing/Done columns instead of the checkbox +
// priority-group layout. Native HTML5 drag-and-drop, same pattern as
// Favourites.jsx's reorder — dragDropEnabled is forced off at the Tauri
// window level specifically so this keeps working (see CLAUDE.md).
export default function KanbanBoard({ todos, priorities = DEFAULT_PRIORITIES, onMoveStatus, onEdit, onDelete, editingId, editText, setEditText, onSaveEdit, onCancelEdit, editInputRef }) {
  const [dragId, setDragId] = useState(null)
  const [dragOverCol, setDragOverCol] = useState(null)

  const columns = COLUMNS.map(col => ({
    ...col,
    todos: todos.filter(t => statusOf(t) === col.id),
  }))

  const dragProps = (id) => ({
    draggable: true,
    onDragStart: () => setDragId(id),
    onDragEnd: () => { setDragId(null); setDragOverCol(null) },
  })

  const onColDragOver = (e, colId) => { e.preventDefault(); setDragOverCol(colId) }
  const onColDrop = (colId) => {
    if (dragId) onMoveStatus(dragId, colId)
    setDragId(null); setDragOverCol(null)
  }

  return (
    <div style={{ display: 'flex', gap: 14, height: '100%', alignItems: 'flex-start' }}>
      {columns.map(col => (
        <div
          key={col.id}
          onDragOver={e => onColDragOver(e, col.id)}
          onDragLeave={() => setDragOverCol(prev => (prev === col.id ? null : prev))}
          onDrop={() => onColDrop(col.id)}
          style={{
            flex: 1, minWidth: 0, background: dragOverCol === col.id ? 'var(--hover-bg)' : 'transparent',
            border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 10,
            transition: 'background var(--transition-fast)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '0 2px' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{col.label}</span>
            <span style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>{col.todos.length}</span>
          </div>
          {col.todos.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--dimmer)', textAlign: 'center', padding: '20px 0' }}>Drop here</div>
          ) : (
            col.todos.map(todo => (
              <KanbanCard
                key={todo.id}
                todo={todo}
                priorities={priorities}
                onEdit={onEdit}
                onDelete={onDelete}
                editingId={editingId}
                editText={editText}
                setEditText={setEditText}
                onSaveEdit={onSaveEdit}
                onCancelEdit={onCancelEdit}
                editInputRef={editInputRef}
                locked={isTodoLocked(todo)}
                dragProps={dragProps(todo.id)}
              />
            ))
          )}
        </div>
      ))}
    </div>
  )
}
