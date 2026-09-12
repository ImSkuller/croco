export default function BetaBadge({ style: extraStyle = {} }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '1px 6px', borderRadius: 'var(--r-xl)',
      fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
      fontFamily: 'Geist Mono, monospace', textTransform: 'uppercase',
      color: 'var(--accent)', background: 'var(--accent-dim)',
      border: '1px solid var(--accent)',
      ...extraStyle,
    }}>
      Beta
    </span>
  )
}
