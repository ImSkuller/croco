import { useState, useEffect } from 'react'
import { TagIcon, BellIcon, XCircleIcon, CheckCircleIcon } from '../../constants/SimpleSvgExports'
import { SectionTitle, SettingsCard, FieldLabel, FieldDesc, ToggleChip, Toggle, InfoBox } from './Exports'
import { useToast } from '../Toast/useToast.js'

const NOTIFICATION_EVENTS = [
  { id: 'runFinished',   label: 'Run finished',        desc: 'a project run completes' },
  { id: 'runFailed',     label: 'Run failed',          desc: 'a project run stops with an error' },
  { id: 'pushSucceeded', label: 'Upload succeeded',    desc: 'only when Croco is in the background' },
  { id: 'pushFailed',    label: 'Upload failed',       desc: 'the upload to GitHub did not work' },
  { id: 'aiReply',       label: 'AI reply ready',      desc: 'only when Croco is in the background' },
  { id: 'focusEnded',    label: 'Focus session ended', desc: 'a work or break timer ends' },
]

function ToggleRow({ label, desc, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 12, color: 'var(--text)' }}>{label} <span style={{ color: 'var(--dimmer)' }}>— {desc}</span></span>
      <Toggle value={value} onChange={onChange} />
    </div>
  )
}

export default function GeneralSection({ settings, saveField }) {
  const toast = useToast()
  const app = settings.app || {}
  const closeBehavior = app.closeBehavior || 'tray'
  const deadlineRemindersEnabled = app.deadlineReminders?.enabled ?? true
  const notifPrefs = app.notifications || {}

  const [launchOnStartup, setLaunchOnStartup] = useState(false)
  const [launchOnStartupBusy, setLaunchOnStartupBusy] = useState(false)
  const [desktopPermissionGranted, setDesktopPermissionGranted] = useState(null) // null (unknown yet) | bool

  useEffect(() => {
    window.api?.app?.autostart.isEnabled().then(setLaunchOnStartup).catch(() => {})
    window.api?.notify?.isDesktopPermissionGranted().then(setDesktopPermissionGranted).catch(() => {})
  }, [])

  const toggleLaunchOnStartup = async () => {
    if (!window.api || launchOnStartupBusy) return
    setLaunchOnStartupBusy(true)
    const next = !launchOnStartup
    try {
      if (next) await window.api.app.autostart.enable()
      else await window.api.app.autostart.disable()
      setLaunchOnStartup(next)
    } catch (e) {
      toast?.error?.('Could not update startup setting', e.message)
    } finally {
      setLaunchOnStartupBusy(false)
    }
  }

  const handleRequestDesktopPermission = async () => {
    if (!window.api) return
    const granted = await window.api.notify.requestDesktopPermission().catch(() => false)
    setDesktopPermissionGranted(!!granted)
  }

  return (
    <>
      <SectionTitle icon={<TagIcon />} title="General" desc="How Croco starts, closes, and notifies you." />

      <SettingsCard>
        <FieldLabel>When closing the window</FieldLabel>
        <FieldDesc>What happens when you click the X button.</FieldDesc>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {[
            { id: 'tray', label: <><BellIcon size={12} /> Keep Running in Background</> },
            { id: 'quit', label: <><XCircleIcon size={12} /> Quit</> },
          ].map(opt => (
            <ToggleChip
              key={opt.id}
              label={opt.label}
              active={closeBehavior === opt.id}
              color="var(--accent)"
              bg="var(--accent-dim)"
              onClick={() => saveField({ app: { closeBehavior: opt.id } })}
            />
          ))}
        </div>
        {closeBehavior === 'tray' && (
          <InfoBox>Croco stays open in the background. Click its icon near the clock to reopen it or quit for good.</InfoBox>
        )}
      </SettingsCard>

      <SettingsCard>
        <FieldLabel>Open When I Turn On My Computer</FieldLabel>
        <FieldDesc>Croco opens by itself when you log in.</FieldDesc>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {[
            { id: true,  label: <><CheckCircleIcon size={12} /> Enabled</> },
            { id: false, label: <><XCircleIcon size={12} /> Disabled</> },
          ].map(opt => (
            <ToggleChip
              key={String(opt.id)}
              label={opt.label}
              active={launchOnStartup === opt.id}
              color="var(--accent)"
              bg="var(--accent-dim)"
              disabled={launchOnStartupBusy}
              onClick={() => { if (launchOnStartup !== opt.id) toggleLaunchOnStartup() }}
            />
          ))}
        </div>
      </SettingsCard>

      <SettingsCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <FieldLabel>Show hidden projects on the Dashboard</FieldLabel>
            <FieldDesc>Hidden projects are left off the Dashboard unless you turn this on. Archived projects never show there.</FieldDesc>
          </div>
          <Toggle value={!!app.showHiddenOnDashboard} onChange={() => saveField({ app: { showHiddenOnDashboard: !app.showHiddenOnDashboard } })} />
        </div>
      </SettingsCard>

      <SettingsCard>
        <FieldLabel>Desktop Notifications</FieldLabel>
        <FieldDesc>Pop-up alerts from your computer. Choose which ones you want.</FieldDesc>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12, marginBottom: desktopPermissionGranted === false ? 12 : 0 }}>
          <ToggleRow
            label="Deadline reminders"
            desc="when a deadline arrives"
            value={deadlineRemindersEnabled}
            onChange={() => saveField({ app: { deadlineReminders: { enabled: !deadlineRemindersEnabled } } })}
          />
          {NOTIFICATION_EVENTS.map(n => (
            <ToggleRow
              key={n.id}
              label={n.label}
              desc={n.desc}
              value={!!notifPrefs[n.id]}
              onChange={() => saveField({ app: { notifications: { [n.id]: !notifPrefs[n.id] } } })}
            />
          ))}
        </div>
        {desktopPermissionGranted === false && (
          <InfoBox>
            Your computer hasn't allowed Croco to show notifications yet.
            <button
              onClick={handleRequestDesktopPermission}
              style={{ marginLeft: 8, padding: '3px 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 11, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}
            >
              Allow Notifications
            </button>
          </InfoBox>
        )}
      </SettingsCard>
    </>
  )
}
