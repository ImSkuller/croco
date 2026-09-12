import { useState, useMemo } from 'react'
import { useData, EMPTY_LIST } from '../lib/store'
import { AIIcon, SearchIcon, VaultIcon, RefreshIcon, CheckIcon } from '../constants/SimpleSvgExports'
import { useToast } from '../components/Toast/useToast.js'
import ChatPanel from '../components/AI/ChatPanel'
import MemoryBrowser from '../components/AI/MemoryBrowser'
import ApiKeyField from '../components/Settings/modules/ApiKeyField'
import useDiscordPresence from '../hooks/useDiscordPresence'

const MODES = [
  { id: 'chat',     label: 'Chat' },
  { id: 'research', label: 'Research' },
  { id: 'plan',     label: 'Plan' },
  { id: 'code',     label: 'Code' },
]
const SECTIONS = [
  { id: 'memories',     label: 'Memories' },
  { id: 'encyclopedia', label: 'Encyclopedia' },
]

const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic', needsKey: true },
  { id: 'openai',    label: 'OpenAI',    needsKey: true },
  { id: 'gemini',    label: 'Gemini',    needsKey: true },
  { id: 'ollama',    label: 'Ollama',    needsKey: false },
]

export default function AI() {
  const toast = useToast()
  const settings = useData('settings')
  const projects = useData('projects') || EMPTY_LIST
  const [active, setActive] = useState('chat')
  const [projectId, setProjectId] = useState('')
  const [provider, setProvider] = useState(settings?.modules?.ai?.provider || 'anthropic')
  const [regenerating, setRegenerating] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)

  const activeProjects = useMemo(() => projects.filter(p => !p.trashedAt && !p.archived), [projects])
  const aiKeysStored = settings?.ai?.keysStored || {}
  const isModeTab = MODES.some(m => m.id === active)
  const providerReady = provider === 'ollama'
    ? !!settings?.modules?.ai?.ollama?.model
    : !!aiKeysStored[provider]

  const activeLabel = MODES.find(m => m.id === active)?.label || SECTIONS.find(s => s.id === active)?.label
  const scopedProject = activeProjects.find(p => p.id === projectId)
  useDiscordPresence(
    isModeTab ? `${activeLabel} mode` : `Browsing ${activeLabel}`,
    isModeTab && scopedProject ? `on ${scopedProject.name}` : null
  )

  const handleProviderChange = (p) => {
    setProvider(p)
    window.api?.settings.update({ modules: { ai: { provider: p } } }).catch(() => {})
  }

  const handleRegenerateSummary = async () => {
    if (!projectId || !window.api) return
    setRegenerating(true)
    try {
      await window.api.ai.brain.projectSummaryGenerate(projectId)
      toast.success('Project context refreshed')
    } catch (e) {
      toast.error('Could not refresh context', e.message)
    } finally {
      setRegenerating(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim() || !window.api) return
    const results = await window.api.ai.brain.search(searchQuery.trim()).catch(() => [])
    setSearchResults(results)
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left nav */}
      <div style={{
        width: 190, flexShrink: 0, padding: '16px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16,
        borderRight: '1px solid var(--border)', background: 'var(--sidebar-bg)',
        backdropFilter: 'var(--panel-blur)', WebkitBackdropFilter: 'var(--panel-blur)',
      }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 8px', marginBottom: 6 }}>Modes</div>
          {MODES.map(m => (
            <button key={m.id} className="ai-nav-btn" onClick={() => setActive(m.id)} style={navBtnStyle(active === m.id)}>{m.label}</button>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 8px', marginBottom: 6 }}>Storage Brain</div>
          {SECTIONS.map(s => (
            <button key={s.id} className="ai-nav-btn" onClick={() => setActive(s.id)} style={navBtnStyle(active === s.id)}>{s.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Topbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', height: 54, flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--accent)', display: 'flex' }}><AIIcon /></span>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>AI</span>

          {isModeTab && (
            <>
              <span style={{ color: 'var(--dimmer)', marginLeft: 4 }}>/</span>
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                style={selectStyle}
              >
                <option value="">No project scope</option>
                {activeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {projectId && (
                <button onClick={handleRegenerateSummary} disabled={regenerating} title="Refresh this project's context from recent activity" style={iconBtnStyle}>
                  <RefreshIcon size={13} />
                </button>
              )}

              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                {PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleProviderChange(p.id)}
                    title={p.needsKey && !aiKeysStored[p.id] ? 'No API key stored yet' : ''}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 10px', borderRadius: 'var(--r-md)',
                      border: `1px solid ${provider === p.id ? 'var(--accent)' : 'var(--border)'}`,
                      background: provider === p.id ? 'var(--accent-dim)' : 'transparent',
                      color: provider === p.id ? 'var(--text)' : 'var(--dimmer)',
                      fontSize: 11, cursor: 'pointer', fontFamily: 'Geist, sans-serif',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    {p.label}
                    {p.needsKey && aiKeysStored[p.id] && <CheckIcon size={10} />}
                  </button>
                ))}
              </div>
            </>
          )}

          {active === 'memories' || active === 'encyclopedia' ? (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Search the brain…"
                style={{ ...selectStyle, cursor: 'text', minWidth: 180 }}
              />
              <button onClick={handleSearch} style={iconBtnStyle}><SearchIcon size={13} /></button>
            </div>
          ) : null}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {isModeTab && (
            providerReady ? (
              <ChatPanel mode={active} provider={provider} projectId={projectId} />
            ) : (
              <ProviderSetup provider={provider} aiKeysStored={aiKeysStored} />
            )
          )}
          {(active === 'memories' || active === 'encyclopedia') && (
            <div style={{ height: '100%', overflowY: 'auto', padding: '20px 24px' }}>
              {searchResults && searchQuery ? (
                <SearchResults results={searchResults} onClear={() => { setSearchResults(null); setSearchQuery('') }} />
              ) : (
                <MemoryBrowser kind={active === 'memories' ? 'memory' : 'encyclopedia'} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SearchResults({ results, onClear }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--dimmer)' }}>{results.length} result{results.length === 1 ? '' : 's'}</span>
        <button onClick={onClear} style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: 12, fontFamily: 'Geist, sans-serif' }}>Clear</button>
      </div>
      {results.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--dimmer)' }}>Nothing matched.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {results.map(r => (
            <div key={r.id} className="pm-card" style={{ marginBottom: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{r.title} <span style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>({r.type})</span></div>
              <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 4 }}>{r.body?.slice(0, 200)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Shown instead of the chat panel until the selected provider is actually
// usable — lets the user finish setup right here (paste a key, or pick an
// Ollama model) instead of just pointing them at Settings and making them
// come back.
function ProviderSetup({ provider, aiKeysStored }) {
  const label = PROVIDERS.find(p => p.id === provider)?.label || provider

  if (provider === 'ollama') {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
          <VaultIcon size={26} />
          <span style={{ fontSize: 13, color: 'var(--dimmer)' }}>No Ollama model selected yet — set it up in Settings → Modules → AI, then come back.</span>
          <button
            onClick={() => window.location.hash = '#/settings'}
            style={{ padding: '8px 16px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 12, cursor: 'pointer', fontFamily: 'Geist, sans-serif', transition: 'background var(--transition-fast)' }}
          >
            Open Settings
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <VaultIcon size={26} />
        <span style={{ fontSize: 13, color: 'var(--dimmer)', textAlign: 'center' }}>No API key stored for {label} yet.</span>
        <div style={{ width: '100%', textAlign: 'left' }}>
          <ApiKeyField provider={provider} keyStored={!!aiKeysStored[provider]} />
        </div>
      </div>
    </div>
  )
}

function navBtnStyle(active) {
  return {
    display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 'var(--r-md)',
    border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'Geist, sans-serif',
    background: active ? 'var(--card)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--dim)', fontWeight: active ? 500 : 400,
    marginBottom: 1, transition: 'background var(--transition-fast), color var(--transition-fast)',
  }
}

const selectStyle = {
  background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 'var(--r-md)', padding: '5px 9px', fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: 'pointer',
  transition: 'border-color var(--transition-fast)',
}
const iconBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 26, height: 26, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
  background: 'transparent', color: 'var(--dim)', cursor: 'pointer',
  transition: 'background var(--transition-fast), color var(--transition-fast)',
}
