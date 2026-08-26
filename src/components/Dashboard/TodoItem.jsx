import { useState } from 'react'
import { CheckIcon } from '../../constants/SimpleSvgExports.jsx'

export default function TodoItem({ item, onToggle }) {
  const [hovered, setHovered] = useState(false)
  const priorityColor = { high: '#ff4444', med: '#ffd700', low: '#4aff91' }
  const priorityBg    = { high: 'rgba(255,68,68,0.12)', med: 'rgba(255,215,0,0.1)', low: 'rgba(74,255,145,0.1)' }

  return (
    <div
      onClick={() => onToggle(item.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '11px 18px', borderBottom: '1px solid var(--border)',
        cursor: 'pointer', background: hovered ? 'var(--hover-bg)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
        border:      item.done ? 'none' : '1px solid var(--border-bright)',
        background:  item.done ? '#4aff91' : 'transparent',
        display:     'flex', alignItems: 'center', justifyContent: 'center',
        transition:  'all 0.12s',
      }}>
        {item.done && <CheckIcon />}
      </div>
      <span style={{ flex: 1, fontSize: 12, color: item.done ? 'var(--dimmer)' : 'var(--dim)', textDecoration: item.done ? 'line-through' : 'none', transition: 'all 0.12s' }}>
        {item.text}
      </span>
      <span style={{
        fontSize: 10, fontFamily: 'Geist Mono, monospace', padding: '2px 6px', borderRadius: 4,
        background: item.done ? 'rgba(74,255,145,0.1)' : priorityBg[item.priority],
        color:      item.done ? '#4aff91'              : priorityColor[item.priority],
      }}>
        {item.done ? 'done' : item.priority}
      </span>
    </div>
  )
}
