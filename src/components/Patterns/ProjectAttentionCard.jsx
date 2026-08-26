import SettingsCard from '../Settings/SettingsCard'
import { scoreProjects, findNeglectedProjects } from '../../lib/habitInsights'

export default function ProjectAttentionCard({ projectStats, projects }) {
  const rows = scoreProjects(projectStats, projects)
  const mostActive = [...rows].sort((a, b) => b.score - a.score).slice(0, 3)
  const neglected = findNeglectedProjects(projectStats, projects, { limit: 3 })

  return (
    <SettingsCard style={{ margin: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Project Attention</div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--dimmer)', marginTop: 10 }}>No project activity tracked yet</div>
      ) : (
        <>
          <div style={{ fontSize: 10, color: 'var(--dimmer)', marginTop: 10, marginBottom: 4 }}>Most active</div>
          {mostActive.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text)', padding: '3px 0' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
              <span style={{ color: 'var(--dimmer)', flexShrink: 0, marginLeft: 8 }}>{r.stat.commits || 0} commits · {r.stat.opens || 0} opens</span>
            </div>
          ))}
          {neglected.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: 'var(--dimmer)', marginTop: 10, marginBottom: 4 }}>Could use attention</div>
              {neglected.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text)', padding: '3px 0' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                  <span style={{ color: '#ff9944', flexShrink: 0, marginLeft: 8 }}>quiet {r.quietDays}d</span>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </SettingsCard>
  )
}
