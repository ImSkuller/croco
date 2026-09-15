import { useState } from 'react'
import BetaBadge from './BetaBadge'

export default function SettingsNavItem({ section, active, danger, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        width: '100%', padding: '8px 10px', borderRadius: 'var(--r-md)',
        border: 'none', cursor: 'pointer', textAlign: 'left',
        fontFamily: 'Geist, sans-serif', fontSize: 13,
        background: active ? 'var(--card)' : hovered ? 'var(--hover-bg)' : 'transparent',
        color:      active ? (danger ? '#ff4444' : 'var(--text)') : (danger ? '#ff4444' : 'var(--dim)'),
        fontWeight: active ? 500 : 400,
        position: 'relative',
        transition: 'all var(--transition-fast)',
      }}
    >
      {active && (
        <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 2, height: 16, background: danger ? '#ff4444' : 'var(--text)', borderRadius: 'var(--r-sm)' }} />
      )}
      <span style={{ width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {section.icon}
      </span>
      <span style={{ flex: 1 }}>{section.label}</span>
      {section.badge && <BetaBadge style={{ fontSize: 8, padding: '0px 5px' }} />}
    </button>
  )
}
