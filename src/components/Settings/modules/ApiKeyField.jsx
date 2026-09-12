import { useState } from 'react'
import { EyeIcon, EyeOffIcon } from '../../../constants/SimpleSvgExports'
import { FieldLabel, FieldDesc, TextInput, SmallBtn } from '../Exports'
import { useToast } from '../../Toast/useToast.js'

const LABELS = { anthropic: 'Anthropic', openai: 'OpenAI', gemini: 'Gemini' }

// Reused in both Settings → Modules → AI and the AI page itself (the
// "somewhere to actually paste a key without leaving the AI section" the
// Modules card alone didn't provide) — same settings_set_ai_key command
// either way, so a key pasted in one place shows up as stored in the other.
export default function ApiKeyField({ provider, keyStored }) {
  const toast = useToast()
  const [keyInput, setKeyInput] = useState('')
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!keyInput.trim() || !window.api) return
    setSaving(true)
    try {
      await window.api.settings.setAiKey(provider, keyInput.trim())
      setKeyInput('')
      toast.success('API key saved')
    } catch (e) {
      toast.error('Could not save key', e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    await window.api?.settings.setAiKey(provider, '').catch(() => {})
  }

  return (
    <div>
      <FieldLabel>{LABELS[provider] || provider} API Key</FieldLabel>
      <FieldDesc>
        {keyStored ? 'A key is currently stored for this provider — paste a new one to replace it.' : 'Paste a key from your provider account. Stored in your OS credential store, never in settings.json.'}
      </FieldDesc>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <TextInput
            type={visible ? 'text' : 'password'}
            value={keyInput}
            onChange={setKeyInput}
            placeholder={keyStored ? '••••••••  (stored — paste to replace)' : 'sk-...'}
            mono
          />
          <button
            onClick={() => setVisible(v => !v)}
            title={visible ? 'Hide' : 'Show'}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', display: 'flex' }}
          >
            {visible ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
          </button>
        </div>
        <SmallBtn onClick={handleSave}>{saving ? 'Saving…' : 'Save Key'}</SmallBtn>
        {keyStored && <SmallBtn onClick={handleClear}>Clear</SmallBtn>}
      </div>
    </div>
  )
}
