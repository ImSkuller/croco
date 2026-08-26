import SettingsCard from '../Settings/SettingsCard'
import { computeMonthlyTrend } from '../../lib/habitInsights'

export default function MonthlyTrendCard({ commitDates, months = 12 }) {
  const counts = computeMonthlyTrend(commitDates, months)
  const max = Math.max(1, ...counts)
  const thisMonth = counts[counts.length - 1] || 0
  const lastMonth = counts[counts.length - 2] || 0
  const delta = thisMonth - lastMonth
  const trendLabel = delta > 0 ? `+${delta} vs last month` : delta < 0 ? `${delta} vs last month` : 'same as last month'
  const trendColor = delta > 0 ? 'var(--green)' : delta < 0 ? 'var(--red)' : 'var(--dimmer)'

  return (
    <SettingsCard style={{ margin: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Monthly Trend</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{thisMonth}</span>
        <span style={{ fontSize: 11, color: 'var(--dimmer)' }}>commits this month</span>
        <span style={{ fontSize: 11, color: trendColor, marginLeft: 'auto' }}>{trendLabel}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 50 }}>
        {counts.map((v, i) => (
          <div key={i} title={`${v} commits`} style={{
            flex: 1, height: `${Math.max(2, (v / max) * 100)}%`,
            background: i === counts.length - 1 ? 'var(--accent)' : 'var(--border)',
            opacity: v > 0 ? (i === counts.length - 1 ? 0.95 : 0.6) : 0.3,
            borderRadius: 2,
          }} />
        ))}
      </div>
    </SettingsCard>
  )
}
