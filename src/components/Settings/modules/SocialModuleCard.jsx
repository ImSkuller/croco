import { useData } from '../../../lib/store'
import { UserIcon } from '../../../constants/SimpleSvgExports'
import { SettingsCard, InfoBox } from '../Exports'
import ModuleHeader from './ModuleHeader'
import { patchModule } from './moduleUpdate'

// The social layer's own module card — see docs/SCOPE.md's "Social layer
// & profile system" section and docs/social/*.md for the phase plans.
// Unlike every other module, enabling this requires a GitHub login and
// network access to croco-server; everything else in the app stays fully
// offline-capable regardless of this toggle.
export default function SocialModuleCard() {
  const settings = useData('settings')
  const s = settings?.modules?.social
  if (!settings) return null

  const update = (patch) => patchModule('social', patch).catch(() => {})

  return (
    <SettingsCard>
      <ModuleHeader
        icon={<UserIcon />}
        title="Social"
        enabled={s.enabled}
        onToggle={() => update({ enabled: !s.enabled })}
        desc="Posts, a feed, follows, and Launchpad — Croco's opt-in social layer. Requires GitHub login and a network connection."
      />
      {s.enabled && (
        <>
          <InfoBox style={{ marginTop: 16 }}>
            We never store your code — GitHub attachments are fetched live and only a small cached repo card (name, stars, description, a short README excerpt) is kept, never full file contents.
          </InfoBox>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, color: 'var(--text)' }}>
            <input
              type="checkbox"
              checked={!!s.streak?.includeGithubActivity}
              onChange={e => update({ streak: { includeGithubActivity: e.target.checked } })}
            />
            Also count real GitHub commit activity toward my daily streak
          </label>
        </>
      )}
    </SettingsCard>
  )
}
