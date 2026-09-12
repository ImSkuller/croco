import { useState } from 'react'
import { useData } from '../../../lib/store'
import { AIIcon, CheckIcon } from '../../../constants/SimpleSvgExports'
import { SettingsCard, FieldLabel, FieldDesc, TextInput, Toggle, ToggleChip, InfoBox } from '../Exports'
import ModuleHeader from './ModuleHeader'
import ApiKeyField from './ApiKeyField'

const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic', needsKey: true },
  { id: 'openai',    label: 'OpenAI',    needsKey: true },
  { id: 'gemini',    label: 'Gemini',    needsKey: true },
  { id: 'ollama',    label: 'Ollama',    needsKey: false },
]

export default function AiModuleCard({ aiKeysStored }) {
  const settings = useData('settings')
  const ai = settings?.modules?.ai
  const [ollamaModels, setOllamaModels] = useState(null)
  const [ollamaError, setOllamaError] = useState(null)
  if (!settings) return null

  const update = (patch) => window.api?.settings.update({ modules: { ai: patch } }).catch(() => {})
  const provider = ai.provider || 'anthropic'
  const ollama = ai.ollama || { host: 'http://localhost:11434', model: '' }

  const refreshOllamaModels = async () => {
    setOllamaError(null)
    try {
      const models = await window.api.ai.ollamaListModels(ollama.host)
      setOllamaModels(models)
      if (!ollama.model && models.length) update({ ollama: { ...ollama, model: models[0] } })
    } catch (e) {
      setOllamaModels([])
      setOllamaError(e.message || String(e))
    }
  }

  return (
    <SettingsCard>
      <ModuleHeader icon={<AIIcon />} title="AI" enabled={ai.enabled} onToggle={() => update({ enabled: !ai.enabled })}
        desc="A dedicated AI tab with persistent local memory (the 'Storage Brain'), chat/research/plan/code modes, and an editable memory + encyclopedia browser." />
      {ai.enabled && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <FieldLabel>Provider</FieldLabel>
            <FieldDesc>Anthropic/OpenAI/Gemini use the key below. Ollama runs fully locally — no key needed.</FieldDesc>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {PROVIDERS.map(opt => (
                <ToggleChip
                  key={opt.id}
                  label={<>{opt.label}{opt.needsKey && aiKeysStored?.[opt.id] && <CheckIcon size={11} />}</>}
                  active={provider === opt.id}
                  color="var(--accent)"
                  bg="var(--accent-dim)"
                  onClick={() => update({ provider: opt.id })}
                />
              ))}
            </div>
          </div>

          {provider === 'ollama' ? (
            <div>
              <FieldLabel>Ollama Host</FieldLabel>
              <TextInput value={ollama.host} onChange={v => update({ ollama: { ...ollama, host: v } })} onBlur={refreshOllamaModels} placeholder="http://localhost:11434" mono />
              <div style={{ marginTop: 12 }}>
                <FieldLabel>Model</FieldLabel>
                {ollamaError ? (
                  <InfoBox>Could not reach Ollama at that host — make sure it's running (`ollama serve`). {ollamaError}</InfoBox>
                ) : ollamaModels === null ? (
                  <button onClick={refreshOllamaModels} style={{ padding: '7px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
                    Load installed models
                  </button>
                ) : ollamaModels.length === 0 ? (
                  <FieldDesc>No models installed — run <code>ollama pull &lt;model&gt;</code> first.</FieldDesc>
                ) : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {ollamaModels.map(m => (
                      <ToggleChip key={m} label={m} active={ollama.model === m} color="var(--accent)" bg="var(--accent-dim)" onClick={() => update({ ollama: { ...ollama, model: m } })} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <ApiKeyField provider={provider} keyStored={!!aiKeysStored?.[provider]} />
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <FieldLabel>Web Access (Research mode)</FieldLabel>
              <FieldDesc>Lets Research mode use the provider's own hosted web search (Anthropic, OpenAI, Gemini) instead of guessing at anything current. Ollama has no search tool and answers from the model alone.</FieldDesc>
            </div>
            <Toggle value={!!ai.webAccess?.enabled} onChange={() => update({ webAccess: { enabled: !ai.webAccess?.enabled } })} />
          </div>
        </div>
      )}
    </SettingsCard>
  )
}
