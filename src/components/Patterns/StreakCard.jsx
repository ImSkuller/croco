import SettingsCard from '../Settings/SettingsCard'
import { computeDateStreak } from '../../lib/habitInsights'

/**
 * Generic current/longest streak card over any array of unique local
 * YYYY-MM-DD date strings — used for both the commit streak (git log across
 * every tracked project) and the app-login streak (days Croco was opened).
 */
export default function StreakCard({ dates, label = 'Streak', accentColor = 'var(--accent)', unit = 'day' }) {
  const { current, longest } = computeDateStreak(dates)
  return (
    <SettingsCard style={{ margin: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ display: 'flex', gap: 24, marginTop: 10 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 700, color: accentColor }}>{current}</div>
          <div style={{ fontSize: 11, color: 'var(--dimmer)', marginTop: 2 }}>{unit}{current === 1 ? '' : 's'} current</div>
        </div>
        <div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)' }}>{longest}</div>
          <div style={{ fontSize: 11, color: 'var(--dimmer)', marginTop: 2 }}>{unit}{longest === 1 ? '' : 's'} longest</div>
        </div>
      </div>
    </SettingsCard>
  )
}
