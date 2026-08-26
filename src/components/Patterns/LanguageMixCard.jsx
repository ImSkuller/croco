import SettingsCard from '../Settings/SettingsCard'
import { computeLanguageMix } from '../../lib/habitInsights'

export default function LanguageMixCard({ projects }) {
  const mix = computeLanguageMix(projects)

  return (
    <SettingsCard style={{ margin: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Language Mix</div>
      {mix.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--dimmer)', marginTop: 10 }}>
          Open a project's detail page to detect its languages — they'll show up here.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 10, marginBottom: 10 }}>
            {mix.map(l => (
              <div key={l.name} title={`${l.name}: ${l.pct}%`} style={{ width: `${l.pct}%`, background: l.color || 'var(--accent)' }} />
            ))}
          </div>
          {mix.map(l => (
            <div key={l.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '3px 0' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color || 'var(--accent)', flexShrink: 0 }} />
              <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
              <span style={{ color: 'var(--dimmer)', marginLeft: 'auto', flexShrink: 0 }}>{l.pct}%</span>
            </div>
          ))}
        </>
      )}
    </SettingsCard>
  )
}
