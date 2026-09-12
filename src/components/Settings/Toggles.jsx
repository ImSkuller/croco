import { CheckIcon } from '../../constants/SimpleSvgExports'

export function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(v => !v)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: value ? 'var(--green)' : 'var(--border)',
        position: 'relative', transition: 'background var(--transition-base)', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: value ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: value ? '#000' : 'var(--dimmer)',
        transition: 'left var(--transition-base)',
      }} />
    </button>
  )
}

export function ToggleChip({ label, active, color, bg, onClick, disabled }) {
  return (
    <button
      onClick={!disabled ? onClick : undefined}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 14px', borderRadius: 'var(--r-md)', border: `1px solid ${active ? color : 'var(--border)'}`,
        background: active ? bg : 'transparent',
        color: active ? color : 'var(--dimmer)',
        fontSize: 12, fontWeight: active ? 500 : 400,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'Geist, sans-serif', transition: 'all var(--transition-fast)',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {label}
      {active && !disabled && <span style={{ display: 'flex', marginLeft: 6, opacity: 0.6 }}><CheckIcon size={11} /></span>}
    </button>
  )
}
