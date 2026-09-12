export default function Chip({ c, bg, children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontFamily: 'Geist Mono, monospace', padding: '2px 7px', borderRadius: 'var(--r-sm)', background: bg, color: c }}>
      {children}
    </span>
  )
}
