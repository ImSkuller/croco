export default function InfoBox({ children }) {
  return (
    <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(74,158,255,0.06)', border: '1px solid rgba(74,158,255,0.15)', borderRadius: 7, fontSize: 11, color: 'var(--dim)', lineHeight: 1.5 }}>
      {children}
    </div>
  )
}
