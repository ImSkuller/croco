import { useData, refreshData } from '../../../lib/store'
import { DiscordIcon } from '../../../constants/SimpleSvgExports'
import { SettingsCard, FieldLabel, FieldDesc, Toggle } from '../Exports'
import WebhookFields from './WebhookFields'
import ModuleHeader from './ModuleHeader'
import { patchModule } from './moduleUpdate'

export default function DiscordModuleCard() {
  const settings = useData('settings')
  const d = settings?.modules?.discord

  if (!settings) return null

  const update = (patch) => patchModule('discord', patch).catch(() => {})

  const toggleModule = () => {
    update({ enabled: !d.enabled })
    if (d.enabled) window.api?.discord.clearActivity().catch(() => {})
  }
  const toggleRichPresence = () => {
    const next = !d.richPresence?.enabled
    update({ richPresence: { enabled: next } })
    if (!next) window.api?.discord.clearActivity().catch(() => {})
  }

  return (
    <SettingsCard>
      <ModuleHeader icon={<DiscordIcon />} title="Discord" enabled={d.enabled} onToggle={toggleModule}
        desc="Show what you're working on in your Discord status, and/or post updates to a Discord channel." />
      {d.enabled && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <FieldLabel>Rich Presence</FieldLabel>
              <FieldDesc>Shows "Editing &lt;project&gt;" on your Discord profile while a project is open. It uses the Discord app on your computer, so there's no login.</FieldDesc>
            </div>
            <Toggle value={!!d.richPresence?.enabled} onChange={toggleRichPresence} />
          </div>

          <WebhookFields
            title="Webhook Notifications"
            desc="Sends a message to a Discord channel when you upload to GitHub, finish a todo, or create a project."
            placeholder="https://discord.com/api/webhooks/..."
            enabled={!!d.webhook?.enabled}
            urlStored={!!d.webhook?.urlStored}
            onToggle={() => update({ webhook: { enabled: !d.webhook?.enabled } })}
            onSaveUrl={(url) => window.api.settings.setDiscordWebhook(url).then(() => refreshData('settings'))}
            onTest={() => window.api.discord.webhookTest()}
          />
        </div>
      )}
    </SettingsCard>
  )
}
