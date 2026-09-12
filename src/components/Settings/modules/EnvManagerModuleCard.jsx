import { useData } from '../../../lib/store'
import { LockIcon } from '../../../constants/SimpleSvgExports'
import { SettingsCard, InfoBox } from '../Exports'
import ModuleHeader from './ModuleHeader'

export default function EnvManagerModuleCard() {
  const settings = useData('settings')
  const e = settings?.modules?.envManager
  if (!settings) return null

  const update = (patch) => window.api?.settings.update({ modules: { envManager: patch } }).catch(() => {})

  return (
    <SettingsCard>
      <ModuleHeader icon={<LockIcon />} title="Env Manager" enabled={e.enabled} onToggle={() => update({ enabled: !e.enabled })}
        desc="Adds an Env tab to each project — view and edit its .env file with values masked by default." />
      {e.enabled && (
        <InfoBox style={{ marginTop: 16 }}>
          Edits go straight to the project's real <code>.env</code> file — there's no separate encrypted store, so this is exactly as secure as that file already was on disk.
        </InfoBox>
      )}
    </SettingsCard>
  )
}
