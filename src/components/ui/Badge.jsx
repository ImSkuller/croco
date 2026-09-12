// Consolidates ProjectDetail/VisBadge.jsx + Projects/VisibilityBadge.jsx
// (docs/ui-audit.md §2 — same concept, two names, two implementations).
export function VisibilityBadge({ visibility }) {
  if (!visibility) return null
  const hidden = visibility === 'hidden'
  return (
    <span style={{
      fontSize: 9, fontFamily: 'Geist Mono, monospace', padding: '2px 5px', borderRadius: 'var(--r-sm)',
      textTransform: 'uppercase', letterSpacing: '0.06em',
      background: hidden ? 'var(--accent-dim)' : 'rgba(106,168,240,0.1)',
      color:      hidden ? 'var(--purple)'     : 'var(--blue)',
    }}>
      {visibility}
    </span>
  )
}
