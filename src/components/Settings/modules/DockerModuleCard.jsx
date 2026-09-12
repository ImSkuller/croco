import { useData } from '../../../lib/store'
import { PackageIcon } from '../../../constants/SimpleSvgExports'
import { SettingsCard, InfoBox } from '../Exports'
import ModuleHeader from './ModuleHeader'

export default function DockerModuleCard() {
  const settings = useData('settings')
  const d = settings?.modules?.docker
  if (!settings) return null

  const update = (patch) => window.api?.settings.update({ modules: { docker: patch } }).catch(() => {})

  return (
    <SettingsCard>
      <ModuleHeader icon={<PackageIcon />} title="Docker" enabled={d.enabled} onToggle={() => update({ enabled: !d.enabled })}
        desc="Adds a Docker tab to any project with a docker-compose file — see services, start/stop them, and view logs, using your own docker CLI." />
      {d.enabled && (
        <InfoBox style={{ marginTop: 16 }}>
          Needs Docker Desktop/Engine installed and on PATH. Nothing to configure here — open a project with a <code>docker-compose.yml</code> to see the Docker tab.
        </InfoBox>
      )}
    </SettingsCard>
  )
}
