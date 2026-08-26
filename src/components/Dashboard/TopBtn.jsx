import { useState } from 'react'

/* A reusable button component used in the dashboard's top bar.
Accepts children (button content), a primary flag for styling, and an onClick handler. */
export default function TopBtn({ children, primary, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:     'inline-flex',
        alignItems:  'center',
        gap:         6,
        padding:     '6px 12px',
        borderRadius: 7,
        fontSize:    12,
        fontWeight:  500,
        cursor:      'pointer',
        border:      primary ? '1px solid var(--text)' : '1px solid var(--border)',
        background:  primary
          ? (hovered ? '#ddd' : 'var(--text)')
          : (hovered ? 'var(--card)' : 'transparent'),
        color:       primary ? '#000' : (hovered ? 'var(--text)' : 'var(--dim)'),
        transition:  'all 0.12s',
      }}
    >
      {children}
    </button>
  )
}
