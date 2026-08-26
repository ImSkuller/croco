export default function InfoSection({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        {label}
      </div>
      {children}
    </div>
  )
}
