import { useState, useEffect, useCallback, useRef } from 'react'
import { UserIcon, FolderIcon, SaveIcon, GitIcon, PaletteIcon, ShieldIcon, TagIcon, RefreshIcon, KeyboardIcon, DatabaseIcon, VaultIcon, CheckIcon, AIIcon, APIIcon, PuzzleIcon } from '../constants/SimpleSvgExports'
import { SettingsNavItem } from '../components/Settings/Exports'
import { useToast } from '../components/Toast/useToast.js'
import { applyTheme, normalizeThemeId } from '../lib/theme.js'
import { applyStyle, normalizeStyleId, applySmoothAnimations } from '../lib/appearanceStyle.js'
import { SHORTCUT_DEFS } from '../lib/shortcuts'
import StorageSection from '../components/Settings/StorageSection'
import ObsidianSection from '../components/Settings/ObsidianSection'
import ModulesSection from '../components/Settings/ModulesSection'
import TagsSection from '../components/Settings/TagsSection'
import UpdatesSection from '../components/Settings/UpdatesSection'
import TerminalSection from '../components/Settings/TerminalSection'
import ShortcutsSection from '../components/Settings/ShortcutsSection'
import DangerSection from '../components/Settings/DangerSection'
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

  const [resetConfirm,     setResetConfirm]     = useState(false)
  const [rerunConfirm,     setRerunConfirm]     = useState(false)
  const [dangerConfirm,    setDangerConfirm]    = useState(null) // null | 'todos' | 'notes' | 'projects'
  // Shell preference
  const [platform,         setPlatform]         = useState('win32')

  // Storage
  const [storageBackend,   setStorageBackend]   = useState('json') // 'json' | 'sqlite'
  const [migrating,        setMigrating]        = useState(false)
  const [migrateResult,    setMigrateResult]    = useState(null) // null | { ok: bool, message: str }

  // Backup / restore
  const [backupBusy,       setBackupBusy]       = useState(null) // null | 'export' | 'import'
  const [backupResult,     setBackupResult]     = useState(null) // null | { ok: bool, message: str }

  // Scheduled automatic backups
  const [autoBackupEnabled,   setAutoBackupEnabled]   = useState(true)
  const [autoBackupInterval,  setAutoBackupInterval]  = useState(1)
  const [autoBackupRetention, setAutoBackupRetention] = useState(7)
  const [autoBackupLastAt,    setAutoBackupLastAt]    = useState(null)
  const [autoBackupBusy,      setAutoBackupBusy]      = useState(false)
  const [autoBackupResult,    setAutoBackupResult]    = useState(null) // null | { ok: bool, message: str }

  // Obsidian vault sync
  const [obsidianEnabled,    setObsidianEnabled]    = useState(false)
  const [obsidianVaultPath,  setObsidianVaultPath]  = useState('')
  const [obsidianLastSync,   setObsidianLastSync]   = useState(null)
  const [obsidianPathCheck,  setObsidianPathCheck]  = useState(null) // null | { valid: bool, message?: str }
  const [obsidianSyncing,    setObsidianSyncing]    = useState(false)
  const [obsidianSyncResult, setObsidianSyncResult] = useState(null) // null | { ok: bool, message: str }

  // Shortcuts
  const [shortcutOverrides, setShortcutOverrides] = useState({})
  const [capturingId,       setCapturingId]       = useState(null)
  const shortcutOverridesRef = useRef({})
  useEffect(() => { shortcutOverridesRef.current = shortcutOverrides }, [shortcutOverrides])

  useEffect(() => {
    if (!capturingId) return
    const def = SHORTCUT_DEFS.find(d => d.id === capturingId)
    if (!def) return
    const handler = (e) => {
      if (e.key === 'Escape') { setCapturingId(null); return }
      if (['Control','Shift','Alt','Meta'].includes(e.key)) return
      e.preventDefault(); e.stopPropagation()
      let key
      if (def.chord) {
        if (e.key.length > 1) return
        key = `g+${e.key.toLowerCase()}`
      } else {
        const parts = []
        if (e.ctrlKey || e.metaKey) parts.push('ctrl')
        if (e.shiftKey) parts.push('shift')
        parts.push(e.key.toLowerCase())
        key = parts.join('+')
      }
      const next = { ...shortcutOverridesRef.current, [capturingId]: key }
      setShortcutOverrides(next)
      window.api?.settings.update({ app: { shortcuts: next } }).catch(() => {})
      window.dispatchEvent(new Event('croco:shortcuts-changed'))
      setCapturingId(null)
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [capturingId])

  // Updates
  const [updateInfo,       setUpdateInfo]       = useState(null) // null | {checking} | result
  const [updateChecking,   setUpdateChecking]   = useState(false)
  const [updateInstalling, setUpdateInstalling] = useState(false)

  const applySettings = useCallback((s) => {
    if (!s) return
    setSettings(s)
    setShortcutOverrides(s.app?.shortcuts || {})
    const backend = s.app?.storageBackend || 'json'
    setStorageBackend(backend)
    window._currentStorageBackend = backend
    setObsidianEnabled(s.app?.obsidian?.enabled || false)
    setObsidianVaultPath(s.app?.obsidian?.vaultPath || '')
    setObsidianLastSync(s.app?.obsidian?.lastSyncAt || null)
    setAutoBackupEnabled(s.app?.autoBackup?.enabled ?? true)
    setAutoBackupInterval(s.app?.autoBackup?.intervalDays || 1)
    setAutoBackupRetention(s.app?.autoBackup?.retentionCount || 7)
    setAutoBackupLastAt(s.app?.autoBackup?.lastBackupAt || null)
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

  const handleObsidianToggle = () => {
    setObsidianEnabled(prev => {
      const next = !prev
      window.api?.settings.update({ app: { obsidian: { enabled: next, vaultPath: obsidianVaultPath } } }).catch(() => {})
      return next
    })
  }

  const handlePickVault = async () => {
    if (!window.api) return
    const picked = await window.api.system.showFolderPicker()
    if (!picked) return
    const check = await window.api.obsidian.testVaultPath(picked).catch(() => ({ valid: false, message: 'Could not validate this folder.' }))
    setObsidianPathCheck(check)
    if (!check.valid) return
    setObsidianVaultPath(picked)
    window.api.settings.update({ app: { obsidian: { enabled: obsidianEnabled, vaultPath: picked } } }).catch(() => {})
  }

  const handleObsidianSyncNow = async () => {
    if (!window.api) return
    setObsidianSyncing(true)
    setObsidianSyncResult(null)
    try {
      const r = await window.api.obsidian.syncAll()
      const failedPart = r.failed ? `, ${r.failed} failed` : ''
      setObsidianSyncResult({ ok: true, message: `Synced ${r.synced} note${r.synced === 1 ? '' : 's'}${failedPart}.` })
      setObsidianLastSync(new Date().toISOString())
    } catch (err) {
      setObsidianSyncResult({ ok: false, message: err?.message || String(err) })
    } finally {
      setObsidianSyncing(false)
    }
  }

  const handleAutoBackupToggle = () => {
    setAutoBackupEnabled(prev => {
      const next = !prev
      window.api?.settings.update({ app: { autoBackup: { enabled: next, intervalDays: autoBackupInterval, retentionCount: autoBackupRetention } } }).catch(() => {})
      return next
    })
  }

  const handleAutoBackupIntervalChange = (days) => {
    setAutoBackupInterval(days)
    window.api?.settings.update({ app: { autoBackup: { enabled: autoBackupEnabled, intervalDays: days, retentionCount: autoBackupRetention } } }).catch(() => {})
  }

  const handleAutoBackupRetentionChange = (count) => {
    setAutoBackupRetention(count)
    window.api?.settings.update({ app: { autoBackup: { enabled: autoBackupEnabled, intervalDays: autoBackupInterval, retentionCount: count } } }).catch(() => {})
  }

  const handleBackUpNow = async () => {
    if (!window.api) return
    setAutoBackupBusy(true)
    setAutoBackupResult(null)
    try {
      await window.api.data.backupNow()
      const now = new Date().toISOString()
      setAutoBackupLastAt(now)
      setAutoBackupResult({ ok: true, message: 'Backup saved.' })
    } catch (err) {
      setAutoBackupResult({ ok: false, message: err?.message || String(err) })
    } finally {
      setAutoBackupBusy(false)
    }
  }

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
    setResetConfirm(false)
  }

  const handleRerunSetup = async () => {
    if (window.api) {
      await window.api.settings.update({ app: { onboarded: false } }).catch(console.error)
    }
    setRerunConfirm(false)
    window.location.reload()
  }

  const handleClearTodos = async () => {
    if (!window.api) return
    setDangerConfirm(null)
    const todos = await window.api.todos.getAll().catch(console.error) || []
    await Promise.all(todos.map(t => window.api.todos.delete(t.id).catch(console.error)))
    window.dispatchEvent(new CustomEvent('croco:data-changed'))
  }

  const handleClearNotes = async () => {
    if (!window.api) return
    setDangerConfirm(null)
    const notes = await window.api.notes.getAll().catch(console.error) || []
    await Promise.all(notes.map(n => window.api.notes.delete(n.id).catch(console.error)))
    window.dispatchEvent(new CustomEvent('croco:data-changed'))
  }

  const handleDeleteProjects = async () => {
    if (!window.api) return
    setDangerConfirm(null)
    const projects = await window.api.projects.getAll().catch(console.error) || []
    await Promise.all(projects.map(p => window.api.projects.delete(p.id).catch(console.error)))
    window.dispatchEvent(new CustomEvent('croco:data-changed'))
  }


  const DANGER_ACTIONS = {
    todos:    { label: 'Clear all todos?',    body: 'This will permanently delete every todo across all projects. This cannot be undone.', confirm: 'Clear Todos',    fn: handleClearTodos    },
    notes:    { label: 'Clear all notes?',    body: 'This will permanently delete every note across all projects. This cannot be undone.', confirm: 'Clear Notes',    fn: handleClearNotes    },
    projects: { label: 'Delete all projects?', body: 'This removes all project metadata from the app. Your actual code folders are not deleted.', confirm: 'Delete All', fn: handleDeleteProjects },
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

            {/* Storage */}
            {activeSection === 'storage' && (
              <StorageSection
                storageBackend={storageBackend} setStorageBackend={setStorageBackend}
                migrating={migrating} setMigrating={setMigrating}
                migrateResult={migrateResult} setMigrateResult={setMigrateResult}
                backupBusy={backupBusy} setBackupBusy={setBackupBusy}
                backupResult={backupResult} setBackupResult={setBackupResult}
                autoBackupEnabled={autoBackupEnabled} onToggleAutoBackup={handleAutoBackupToggle}
                autoBackupInterval={autoBackupInterval} onChangeAutoBackupInterval={handleAutoBackupIntervalChange}
                autoBackupRetention={autoBackupRetention} onChangeAutoBackupRetention={handleAutoBackupRetentionChange}
                autoBackupLastAt={autoBackupLastAt}
                autoBackupBusy={autoBackupBusy} autoBackupResult={autoBackupResult}
                onBackUpNow={handleBackUpNow}
              />
            )}

            {/* Obsidian */}
            {activeSection === 'obsidian' && (
              <ObsidianSection
                obsidianEnabled={obsidianEnabled} handleObsidianToggle={handleObsidianToggle}
                obsidianVaultPath={obsidianVaultPath} setObsidianVaultPath={setObsidianVaultPath}
                handlePickVault={handlePickVault} obsidianPathCheck={obsidianPathCheck}
                obsidianSyncResult={obsidianSyncResult} obsidianLastSync={obsidianLastSync}
                obsidianSyncing={obsidianSyncing} handleObsidianSyncNow={handleObsidianSyncNow}
              />
            )}

            {/* Terminal app */}
            {activeSection === 'terminal' && <TerminalSection toast={toast} />}

            {/* Updates */}
            {activeSection === 'updates' && (
              <UpdatesSection
                updateChecking={updateChecking} setUpdateChecking={setUpdateChecking}
                updateInfo={updateInfo} setUpdateInfo={setUpdateInfo}
                updateInstalling={updateInstalling} setUpdateInstalling={setUpdateInstalling}
                toast={toast}
              />
            )}

            {/* Shortcuts */}
            {activeSection === 'shortcuts' && (
              <ShortcutsSection
                capturingId={capturingId} setCapturingId={setCapturingId}
                shortcutOverrides={shortcutOverrides} setShortcutOverrides={setShortcutOverrides}
              />
            )}

            {/* Danger Zone */}
            {activeSection === 'danger' && (
              <DangerSection
                rerunConfirm={rerunConfirm} setRerunConfirm={setRerunConfirm} handleRerunSetup={handleRerunSetup}
                resetConfirm={resetConfirm} setResetConfirm={setResetConfirm} handleReset={handleReset}
                dangerConfirm={dangerConfirm} setDangerConfirm={setDangerConfirm} dangerActions={DANGER_ACTIONS}
              />
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
