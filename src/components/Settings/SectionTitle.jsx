export default function SectionTitle({ icon, title, desc }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{ color: 'var(--orange)', display: 'flex' }}>{icon}</span>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', letterSpacing: -0.3 }}>{title}</h2>
      </div>
      <p style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>{desc}</p>
      <div style={{ marginTop: 16, height: 1, background: 'var(--border)' }} />
    </div>
  )
}
