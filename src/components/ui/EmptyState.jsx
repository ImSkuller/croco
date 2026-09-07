// Every list page (Projects, Notes, Todo, Favourites, Activity) hand-rolls
// its own empty-state icon+title+body block inline — no shared component
// existed (docs/ui-audit.md §2). This is the target for that migration.
export function EmptyState({ icon, title, body, action }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', gap: 14 }}>
      {icon && (
        <div style={{
          width: 72, height: 72, borderRadius: 'var(--r-xl)',
          background: 'var(--card)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, marginBottom: 4,
        }}>
          {icon}
        </div>
      )}
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', letterSpacing: -0.3 }}>{title}</div>
      {body && (
        <div style={{ fontSize: 13, color: 'var(--dim)', textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>{body}</div>
      )}
      {action && <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>{action}</div>}
    </div>
  )
}
