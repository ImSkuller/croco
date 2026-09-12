import { useState } from 'react'
import { SaveIcon, CheckIcon } from '../../constants/SimpleSvgExports'

export function SmallBtn({ children, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '6px 12px', borderRadius: 'var(--r-md)', cursor: 'pointer',
        border: '1px solid var(--border)',
        background: hovered ? 'var(--card-hover)' : 'var(--card)',
        color: hovered ? 'var(--text)' : 'var(--dim)',
        fontSize: 12, fontFamily: 'Geist, sans-serif',
        transition: 'all var(--transition-fast)', flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

export function SaveBtn({ saved, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 14px', borderRadius: 'var(--r-md)', cursor: 'pointer',
        border: `1px solid ${saved ? 'var(--green)' : 'var(--border)'}`,
        background: saved ? 'rgba(74,255,145,0.1)' : (hovered ? 'var(--card)' : 'transparent'),
        color: saved ? 'var(--green)' : (hovered ? 'var(--text)' : 'var(--dim)'),
        fontSize: 12, fontWeight: 500, fontFamily: 'Geist, sans-serif',
        transition: 'all var(--transition-base)',
      }}
    >
      {saved ? <><CheckIcon /> Saved</> : <><SaveIcon /> Save Changes</>}
    </button>
  )
}
