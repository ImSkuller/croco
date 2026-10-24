import { useEffect, useState } from 'react'
import { APIIcon, CheckCircleIcon } from '../../constants/SimpleSvgExports'
import { SectionTitle, SettingsCard, FieldLabel, FieldDesc, InfoBox } from './Exports'

const EXAMPLES = [
  ['croco', 'open the interactive prompt'],
  ['croco todos', 'list what is open'],
  ['croco add "Ship it" !high', 'capture a todo'],
  ['croco stats', 'completion rate by day / week / month'],
  ['croco code my-project', 'start Claude Code in a project'],
]

export default function TerminalSection({ toast }) {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = () => window.api?.cli.status().then(setStatus).catch(() => setStatus({ available: false }))
  useEffect(() => { load() }, [])

  const run = async (action) => {
    setBusy(true)
    try {
      const next = await window.api.cli[action]()
      setStatus(next)
      if (action === 'install') toast.success('Command installed', 'Open a new terminal window and type: croco')
      else toast.success('Command removed', '')
    } catch (e) {
      toast.error('Could not update PATH', String(e?.message || e))
    } finally { setBusy(false) }
  }

  return (
    <>
      <SectionTitle icon={<APIIcon />} title="Terminal" desc="Use Croco from any terminal — type croco in cmd, PowerShell, or your shell of choice." />
      <SettingsCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <FieldLabel>The croco command</FieldLabel>
            <FieldDesc>
              A standalone terminal app that shares your projects, todos and notes with the desktop app. It opens a
              Claude Code–style prompt with slash commands — no Node or extra install needed.
            </FieldDesc>
          </div>
          {status?.available && (
            <button
              onClick={() => run(status.installed ? 'uninstall' : 'install')}
              disabled={busy}
              style={{
                flexShrink: 0, padding: '7px 14px', borderRadius: 'var(--r-md)', fontSize: 12, fontWeight: 600,
                fontFamily: 'Geist, sans-serif', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
                border: status.installed ? '1px solid var(--border)' : 'none',
                background: status.installed ? 'transparent' : 'var(--accent)',
                color: status.installed ? 'var(--dim)' : '#000',
              }}
            >
              {status.installed ? 'Remove from PATH' : 'Add to PATH'}
            </button>
          )}
        </div>

        {status === null && <FieldDesc>Checking…</FieldDesc>}
        {status && !status.available && (
          <InfoBox>This build doesn't include the terminal app (development builds don't). Installed releases do.</InfoBox>
        )}
        {status?.available && (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: status.installed ? '#4aff91' : 'var(--dim)' }}>
            {status.installed && <CheckCircleIcon size={14} />}
            {status.installed
              ? (status.needsRestart ? 'On your PATH — open a new terminal window to pick it up.' : 'On your PATH and ready.')
              : 'Not on your PATH yet.'}
          </div>
        )}
        {status?.binPath && (
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', wordBreak: 'break-all' }}>{status.binPath}</div>
        )}
      </SettingsCard>

      <SettingsCard>
        <FieldLabel>Try it</FieldLabel>
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: 12 }}>
          {EXAMPLES.map(([cmd, what]) => (
            <div key={cmd} style={{ display: 'contents' }}>
              <code style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--accent)' }}>{cmd}</code>
              <span style={{ color: 'var(--dim)' }}>{what}</span>
            </div>
          ))}
        </div>
        <FieldDesc>Inside the prompt, type / to see every command with live suggestions. Changes made there appear here when you switch back to the app.</FieldDesc>
      </SettingsCard>
    </>
  )
}
