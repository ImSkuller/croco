// Thin wrapper for .pm-card — most of the app hand-rolls
// `background: var(--card); border: 1px solid var(--border); borderRadius: <one
// of 17 inline values>` instead (docs/ui-audit.md §1). This is the target for
// that migration, not a retroactive rename.
export function Card({ children, hover = false, className = '', style, ...props }) {
  const cls = ['pm-card', hover ? 'pm-card-hover' : '', className].filter(Boolean).join(' ')
  return (
    <div className={cls} style={style} {...props}>
      {children}
    </div>
  )
}
