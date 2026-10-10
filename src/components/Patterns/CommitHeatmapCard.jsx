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

// Generic GitHub-style heatmap renderer — originally built for Patterns'
// commit-only heatmap, now also used by Dashboard's broader activity
// heatmap (any tracked metric, not just commits — see
// personality.rs::activityDates). `title`/`unitLabel` let each caller
// supply its own wording without duplicating the whole component.
export default function CommitHeatmapCard({ dates, commitDates, weeks = 26, title = 'Contribution Activity', unitLabel = 'commit' }) {
  // `commitDates` kept as a fallback prop name so Patterns.jsx's existing
  // call site keeps working unchanged — `dates` is the generic name new
  // callers (Dashboard) should use.
  const activeDates = dates || commitDates
  const cols = computeHeatmapWeeks(activeDates, weeks)
  const total = (activeDates || []).length

  // Month label per column: show the label when the month changes vs the previous column's first day.
  const monthLabels = cols.reduce((acc, col) => {
    const m = new Date(`${col[0].date}T00:00:00`).getMonth()
    const prevMonth = acc.length > 0 ? acc[acc.length - 1].month : null
    acc.push({ month: m, label: m !== prevMonth ? MONTH_LABELS[m] : '' })
    return acc
  }, []).map(x => x.label)

  return (
    <SettingsCard style={{ margin: 0, gridColumn: 'span 2' }}>
      <div style={{ fontSize: 11, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>
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
                <div key={di} title={`${day.date}: ${day.count} ${unitLabel}${day.count === 1 ? '' : 's'}`} style={{
                  width: 9, height: 9, borderRadius: 'var(--r-sm)',
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
