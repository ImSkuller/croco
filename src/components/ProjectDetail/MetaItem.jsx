export default function MetaItem({ label, value, mono }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--dim)', fontFamily: mono ? 'Geist Mono, monospace' : 'Geist, sans-serif' }}>{value}</div>
    </div>
  )
}
