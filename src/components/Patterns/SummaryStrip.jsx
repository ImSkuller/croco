const STAT_STYLE = {
  display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 110,
}

function Stat({ label, value, accent }) {
  return (
    <div style={STAT_STYLE}>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ? 'var(--accent)' : 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--dimmer)' }}>{label}</div>
    </div>
  )
}

export default function SummaryStrip({ profile, projectsTracked }) {
  const totalCommits = profile.totalCommits || 0
  const totalNotes = profile.notesCreated || 0
  const totalTodos = profile.todosCompleted || 0
  const active = Object.keys(profile.projectStats || {}).length
  const daysActive = (profile.appOpenDates || []).length

  return (
    <div className="glass-card" style={{
      display: 'flex', flexWrap: 'wrap', gap: 20,
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '18px 22px', gridColumn: '1 / -1',
    }}>
      <Stat label="Total commits" value={totalCommits} accent />
      <Stat label="Notes written" value={totalNotes} />
      <Stat label="Todos completed" value={totalTodos} />
      <Stat label="Projects with activity" value={active} />
      <Stat label="Projects tracked" value={projectsTracked} />
      <Stat label="Days used Croco" value={daysActive} />
    </div>
  )
}
