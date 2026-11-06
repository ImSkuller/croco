import { useData } from '../../../lib/store'
import { PackageIcon } from '../../../constants/SimpleSvgExports'
import { SettingsCard, InfoBox } from '../Exports'
import ModuleHeader from './ModuleHeader'
import { patchModule } from './moduleUpdate'

export default function DockerModuleCard() {
  const settings = useData('settings')
  const d = settings?.modules?.docker
  if (!settings) return null

  const update = (patch) => patchModule('docker', patch).catch(() => {})

  return (
    <SettingsCard>
      <ModuleHeader icon={<PackageIcon />} title="Docker" enabled={d.enabled} onToggle={() => update({ enabled: !d.enabled })}
        desc="Adds a Docker tab to projects that use Docker, so you can start, stop, and see logs for each service." />
      {d.enabled && (
        <InfoBox style={{ marginTop: 16 }}>
          Docker must be installed on your computer. Nothing to set up here. Open a project that has a <code>docker-compose.yml</code> file to see the Docker tab.
        </InfoBox>
      )}
    </SettingsCard>
  )
}
