export default function StatCard({ label, value, color }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
      <div style={{ fontSize: 26, fontWeight: 600, color, fontFamily: 'Geist Mono, monospace', letterSpacing: -1, lineHeight: 1, marginBottom: 5 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
    </div>
  )
}
