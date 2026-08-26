import SettingsCard from '../Settings/SettingsCard'
import { computeHeatmapWeeks } from '../../lib/habitInsights'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function levelColor(count) {
  if (count <= 0) return 'var(--border)'
  return 'var(--accent)'
}

function levelOpacity(count) {
  return count > 0 ? 0.9 : 0.35
}

export default function CommitHeatmapCard({ commitDates, weeks = 26 }) {
  const cols = computeHeatmapWeeks(commitDates, weeks)
  const total = (commitDates || []).length

  // Month label per column: show the label when the month changes vs the previous column's first day.
  const monthLabels = cols.reduce((acc, col) => {
    const m = new Date(`${col[0].date}T00:00:00`).getMonth()
    const prevMonth = acc.length > 0 ? acc[acc.length - 1].month : null
    acc.push({ month: m, label: m !== prevMonth ? MONTH_LABELS[m] : '' })
    return acc
  }, []).map(x => x.label)

  return (
    <SettingsCard style={{ margin: 0, gridColumn: 'span 2' }}>
      <div style={{ fontSize: 11, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Contribution Activity</div>
      <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 6, marginBottom: 12 }}>
        {total} active day{total === 1 ? '' : 's'} in the last {weeks} weeks
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 3, marginBottom: 3, minWidth: weeks * 12 }}>
          {monthLabels.map((label, i) => (
            <div key={i} style={{ width: 9, fontSize: 9, color: 'var(--dimmer)', flexShrink: 0 }}>{label}</div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 3, minWidth: weeks * 12 }}>
          {cols.map((col, ci) => (
            <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {col.map((day, di) => (
                <div key={di} title={`${day.date}: ${day.count} commit${day.count === 1 ? '' : 's'}`} style={{
                  width: 9, height: 9, borderRadius: 2,
                  background: day.future ? 'transparent' : levelColor(day.count),
                  opacity: day.future ? 0 : levelOpacity(day.count),
                }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </SettingsCard>
  )
}
