import { useState } from 'react'

export default function TopBtn({ children, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500,
        cursor: 'pointer', fontFamily: 'Geist, sans-serif',
        border:      '1px solid var(--orange)',
        background:  hovered ? 'var(--orange)' : 'rgba(255,107,53,0.1)',
        color:       hovered ? '#fff' : 'var(--orange)',
        transition:  'all 0.12s',
      }}
    >
      {children}
    </button>
  )
}
