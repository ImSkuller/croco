// Shared empty-state block. `compact` is for in-tab / in-card contexts
// (ProjectDetail tabs, GitPanel) where the full-page 100px padding and 72px
// icon tile would dwarf the surrounding panel. `mono` renders the body in
// Geist Mono — used for paths and file names.
export function EmptyState({ icon, title, body, action, compact = false, mono = false }) {
  const tile = compact ? 52 : 72
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: compact ? '48px 0' : '100px 0', gap: compact ? 10 : 14 }}>
      {icon && (
        <div style={{
          width: tile, height: tile, borderRadius: compact ? 'var(--r-lg)' : 'var(--r-xl)',
          background: 'var(--card)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--dimmer)', fontSize: compact ? 22 : 32, marginBottom: compact ? 0 : 4,
        }}>
          {icon}
        </div>
      )}
      <div style={{ fontSize: compact ? 14 : 16, fontWeight: 600, color: 'var(--text)', letterSpacing: -0.3 }}>{title}</div>
      {body && (
        <div style={{
          fontSize: compact ? 12 : 13, color: 'var(--dim)', textAlign: 'center', maxWidth: compact ? 360 : 280, lineHeight: 1.5,
          fontFamily: mono ? 'Geist Mono, monospace' : undefined, wordBreak: mono ? 'break-all' : undefined,
        }}>{body}</div>
      )}
      {action && <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>{action}</div>}
    </div>
  )
}
