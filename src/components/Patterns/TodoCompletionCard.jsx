import SettingsCard from '../Settings/SettingsCard'

export default function TodoCompletionCard({ todosCreated, todosCompleted }) {
  const rate = todosCreated > 0 ? Math.round((todosCompleted / todosCreated) * 100) : 0
  return (
    <SettingsCard style={{ margin: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Todo Completion</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', marginTop: 10 }}>{rate}%</div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', marginTop: 8, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${rate}%`, background: 'var(--accent)', borderRadius: 3 }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--dimmer)', marginTop: 8 }}>{todosCompleted} of {todosCreated} todos completed</div>
    </SettingsCard>
  )
}
