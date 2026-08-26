export function FieldLabel({ children }) {
  return <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>{children}</div>
}

export function FieldDesc({ children }) {
  return <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 8, lineHeight: 1.4 }}>{children}</div>
}
