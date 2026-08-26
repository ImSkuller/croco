import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function FavChip({ fav }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={() => navigate(`/projects/${fav.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px',
        background:  hovered ? 'var(--card-hover)' : 'var(--card)',
        border:      `1px solid ${hovered ? 'var(--border-bright)' : 'var(--border)'}`,
        borderRadius: 8,
        cursor:      'pointer',
        whiteSpace:  'nowrap',
        flexShrink:  0,
        transition:  'all 0.12s',
      }}
    >
      <span style={{ fontSize: 14 }}>{fav.emoji}</span>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{fav.name}</span>
      <span style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', background: 'var(--border)', padding: '2px 6px', borderRadius: 4 }}>
        {fav.ide}
      </span>
    </div>
  )
}
