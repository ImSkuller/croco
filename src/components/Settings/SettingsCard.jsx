export default function SettingsCard({ children, style: extraStyle = {} }) {
  return (
    <div className="glass-card" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px', marginBottom: 12, ...extraStyle }}>
      {children}
    </div>
  )
}
