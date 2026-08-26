export default function DangerRow({ title, desc, action, actionDisabled, color, nuclear, onClick }) {
  const red = color === 'var(--red)' || nuclear
  return (
    <div style={{
      background: 'var(--card)', borderRadius: 10, padding: '16px 18px',
      border: `1px solid ${nuclear ? 'rgba(255,68,68,0.3)' : 'var(--border)'}`,
      display: 'flex', alignItems: 'flex-start', gap: 16,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: nuclear ? 600 : 500, color: nuclear ? '#ff5555' : 'var(--text)', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--dimmer)', lineHeight: 1.55 }}>{desc}</div>
      </div>
      <button onClick={onClick} disabled={actionDisabled}
        style={{
          padding: '7px 14px', borderRadius: 7, flexShrink: 0, fontSize: 12, fontFamily: 'Geist, sans-serif',
          fontWeight: nuclear ? 500 : 400, cursor: actionDisabled ? 'not-allowed' : 'pointer',
          border: `1px solid ${actionDisabled ? 'var(--border)' : red ? 'rgba(255,68,68,0.3)' : `${color}44`}`,
          background: actionDisabled ? 'transparent' : red ? 'rgba(255,68,68,0.08)' : `${color}11`,
          color: actionDisabled ? 'var(--dimmer)' : red ? '#ff5555' : color,
          transition: 'all 0.12s',
        }}
      >{action}</button>
    </div>
  )
}
