import { useState } from 'react'

export default function StatCard({ stat }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:   hovered ? 'var(--card-hover)' : 'var(--card)',
        border:       `1px solid ${hovered ? 'var(--border-bright)' : 'var(--border)'}`,
        borderRadius: 10,
        padding:      16,
        transform:    hovered ? 'translateY(-1px)' : 'translateY(0)',
        boxShadow:    hovered ? 'var(--shadow-md)' : 'none',
        transition:   'border-color 0.15s, background 0.15s, transform 0.2s, box-shadow 0.2s',
      }}
    >
      <div style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        {stat.label}
      </div>
      <div style={{
        fontSize:    stat.valueSize || 24,
        fontWeight:  600,
        color:       stat.valueColor || 'var(--text)',
        fontFamily:  stat.mono ? 'Geist Mono, monospace' : 'Geist, sans-serif',
        letterSpacing: -0.5,
        lineHeight:  1,
        marginBottom: 4,
      }}>
        {stat.value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--dim)', display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: stat.dot, flexShrink: 0 }} />
        {stat.sub}
      </div>
    </div>
  )
}
