import { useData } from '../../../lib/store'
import { DiscordIcon } from '../../../constants/SimpleSvgExports'
import { SettingsCard, FieldLabel, FieldDesc, Toggle } from '../Exports'
import WebhookFields from './WebhookFields'
import ModuleHeader from './ModuleHeader'

export default function DiscordModuleCard() {
  const settings = useData('settings')
  const d = settings?.modules?.discord

  if (!settings) return null

  const update = (patch) => window.api?.settings.update({ modules: { discord: patch } }).catch(() => {})

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
        desc="Rich Presence on your own Discord profile, and/or webhook notifications posted to a channel you choose." />
      {d.enabled && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <FieldLabel>Rich Presence</FieldLabel>
              <FieldDesc>Shows "Editing &lt;project&gt;" on your Discord profile while a project is open. Connects locally to your own Discord client — no login, no bot.</FieldDesc>
            </div>
            <Toggle value={!!d.richPresence?.enabled} onChange={toggleRichPresence} />
          </div>

          <WebhookFields
            title="Webhook Notifications"
            desc="Posts a message to a Discord channel when you push, complete a todo, or create a project."
            placeholder="https://discord.com/api/webhooks/..."
            enabled={!!d.webhook?.enabled}
            urlStored={!!d.webhook?.urlStored}
            onToggle={() => update({ webhook: { enabled: !d.webhook?.enabled } })}
            onSaveUrl={(url) => window.api.settings.setDiscordWebhook(url)}
            onTest={() => window.api.discord.webhookTest()}
          />
        </div>
      )}
    </SettingsCard>
  )
}
