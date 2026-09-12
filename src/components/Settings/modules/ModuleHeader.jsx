import { FieldDesc, Toggle, BetaBadge } from '../Exports'

export default function ModuleHeader({ icon, title, desc, enabled, onToggle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ color: 'var(--accent)', display: 'flex' }}>{icon}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
          <BetaBadge />
        </div>
        <FieldDesc>{desc}</FieldDesc>
      </div>
      <Toggle value={enabled} onChange={onToggle} />
    </div>
  )
}
