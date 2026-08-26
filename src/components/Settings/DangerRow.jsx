import { useState } from 'react'

export default function DangerRow({ title, desc, action, onAction }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', gap: 20 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.4 }}>{desc}</div>
      </div>
      <button
        onClick={onAction}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          padding: '7px 14px', borderRadius: 7, cursor: 'pointer', flexShrink: 0,
          border: '1px solid rgba(255,68,68,0.4)',
          background: hovered ? 'rgba(255,68,68,0.15)' : 'rgba(255,68,68,0.06)',
          color: '#ff4444', fontSize: 12, fontWeight: 500,
          fontFamily: 'Geist, sans-serif', transition: 'all 0.12s',
        }}
      >
        {action}
      </button>
    </div>
  )
}
