import SettingsCard from '../Settings/SettingsCard'
import { ClockIcon } from '../../constants/SimpleSvgExports'

// projectStats.<id>.runSeconds accumulates every time a project's dev/
// build/test command runs and exits (see run_ops.rs + personality.rs) —
// this is "how long has this project's process actually been running",
// not "how long was the app window open".
function formatDuration(totalSeconds) {
  if (totalSeconds < 60) return '< 1m'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

export default function ProjectTimeCard({ projectStats, projects }) {
  const projectById = new Map(projects.map(p => [p.id, p]))
  const rows = Object.entries(projectStats || {})
    .map(([id, stat]) => ({ id, name: projectById.get(id)?.name || '(deleted project)', seconds: stat.runSeconds || 0 }))
    .filter(r => r.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 6)

  const totalSeconds = rows.reduce((sum, r) => sum + r.seconds, 0)
  const maxSeconds = rows[0]?.seconds || 1

  return (
    <SettingsCard style={{ margin: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        <ClockIcon size={11} /> Time per Project
      </div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--dimmer)', marginTop: 10 }}>
          Run a project's dev/build/test command to start tracking time here.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', fontFamily: 'Geist Mono, monospace', marginTop: 10 }}>
            {formatDuration(totalSeconds)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--dimmer)', marginBottom: 10 }}>across tracked runs</div>
          {rows.map(r => (
            <div key={r.id} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text)', marginBottom: 3 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                <span style={{ color: 'var(--dimmer)', flexShrink: 0, marginLeft: 8, fontFamily: 'Geist Mono, monospace' }}>{formatDuration(r.seconds)}</span>
              </div>
              <div style={{ height: 4, background: 'var(--border)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.max(4, (r.seconds / maxSeconds) * 100)}%`, background: 'var(--blue)', borderRadius: 'var(--r-sm)' }} />
              </div>
            </div>
          ))}
        </>
      )}
    </SettingsCard>
  )
}
