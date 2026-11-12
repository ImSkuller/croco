import { useState, useEffect, useCallback } from 'react'
import { UserIcon, FolderIcon, SaveIcon, GitIcon, PaletteIcon, ShieldIcon, TagIcon, RefreshIcon, KeyboardIcon, DatabaseIcon, VaultIcon, CheckIcon, AIIcon, APIIcon, PuzzleIcon } from '../constants/SimpleSvgExports'
import { SettingsNavItem } from '../components/Settings/Exports'
import { useToast } from '../components/Toast/useToast.js'
import { applyTheme, normalizeThemeId } from '../lib/theme.js'
import { applyStyle, normalizeStyleId, applySmoothAnimations } from '../lib/appearanceStyle.js'
import StorageTab from '../components/Settings/StorageTab'
import ObsidianTab from '../components/Settings/ObsidianTab'
import ModulesSection from '../components/Settings/ModulesSection'
import TagsSection from '../components/Settings/TagsSection'
import UpdatesTab from '../components/Settings/UpdatesTab'
import TerminalSection from '../components/Settings/TerminalSection'
import ShortcutsTab from '../components/Settings/ShortcutsTab'
import DangerTab from '../components/Settings/DangerTab'
import GitHubSection from '../components/Settings/GitHubSection'
import AiSection from '../components/Settings/AiSection'
import LocalApiSection from '../components/Settings/LocalApiSection'
import AppearanceSection from '../components/Settings/AppearanceSection'
import GeneralSection from '../components/Settings/GeneralSection'
import UserSection from '../components/Settings/UserSection'
import PathsSection from '../components/Settings/PathsSection'
import DefaultsSection from '../components/Settings/DefaultsSection'
import { mergeDeep } from '../components/Settings/shared.js'
import useDiscordPresence from '../hooks/useDiscordPresence'

const NAV_SECTIONS = [
  { id: 'user',       label: 'User',         icon: <UserIcon />    },
  { id: 'paths',      label: 'Folders',      icon: <FolderIcon />  },
  { id: 'defaults',   label: 'New Projects', icon: <SaveIcon />    },
  { id: 'tags',       label: 'Tags',         icon: <TagIcon />     },
  { id: 'github',     label: 'GitHub',       icon: <GitIcon />     },
  { id: 'ai',         label: 'AI',           icon: <AIIcon />      },
  { id: 'localApi',   label: 'Local API',    icon: <APIIcon />     },
  { id: 'modules',    label: 'Modules',      icon: <PuzzleIcon />, badge: true },
  { id: 'appearance', label: 'Appearance',   icon: <PaletteIcon /> },
  { id: 'behaviour',  label: 'General',      icon: <TagIcon />     },
  { id: 'storage',    label: 'Storage',      icon: <DatabaseIcon /> },
  { id: 'obsidian',   label: 'Obsidian',     icon: <VaultIcon />   },
  { id: 'shortcuts',  label: 'Shortcuts',    icon: <KeyboardIcon />},
  { id: 'terminal',   label: 'Terminal App', icon: <APIIcon />     },
  { id: 'updates',    label: 'Updates',      icon: <RefreshIcon /> },
  { id: 'danger',     label: 'Danger Zone',  icon: <ShieldIcon />  },
]

