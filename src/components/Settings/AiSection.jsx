import { useState } from 'react'
import { AIIcon, CheckIcon, EyeIcon, EyeOffIcon } from '../../constants/SimpleSvgExports'
import { SectionTitle, SettingsCard, FieldLabel, FieldDesc, TextInput, Toggle, ToggleChip, InfoBox, SmallBtn } from './Exports'
import { useToast } from '../Toast/useToast.js'

const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'openai',    label: 'OpenAI'    },
  { id: 'gemini',    label: 'Gemini'    },
]

export default function AiSection({ settings, saveField, patchLocal }) {
  const toast = useToast()
  const commit = settings.ai?.commitMessages || {}
  const aiEnabled = !!commit.enabled
  const aiProvider = commit.provider || 'anthropic'
  const aiKeysStored = settings.ai?.keysStored || { anthropic: false, openai: false, gemini: false }
  const secretsFallbackActive = !!settings.app?.secretsFallbackActive
  // Only ever holds a key typed this session — settings_get never returns a
  // real stored AI key.
  const [aiKeyInput,   setAiKeyInput]   = useState('')
  const [aiKeyVisible, setAiKeyVisible] = useState(false)
  const [aiKeySaving,  setAiKeySaving]  = useState(false)

  const handleToggle = () => saveField({ ai: { commitMessages: { enabled: !aiEnabled, provider: aiProvider } } })

  const handleProviderChange = (provider) => {
    setAiKeyInput('')
    saveField({ ai: { commitMessages: { enabled: aiEnabled, provider } } })
  }

  const handleKeySave = async () => {
    if (!aiKeyInput.trim() || !window.api) return
    setAiKeySaving(true)
    try {
      await window.api.settings.setAiKey(aiProvider, aiKeyInput.trim())
      patchLocal({ ai: { keysStored: { [aiProvider]: true } } })
      setAiKeyInput('')
      toast.success('API key saved')
    } catch (e) {
      toast.error('Could not save key', e.message)
    } finally {
      setAiKeySaving(false)
    }
  }

  const handleKeyClear = async () => {
    if (!window.api) return
    await window.api.settings.setAiKey(aiProvider, '').catch(() => {})
    patchLocal({ ai: { keysStored: { [aiProvider]: false } } })
  }

  const providerLabel = PROVIDERS.find(p => p.id === aiProvider)?.label

  return (
    <>
      <SectionTitle icon={<AIIcon />} title="AI" desc="Let AI write your commit messages. Off by default, and it only works if you add your own API key." />

      <SettingsCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <FieldLabel>AI Commit Messages</FieldLabel>
            <FieldDesc>Adds a "Generate with AI" button when you save changes. Your changes are sent to the AI company you pick below. You always get to review the message first.</FieldDesc>
          </div>
          <Toggle value={aiEnabled} onChange={handleToggle} />
        </div>
      </SettingsCard>

      <SettingsCard>
        <FieldLabel>AI Company</FieldLabel>
        <FieldDesc>Each one needs its own API key (a password you get from their website).</FieldDesc>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {PROVIDERS.map(opt => (
            <ToggleChip
              key={opt.id}
              label={<>{opt.label}{aiKeysStored[opt.id] && <CheckIcon size={11} />}</>}
              active={aiProvider === opt.id}
              color="var(--accent)"
              bg="var(--accent-dim)"
              onClick={() => handleProviderChange(opt.id)}
            />
          ))}
        </div>

        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <FieldLabel>{providerLabel} API Key</FieldLabel>
          <FieldDesc>
            {aiKeysStored[aiProvider]
              ? 'A key is already saved. Paste a new one to replace it.'
              : 'Paste the key from your account on their website. It is stored securely on this computer.'}
          </FieldDesc>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <TextInput
                type={aiKeyVisible ? 'text' : 'password'}
                value={aiKeyInput}
                onChange={setAiKeyInput}
                placeholder={aiKeysStored[aiProvider] ? '••••••••  (saved, paste to replace)' : 'sk-...'}
                mono
              />
              <button
                onClick={() => setAiKeyVisible(v => !v)}
                title={aiKeyVisible ? 'Hide' : 'Show'}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', display: 'flex' }}
              >
                {aiKeyVisible ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
              </button>
            </div>
            <SmallBtn onClick={handleKeySave}>{aiKeySaving ? 'Saving…' : 'Save Key'}</SmallBtn>
            {aiKeysStored[aiProvider] && <SmallBtn onClick={handleKeyClear}>Clear</SmallBtn>}
          </div>
          {secretsFallbackActive && (
            <InfoBox style={{ marginTop: 10 }}>
              Your computer's secure password storage isn't available, so this key is saved in an encrypted file on this computer instead.
            </InfoBox>
          )}
        </div>
      </SettingsCard>
    </>
  )
}
