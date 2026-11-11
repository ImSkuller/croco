import { useState } from 'react'
import { APIIcon, CopyIcon, AlertTriangleIcon } from '../../constants/SimpleSvgExports'
import { SectionTitle, SettingsCard, FieldLabel, FieldDesc, TextInput, Toggle, InfoBox, SmallBtn } from './Exports'
import { useToast } from '../Toast/useToast.js'
import { codeStyle } from './shared.js'

export default function LocalApiSection({ settings, saveField }) {
  const toast = useToast()
  const api = settings.api || {}
  const [apiEnabled,     setApiEnabled]     = useState(!!api.enabled)
  const [apiPort,        setApiPort]        = useState(api.port || 3131)
  const [apiRunning,     setApiRunning]     = useState(!!api.running)
  const [apiTokenStored, setApiTokenStored] = useState(!!api.tokenStored)
  // Only ever holds a token this session just generated — the backend never
  // returns a stored token's real value (same "shown once" rule as e.g. a
  // GitHub OAuth device code).
  const [apiTokenReveal, setApiTokenReveal] = useState(null)
  const [apiBusy,        setApiBusy]        = useState(false)

  const applyLocalApi = async () => {
    if (!window.api) return
    setApiBusy(true)
    try {
      const result = await window.api.localApi.apply()
      setApiRunning(!!result.running)
      setApiTokenStored(prev => prev || !!result.tokenJustGenerated)
      if (result.tokenJustGenerated) setApiTokenReveal(result.tokenJustGenerated)
    } catch (e) {
      toast.error('Local API', e.message)
    } finally {
      setApiBusy(false)
    }
  }

  const handleToggle = async () => {
    const next = !apiEnabled
    setApiEnabled(next)
    await saveField({ api: { enabled: next, port: apiPort } })
    await applyLocalApi()
  }

  const handlePortChange = async (port) => {
    const n = Math.max(1024, Math.min(65535, Number(port) || 3131))
    setApiPort(n)
    await saveField({ api: { enabled: apiEnabled, port: n } })
    if (apiEnabled) await applyLocalApi()
  }

  const handleRegenerateToken = async () => {
    if (!window.api) return
    setApiBusy(true)
    try {
      const token = await window.api.localApi.regenerateToken()
      setApiTokenStored(true)
      setApiTokenReveal(token)
      setApiRunning(true)
      toast.success('Token regenerated', 'Copy it now — it will not be shown again.')
    } catch (e) {
      toast.error('Could not regenerate token', e.message)
    } finally {
      setApiBusy(false)
    }
  }

  return (
    <>
      <SectionTitle icon={<APIIcon />} title="Local API" desc="For advanced users. Lets other programs on your computer talk to Croco, for example to list projects or add todos. Off by default." />

      <SettingsCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <FieldLabel>Enable Local API</FieldLabel>
            <FieldDesc>
              Only programs on this computer can connect. Nothing is reachable over the internet.
              {apiEnabled && (apiRunning
                ? <span style={{ color: 'var(--green)' }}> Running on port {apiPort}.</span>
                : <span style={{ color: 'var(--orange)' }}> Not running. Another app may be using this port, so try a different number.</span>)}
            </FieldDesc>
          </div>
          <Toggle value={apiEnabled} onChange={handleToggle} />
        </div>
      </SettingsCard>

      {apiEnabled && (
        <>
          <SettingsCard>
            <FieldLabel>Port</FieldLabel>
            <FieldDesc>A number other programs use to find Croco. The default works for most people.</FieldDesc>
            <div style={{ marginTop: 8, maxWidth: 140 }}>
              <TextInput type="number" value={apiPort} onChange={handlePortChange} mono />
            </div>
          </SettingsCard>

          <SettingsCard>
            <FieldLabel>Access Token</FieldLabel>
            <FieldDesc>
              A password other programs must send as <code style={codeStyle}>Authorization: Bearer &lt;token&gt;</code>.
              {apiTokenStored && !apiTokenReveal && ' A token already exists. Making a new one stops the old one from working.'}
            </FieldDesc>
            {apiTokenReveal ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--base)', border: '1px solid var(--border-bright)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
                  <code style={{ ...codeStyle, flex: 1, fontSize: 12, wordBreak: 'break-all' }}>{apiTokenReveal}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(apiTokenReveal); toast.success('Copied') }}
                    title="Copy"
                    style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)', flexShrink: 0 }}
                  ><CopyIcon size={14} /></button>
                </div>
                <InfoBox style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangleIcon size={12} /> Copy this now. Croco won't show it again. You can make a new one anytime.</div>
                </InfoBox>
              </div>
            ) : (
              <div style={{ marginTop: 10 }}>
                <SmallBtn onClick={handleRegenerateToken}>{apiBusy ? 'Working…' : apiTokenStored ? 'Make New Token' : 'Make Token'}</SmallBtn>
              </div>
            )}
          </SettingsCard>

          <SettingsCard>
            <FieldLabel>Example</FieldLabel>
            <FieldDesc>Example: list your projects from a terminal:</FieldDesc>
            <pre style={{ marginTop: 8, padding: '10px 12px', background: 'var(--base)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 11, fontFamily: 'Geist Mono, monospace', color: 'var(--dim)', overflowX: 'auto' }}>
{`curl http://127.0.0.1:${apiPort}/projects \\
  -H "Authorization: Bearer <token>"`}
            </pre>
          </SettingsCard>
        </>
      )}
    </>
  )
}
