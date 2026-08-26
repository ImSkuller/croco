import { useState } from 'react'

export default function CardBtn({ children, title, onClick, danger }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width:          24,
        height:         24,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        borderRadius:   5,
        border:         'none',
        cursor:         'pointer',
        background:     hovered
          ? (danger ? 'rgba(255,68,68,0.15)' : 'var(--border-bright)')
          : 'var(--border)',
        color: hovered
          ? (danger ? '#ff4444' : 'var(--text)')
          : 'var(--dim)',
        transition:     'all 0.12s',
      }}
    >
      {children}
    </button>
  )
}
