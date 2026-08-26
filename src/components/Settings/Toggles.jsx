export function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(v => !v)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: value ? 'var(--green)' : 'var(--border)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: value ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: value ? '#000' : 'var(--dimmer)',
        transition: 'left 0.2s',
      }} />
    </button>
  )
}

export function ToggleChip({ label, active, color, bg, onClick, disabled }) {
  return (
    <button
      onClick={!disabled ? onClick : undefined}
      style={{
        padding: '6px 14px', borderRadius: 8, border: `1px solid ${active ? color : 'var(--border)'}`,
        background: active ? bg : 'transparent',
        color: active ? color : 'var(--dimmer)',
        fontSize: 12, fontWeight: active ? 500 : 400,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'Geist, sans-serif', transition: 'all 0.12s',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {label}
      {active && !disabled && <span style={{ marginLeft: 6, opacity: 0.6 }}>✓</span>}
    </button>
  )
}
