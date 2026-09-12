import { useData } from '../../../lib/store'
import { ClockIcon } from '../../../constants/SimpleSvgExports'
import { SettingsCard, FieldLabel, TextInput } from '../Exports'
import ModuleHeader from './ModuleHeader'

export default function FocusTimerModuleCard() {
  const settings = useData('settings')
  const f = settings?.modules?.focusTimer
  if (!settings) return null

  const update = (patch) => window.api?.settings.update({ modules: { focusTimer: patch } }).catch(() => {})

  return (
    <SettingsCard>
      <ModuleHeader icon={<ClockIcon />} title="Focus Timer" enabled={f.enabled} onToggle={() => update({ enabled: !f.enabled })}
        desc="A local Pomodoro-style work/break timer with a Focus tab in the sidebar. No network calls, no accounts." />
      {f.enabled && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <FieldLabel>Work session (minutes)</FieldLabel>
            <TextInput type="number" value={f.workMinutes} onChange={v => update({ workMinutes: Math.max(1, Math.min(180, Number(v) || 25)) })} mono />
          </div>
          <div style={{ flex: 1 }}>
            <FieldLabel>Break (minutes)</FieldLabel>
            <TextInput type="number" value={f.breakMinutes} onChange={v => update({ breakMinutes: Math.max(1, Math.min(60, Number(v) || 5)) })} mono />
          </div>
        </div>
      )}
    </SettingsCard>
  )
}
