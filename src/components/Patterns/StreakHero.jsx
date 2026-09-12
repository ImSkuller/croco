import { computeDateStreak } from '../../lib/habitInsights'
import { FlameIcon, CalendarIcon } from '../../constants/SimpleSvgExports'

function Flame({ current, label, icon: Icon, color }) {
  const alive = current > 0
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 180,
      padding: '14px 18px', borderRadius: 'var(--r-lg)',
      background: 'var(--card)',
      border: `1px solid ${alive ? color : 'var(--border)'}`,
    }}>
      <span style={{ display: 'flex', color: alive ? color : 'var(--dimmer)', opacity: alive ? 1 : 0.35 }}><Icon size={26} /></span>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: alive ? color : 'var(--dimmer)', lineHeight: 1.1 }}>
          {current} {current === 1 ? 'day' : 'days'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--dimmer)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

export default function StreakHero({ commitDates, appOpenDates }) {
  const commit = computeDateStreak(commitDates)
  const login  = computeDateStreak(appOpenDates)

  return (
    <div style={{ display: 'flex', gap: 12, gridColumn: '1 / -1', flexWrap: 'wrap' }}>
      <Flame current={commit.current} label="commit streak — keeps going as long as you push code somewhere every day" icon={FlameIcon} color="var(--accent)" />
      <Flame current={login.current} label="login streak — days you've opened Croco" icon={CalendarIcon} color="var(--blue)" />
    </div>
  )
}
