import SettingsCard from '../Settings/SettingsCard'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function Bars({ values, formatLabel, height = 60 }) {
  const max = Math.max(1, ...values)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height }}>
      {values.map((v, i) => (
        <div key={i} title={`${formatLabel(i)}: ${v}`} style={{
          flex: 1, height: `${Math.max(2, (v / max) * 100)}%`,
          background: v > 0 ? 'var(--accent)' : 'var(--border)',
          borderRadius: 2, opacity: v > 0 ? 0.85 : 0.4,
        }} />
      ))}
    </div>
  )
}

export default function CommitRhythmCard({ commitsByHour, commitsByWeekday, totalCommits }) {
  const busiestHour = commitsByHour.reduce((best, v, i) => (v > commitsByHour[best] ? i : best), 0)
  const busiestWeekday = commitsByWeekday.reduce((best, v, i) => (v > commitsByWeekday[best] ? i : best), 0)

  return (
    <SettingsCard style={{ margin: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Commit Rhythm</div>
      <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 6, marginBottom: 10 }}>
        {totalCommits > 0
          ? <>Busiest around <strong>{busiestHour}:00</strong>, usually on <strong>{WEEKDAY_LABELS[busiestWeekday]}</strong></>
          : 'No commits tracked yet'}
      </div>
      <div style={{ fontSize: 10, color: 'var(--dimmer)', marginBottom: 4 }}>By hour of day</div>
      <Bars values={commitsByHour} formatLabel={i => `${i}:00`} />
      <div style={{ fontSize: 10, color: 'var(--dimmer)', margin: '10px 0 4px' }}>By day of week</div>
      <Bars values={commitsByWeekday} formatLabel={i => WEEKDAY_LABELS[i]} height={40} />
    </SettingsCard>
  )
}
