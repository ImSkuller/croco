import { useState } from 'react'
import { useData } from '../../../lib/store'
import { DiscordIcon } from '../../../constants/SimpleSvgExports'
import { SettingsCard, FieldLabel, FieldDesc, TextInput, Toggle } from '../Exports'
import WebhookFields from './WebhookFields'
import ModuleHeader from './ModuleHeader'

export default function DiscordModuleCard() {
  const settings = useData('settings')
  const d = settings?.modules?.discord
  // "Adjust state during render" (React's documented alternative to an
  // effect for syncing local editable state from a prop/store value) —
  // resets the draft only when the stored applicationId itself changes
  // (e.g. loaded from a fresh settings fetch), not on every render, while
  // still letting the user type freely in between.
  const [lastSeenAppId, setLastSeenAppId] = useState(d?.applicationId)
  const [appIdInput, setAppIdInput] = useState(d?.applicationId || '')
  if (d && d.applicationId !== lastSeenAppId) {
    setLastSeenAppId(d.applicationId)
    setAppIdInput(d.applicationId || '')
  }

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
          <div>
            <FieldLabel>Application ID</FieldLabel>
            <FieldDesc>
              Required for Rich Presence. Create one at <span style={{ color: 'var(--blue)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => window.api?.system.openExternal('https://discord.com/developers/applications')}>discord.com/developers/applications</span> and paste its Application ID here.
            </FieldDesc>
            <TextInput
              value={appIdInput}
              onChange={setAppIdInput}
              onBlur={() => update({ applicationId: appIdInput.trim() })}
              placeholder="1234567890123456789"
              mono
            />
          </div>

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
