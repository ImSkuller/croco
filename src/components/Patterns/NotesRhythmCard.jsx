import SettingsCard from '../Settings/SettingsCard'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function NotesRhythmCard({ notesCreated, notesByWeekday }) {
  const max = Math.max(1, ...notesByWeekday)
  return (
    <SettingsCard style={{ margin: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Note-Taking Rhythm</div>
      <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 6, marginBottom: 10 }}>
        {notesCreated} note{notesCreated === 1 ? '' : 's'} created
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 50 }}>
        {notesByWeekday.map((v, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div title={`${WEEKDAY_LABELS[i]}: ${v}`} style={{
              width: '100%', height: `${Math.max(2, (v / max) * 100)}%`,
              background: v > 0 ? 'var(--accent)' : 'var(--border)', borderRadius: 2, opacity: v > 0 ? 0.85 : 0.4,
            }} />
            <div style={{ fontSize: 9, color: 'var(--dimmer)' }}>{WEEKDAY_LABELS[i][0]}</div>
          </div>
        ))}
      </div>
    </SettingsCard>
  )
}
