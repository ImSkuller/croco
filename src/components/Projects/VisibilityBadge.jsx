export default function VisibilityBadge({ visibility }) {
  if (!visibility) return null
  return (
    <span style={{
      fontSize: 9, fontFamily: 'Geist Mono, monospace', padding: '2px 5px', borderRadius: 3,
      textTransform: 'uppercase', letterSpacing: '0.06em',
      background: visibility === 'hidden' ? 'rgba(168,85,247,0.1)' : 'rgba(74,158,255,0.1)',
      color:      visibility === 'hidden' ? '#a855f7'              : '#4a9eff',
    }}>
      {visibility}
    </span>
  )
}
