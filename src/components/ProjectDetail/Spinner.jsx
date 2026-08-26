export default function Spinner({ size = 16 }) {
  return (
    <div style={{ width: size, height: size, border: `${Math.max(1.5, size / 8)}px solid var(--border)`, borderTopColor: 'var(--orange)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
  )
}
