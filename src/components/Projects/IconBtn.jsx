import { useState } from 'react'

export default function IconBtn({ children, onClick, active }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          6,
        padding:      '6px 10px',
        borderRadius: 7,
        border:       `1px solid ${active || hovered ? 'var(--border-bright)' : 'var(--border)'}`,
        background:   active || hovered ? 'var(--card)' : 'transparent',
        color:        'var(--dim)',
        cursor:       'pointer',
        fontSize:     12,
        transition:   'all 0.12s',
      }}
    >
      {children}
    </button>
  )
}
