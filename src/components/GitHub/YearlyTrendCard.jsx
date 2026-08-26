import SettingsCard from '../Settings/SettingsCard'
import { computeYearlyTrend } from '../../lib/habitInsights'

export default function YearlyTrendCard({ commitDates, years = 5 }) {
  const counts = computeYearlyTrend(commitDates, years)
  const max = Math.max(1, ...counts)
  const thisYear = counts[counts.length - 1] || 0
  const lastYear = counts[counts.length - 2] || 0
  const delta = thisYear - lastYear
  const trendLabel = delta > 0 ? `+${delta} vs last year` : delta < 0 ? `${delta} vs last year` : 'same as last year'
  const trendColor = delta > 0 ? 'var(--green)' : delta < 0 ? 'var(--red)' : 'var(--dimmer)'

  return (
    <SettingsCard style={{ margin: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Yearly Trend</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{thisYear}</span>
        <span style={{ fontSize: 11, color: 'var(--dimmer)' }}>commits this year</span>
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
