import { useData } from '../../../lib/store'
import { SlackIcon } from '../../../constants/SimpleSvgExports'
import { SettingsCard } from '../Exports'
import ModuleHeader from './ModuleHeader'
import WebhookFields from './WebhookFields'

export default function SlackModuleCard() {
  const settings = useData('settings')
  const s = settings?.modules?.slack
  if (!settings) return null

  const update = (patch) => window.api?.settings.update({ modules: { slack: patch } }).catch(() => {})

  return (
    <SettingsCard>
      <ModuleHeader icon={<SlackIcon />} title="Slack" enabled={s.enabled} onToggle={() => update({ enabled: !s.enabled })}
        desc="Webhook notifications posted to a Slack channel when you push, complete a todo, or create a project." />
      {s.enabled && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <WebhookFields
            title="Webhook Notifications"
            desc="From a Slack app's Incoming Webhooks page for your workspace."
            placeholder="https://hooks.slack.com/services/..."
            enabled={!!s.webhook?.enabled}
            urlStored={!!s.webhook?.urlStored}
            onToggle={() => update({ webhook: { enabled: !s.webhook?.enabled } })}
            onSaveUrl={(url) => window.api.settings.setSlackWebhook(url)}
            onTest={() => window.api.slack.webhookTest()}
          />
        </div>
      )}
    </SettingsCard>
  )
}
