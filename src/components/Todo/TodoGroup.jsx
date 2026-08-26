import { useState } from 'react'
import TodoRow from './TodoRow'

export default function TodoGroup({ label, color, todos, done, ...rowProps }) {
  const [collapsed, setCollapsed] = useState(done)

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Group header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '6px 0', marginBottom: 6, textAlign: 'left',
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--dim)', fontFamily: 'Geist Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </span>
        <span style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', background: 'var(--border)', padding: '1px 6px', borderRadius: 20 }}>
          {todos.length}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 16 16" fill="none"
          stroke="var(--dimmer)" strokeWidth="1.5" strokeLinecap="round"
          style={{ marginLeft: 'auto', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
        >
          <path d="M4 6l4 4 4-4"/>
        </svg>
      </button>

      {!collapsed && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {todos.map((todo, i) => (
            <TodoRow key={todo.id} todo={todo} last={i === todos.length - 1} {...rowProps} />
          ))}
        </div>
      )}
    </div>
  )
}
