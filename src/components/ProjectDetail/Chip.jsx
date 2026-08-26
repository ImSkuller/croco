export default function Chip({ c, bg, children }) {
  return (
    <span style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', padding: '2px 7px', borderRadius: 4, background: bg, color: c }}>
      {children}
    </span>
  )
}
