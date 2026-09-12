import { useState } from 'react'
import { CheckIcon, XCircleIcon, EyeIcon, EyeOffIcon } from '../../../constants/SimpleSvgExports'
import { FieldLabel, FieldDesc, TextInput, Toggle, SmallBtn } from '../Exports'
import { useToast } from '../../Toast/useToast.js'

// Shared "enable webhook + paste URL + save + test" block — identical shape
// for Discord and Slack (both are just "POST a message to a URL"), so this
// is the one place that logic lives instead of two near-duplicate cards.
export default function WebhookFields({ title, desc, placeholder, enabled, urlStored, onToggle, onSaveUrl, onTest }) {
  const toast = useToast()
  const [urlInput, setUrlInput] = useState('')
  const [urlVisible, setUrlVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const handleSave = async () => {
    if (!urlInput.trim()) return
    setSaving(true)
    try {
      await onSaveUrl(urlInput.trim())
      setUrlInput('')
      toast.success('Webhook URL saved')
    } catch (e) {
      toast.error('Could not save webhook URL', e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTestResult(null)
    try {
      await onTest()
      setTestResult({ ok: true })
    } catch (e) {
      setTestResult({ ok: false, message: e.message || String(e) })
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <FieldLabel>{title}</FieldLabel>
          <FieldDesc>{desc}</FieldDesc>
        </div>
        <Toggle value={enabled} onChange={onToggle} />
      </div>
      {enabled && (
        <div style={{ marginTop: 12 }}>
          <FieldLabel>Webhook URL</FieldLabel>
          {urlStored && <FieldDesc>A URL is currently stored — paste a new one here and Save to replace it.</FieldDesc>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <TextInput
                type={urlVisible ? 'text' : 'password'}
                value={urlInput}
                onChange={setUrlInput}
                placeholder={urlStored ? '••••••••  (stored — paste to replace)' : placeholder}
                mono
              />
              <button
                onClick={() => setUrlVisible(v => !v)}
                title={urlVisible ? 'Hide' : 'Show'}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', display: 'flex' }}
              >
                {urlVisible ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
              </button>
            </div>
            <SmallBtn onClick={handleSave}>{saving ? 'Saving…' : 'Save'}</SmallBtn>
            <SmallBtn onClick={handleTest}>Test</SmallBtn>
          </div>
          {testResult && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, color: testResult.ok ? 'var(--green)' : 'var(--red)', fontFamily: 'Geist Mono, monospace' }}>
              {testResult.ok ? <><CheckIcon size={12} /> Test message sent</> : <><XCircleIcon size={12} /> {testResult.message}</>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
