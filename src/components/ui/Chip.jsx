// Consolidates Dashboard/FavChip.jsx + ProjectDetail/Chip.jsx (docs/ui-audit.md
// §2) — same concept, two independent implementations. `color` sets both the
// text color and (at low opacity) the background, matching how both originals
// were actually used at their call sites.
export function Chip({ color = 'var(--dim)', bg, children, style, ...props }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 10, fontFamily: 'Geist Mono, monospace',
        padding: '2px 7px', borderRadius: 'var(--r-sm)',
        background: bg ?? 'color-mix(in srgb, ' + color + ' 12%, transparent)',
        color,
        ...style,
      }}
      {...props}
    >
      {children}
    </span>
  )
}