export default function Settings() {
  const toast = useToast()
  const [activeSection, setActiveSection] = useState('user')
  useDiscordPresence('In Settings', NAV_SECTIONS.find(s => s.id === activeSection)?.label)

  // Latest copy of the settings (for sections that read their own values from
  // it). `version` is bumped when everything is replaced at once (Reset) so
  // sections remount with the fresh values.
  const [settings, setSettings] = useState(null)
  const [version,  setVersion]  = useState(0)
  const [appDataPath, setAppDataPath] = useState('')

  // Updates the local copy only.
  const patchLocal = useCallback((patch) => setSettings(prev => mergeDeep(prev || {}, patch)), [])
  // Every control on this page saves itself the moment it changes: it updates
  // the local copy and persists the same patch. Free-text fields call this
  // onBlur instead of on every keystroke.
  const saveField = useCallback((patch) => {
    patchLocal(patch)
    return window.api?.settings.update(patch).catch(console.error)
  }, [patchLocal])

  // Shell preference
  const [platform,         setPlatform]         = useState('win32')

  const applySettings = useCallback((s) => {
    if (!s) return
    setSettings(s)
    const backend = s.app?.storageBackend || 'json'
    window._currentStorageBackend = backend
  }, [])

  useEffect(() => {
    if (!window.api) return
    Promise.all([
      window.api.settings.get(),
      window.api.system.userData(),
      window.api.system.platform(),
    ])
      .then(([s, userData, plat]) => {
        applySettings(s)
        setAppDataPath(userData || '')
        setPlatform(plat || 'win32')
      })
      .catch(console.error)
  }, [applySettings])

  // Puts every setting back to its default and re-applies the default look.
  const handleReset = async () => {
    if (window.api) {
      const defaults = await window.api.settings.reset().catch(console.error)
      if (defaults) {
        applySettings(defaults)
        setVersion(v => v + 1)
        const a = defaults.appearance || {}
        applyTheme(normalizeThemeId(a.theme || 'default'), !!a.glass, {
          accentColor: a.accentColor || '#e8e4dc',
          fontBody:    a.fontBody    || 'Geist',
          fontDisplay: a.fontDisplay || 'Lora',
          logoBg:      a.logoBg      || '#ffffff',
        })
        applyStyle(normalizeStyleId(a.style || 'apple'))
        applySmoothAnimations(a.smoothAnimations ?? true)
        window.api?.system.setWindowGlass(!!a.glass).catch(console.error)
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 28px', height: 54, flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--dim)' }}>Settings</span>
        <span style={{ color: 'var(--dimmer)' }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
          {NAV_SECTIONS.find(s => s.id === activeSection)?.label}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--dimmer)' }}>
          <CheckIcon size={12} /> Changes save automatically
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Sidebar nav */}
        <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--border)', padding: '16px 10px', overflowY: 'auto' }}>
          {NAV_SECTIONS.map(s => (
            <SettingsNavItem
              key={s.id}
              section={s}
              active={activeSection === s.id}
              danger={s.id === 'danger'}
              onClick={() => setActiveSection(s.id)}
            />
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <div className="pm-page" style={{ maxWidth: 640, padding: '32px 40px' }}>

            {settings && activeSection === 'user'     && <UserSection     key={version} settings={settings} saveField={saveField} patchLocal={patchLocal} />}
            {settings && activeSection === 'paths'    && <PathsSection    key={version} settings={settings} saveField={saveField} appDataPath={appDataPath} />}
            {settings && activeSection === 'defaults' && <DefaultsSection key={version} settings={settings} saveField={saveField} platform={platform} />}

            {settings && activeSection === 'github'   && <GitHubSection   key={version} settings={settings} saveField={saveField} patchLocal={patchLocal} />}

            {settings && activeSection === 'ai'       && <AiSection       key={version} settings={settings} saveField={saveField} patchLocal={patchLocal} />}
            {settings && activeSection === 'localApi' && <LocalApiSection key={version} settings={settings} saveField={saveField} />}

            {/* Tags */}
            {activeSection === 'tags' && <TagsSection />}

            {/* Modules */}
            {activeSection === 'modules' && <ModulesSection aiKeysStored={settings?.ai?.keysStored || {}} />}

            {/* Appearance */}
            {settings && activeSection === 'appearance' && <AppearanceSection key={version} settings={settings} saveField={saveField} />}

            {settings && activeSection === 'behaviour' && <GeneralSection key={version} settings={settings} saveField={saveField} />}

            {settings && activeSection === 'storage'  && <StorageTab  key={version} settings={settings} saveField={saveField} />}
            {settings && activeSection === 'obsidian' && <ObsidianTab key={version} settings={settings} saveField={saveField} />}

            {/* Terminal app */}
            {activeSection === 'terminal' && <TerminalSection toast={toast} />}

            {settings && activeSection === 'updates' && <UpdatesTab key={version} settings={settings} saveField={saveField} />}
            {settings && activeSection === 'shortcuts' && <ShortcutsTab key={version} settings={settings} />}
            {activeSection === 'danger' && <DangerTab key={version} onReset={handleReset} />}

          </div>
        </div>
      </div>
    </div>
  )
}
