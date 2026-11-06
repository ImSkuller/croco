import { useData } from '../../../lib/store'
import { LockIcon } from '../../../constants/SimpleSvgExports'
import { SettingsCard, InfoBox } from '../Exports'
import ModuleHeader from './ModuleHeader'
import { patchModule } from './moduleUpdate'

export default function EnvManagerModuleCard() {
  const settings = useData('settings')
  const e = settings?.modules?.envManager
  if (!settings) return null

  const update = (patch) => patchModule('envManager', patch).catch(() => {})

  return (
    <SettingsCard>
      <ModuleHeader icon={<LockIcon />} title="Env Manager" enabled={e.enabled} onToggle={() => update({ enabled: !e.enabled })}
        desc="Adds an Env tab to each project to view and edit its .env file (secret settings). Values are hidden until you reveal them." />
      {e.enabled && (
        <InfoBox style={{ marginTop: 16 }}>
          Changes are saved straight into the project's own <code>.env</code> file. It is no more or less secure than that file already was.
        </InfoBox>
      )}
    </SettingsCard>
  )
}
