import { useState, useEffect, useCallback, useRef } from 'react'
import { UserIcon, FolderIcon, SaveIcon, GitIcon, PaletteIcon, ShieldIcon, TagIcon, RefreshIcon, KeyboardIcon, DatabaseIcon, VaultIcon } from '../constants/SimpleSvgExports'
import { SettingsNavItem, SectionTitle, SettingsCard, FieldLabel, FieldDesc, TextInput, PathInput, IDEOption, ToggleChip, InfoBox, SmallBtn, SaveBtn } from '../components/Settings/Exports'
import { useToast } from '../components/Toast/useToast.js'
import { THEMES, applyTheme, getThemeAccentSwatch, normalizeThemeId } from '../lib/theme.js'
import { STYLES, applyStyle, normalizeStyleId } from '../lib/appearanceStyle.js'
import { SHORTCUT_DEFS } from '../lib/shortcuts'
import StorageSection from '../components/Settings/StorageSection'
import ObsidianSection from '../components/Settings/ObsidianSection'
import UpdatesSection from '../components/Settings/UpdatesSection'
import ShortcutsSection from '../components/Settings/ShortcutsSection'
import DangerSection from '../components/Settings/DangerSection'

const codeStyle = {
  fontFamily:   'Geist Mono, monospace',
  fontSize:     11,
  background:   'var(--border)',
  color:        'var(--text)',
  padding:      '1px 5px',
  borderRadius: 4,
}

const IDE_OPTIONS = [
  { value: 'vscode',    label: 'Visual Studio Code' },
  { value: 'cursor',    label: 'Cursor'             },
  { value: 'windsurf',  label: 'Windsurf'           },
  { value: 'trae',      label: 'Trae'               },
  { value: 'zed',       label: 'Zed'                },
  { value: 'fleet',     label: 'Fleet'              },
  { value: 'webstorm',  label: 'WebStorm'           },
  { value: 'idea',      label: 'IntelliJ IDEA'      },
  { value: 'sublime',   label: 'Sublime Text'       },
  { value: 'neovim',    label: 'Neovim'             },
  { value: 'vim',       label: 'Vim'                },
]

const PRESET_TAGS = [
  'Developer', 'Designer', 'Student',    'Hobbyist',
  'Builder',   'Maker',    'Engineer',   'Researcher',
  'Freelancer','Open Source','Architect','Hacker',
]

const NAV_SECTIONS = [
  { id: 'user',       label: 'User',         icon: <UserIcon />    },
  { id: 'paths',      label: 'Paths',        icon: <FolderIcon />  },
  { id: 'defaults',   label: 'Defaults',     icon: <SaveIcon />    },
  { id: 'github',     label: 'GitHub',       icon: <GitIcon />     },
  { id: 'appearance', label: 'Appearance',   icon: <PaletteIcon /> },
  { id: 'behaviour',  label: 'Behaviour',    icon: <TagIcon />     },
  { id: 'storage',    label: 'Storage',      icon: <DatabaseIcon /> },
  { id: 'obsidian',   label: 'Obsidian',     icon: <VaultIcon />   },
  { id: 'shortcuts',  label: 'Shortcuts',    icon: <KeyboardIcon />},
  { id: 'updates',    label: 'Updates',      icon: <RefreshIcon /> },
  { id: 'danger',     label: 'Danger Zone',  icon: <ShieldIcon />  },
]

const SHELL_OPTIONS = {
  win32:  [{ value: '',           label: 'cmd.exe (default)' }, { value: 'powershell', label: 'PowerShell' }],
  other:  [{ value: '',           label: 'sh (default)' }, { value: 'bash', label: 'Bash' }, { value: 'zsh', label: 'Zsh' }, { value: 'fish', label: 'Fish' }],
}

export default function Settings() {
  const toast = useToast()
  const [activeSection, setActiveSection] = useState('user')
  const [saved,         setSaved]         = useState(false)
  const [loading,       setLoading]       = useState(true)

  const [userName,    setUserName]    = useState('')

  const [publicPath,  setPublicPath]  = useState('')
  const [hiddenPath,  setHiddenPath]  = useState('')
  const [appDataPath, setAppDataPath] = useState('')

  const [defaultIDE,        setDefaultIDE]        = useState('vscode')
  const [defaultBranch,     setDefaultBranch]     = useState('main')
  const [defaultVisibility, setDefaultVisibility] = useState('public')

  const [ghUsername,    setGhUsername]    = useState('')
  const [ghToken,       setGhToken]       = useState('')
  const [ghTestStatus,  setGhTestStatus]  = useState(null) // null | 'testing' | {ok, login, message}
  const [userAvatar,    setUserAvatar]    = useState(null)
  const [oauthEnabled,  setOauthEnabled]  = useState(true) // optimistic default (always true in shipped builds); corrected after the async check below
  const [oauthData,     setOauthData]     = useState(null) // {user_code, verification_uri, device_code, interval}
  const [oauthPolling,  setOauthPolling]  = useState(false)
  const oauthPollRef = useRef(null) // { timerId, inFlight } — lets us clear/reschedule and avoid overlapping poll requests

  const [userTag,       setUserTag]       = useState('Developer')
  const [tagLocked,     setTagLocked]     = useState(false)
  const [closeBehavior, setCloseBehavior] = useState('tray')
  const [customDataPath,setCustomDataPath]= useState('')
  const [launchOnStartup, setLaunchOnStartup] = useState(false)
  const [launchOnStartupBusy, setLaunchOnStartupBusy] = useState(false)

  const [accentColor,      setAccentColor]      = useState('#e8e4dc')
  const [selectedTheme,    setSelectedTheme]    = useState('default')
  const [selectedStyle,    setSelectedStyle]    = useState('default')
  const [glassEnabled,     setGlassEnabled]     = useState(false)
  const [fontBody,         setFontBody]         = useState('Geist')
  const [fontDisplay,      setFontDisplay]      = useState('Lora')
  const [logoBg,           setLogoBg]           = useState('#ffffff')
  const [resetConfirm,     setResetConfirm]     = useState(false)
  const [rerunConfirm,     setRerunConfirm]     = useState(false)
  const [dangerConfirm,    setDangerConfirm]    = useState(null) // null | 'todos' | 'notes' | 'projects'
  // Shell preference
  const [defaultShell,     setDefaultShell]     = useState('')
  const [platform,         setPlatform]         = useState('win32')

  // Storage
  const [storageBackend,   setStorageBackend]   = useState('json') // 'json' | 'sqlite'
  const [migrating,        setMigrating]        = useState(false)
  const [migrateResult,    setMigrateResult]    = useState(null) // null | { ok: bool, message: str }

  // Backup / restore
  const [backupBusy,       setBackupBusy]       = useState(null) // null | 'export' | 'import'
  const [backupResult,     setBackupResult]     = useState(null) // null | { ok: bool, message: str }

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

  useEffect(() => {
    const html = document.documentElement
    html.style.setProperty('--orange', accentColor)
    html.style.setProperty('--accent', accentColor)
    if (accentColor.startsWith('#') && accentColor.length === 7) {
      const r = parseInt(accentColor.slice(1, 3), 16)
      const g = parseInt(accentColor.slice(3, 5), 16)
      const b = parseInt(accentColor.slice(5, 7), 16)
      html.style.setProperty('--accent-dim',  `rgba(${r},${g},${b},0.12)`)
      html.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.25)`)
    }
  }, [accentColor])

  useEffect(() => {
    document.documentElement.style.setProperty('--font-body', `'${fontBody}', sans-serif`)
  }, [fontBody])

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--font-display',
      fontDisplay === 'inherit' ? 'var(--font-body)' : `'${fontDisplay}', serif`
    )
  }, [fontDisplay])

  useEffect(() => {
    document.documentElement.style.setProperty('--logo-bg', logoBg)
  }, [logoBg])

  const applySettings = useCallback((s) => {
    if (!s) return
    setUserName(s.user?.name || '')
    setUserAvatar(s.user?.avatar || null)
    setUserTag(s.user?.tag || 'Developer')
    setPublicPath(s.paths?.publicProjects || '')
    setHiddenPath(s.paths?.hiddenProjects || '')
    setDefaultIDE(s.defaults?.ide || 'vscode')
    setDefaultBranch(s.defaults?.gitBranch || 'main')
    setDefaultVisibility(s.defaults?.visibility || 'public')
    setGhUsername(s.user?.github?.username || '')
    setGhToken(s.user?.github?.token || '')
    setCloseBehavior(s.app?.closeBehavior || 'tray')
    setCustomDataPath(s.app?.dataPath || '')
    const color = s.appearance?.accentColor || '#e8e4dc'
    setAccentColor(color)
    const theme = normalizeThemeId(s.appearance?.theme || 'default')
    const glass = s.appearance?.glass || false
    setSelectedTheme(theme)
    setGlassEnabled(glass)
    setSelectedStyle(normalizeStyleId(s.appearance?.style || 'default'))
    setFontBody(s.appearance?.fontBody || 'Geist')
    setFontDisplay(s.appearance?.fontDisplay || 'Lora')
    setLogoBg(s.appearance?.logoBg || '#ffffff')
    setDefaultShell(s.defaults?.shell || '')
    setShortcutOverrides(s.app?.shortcuts || {})
    const backend = s.app?.storageBackend || 'json'
    setStorageBackend(backend)
    window._currentStorageBackend = backend
    setObsidianEnabled(s.app?.obsidian?.enabled || false)
    setObsidianVaultPath(s.app?.obsidian?.vaultPath || '')
    setObsidianLastSync(s.app?.obsidian?.lastSyncAt || null)
  }, [])

  useEffect(() => {
    if (!window.api) { Promise.resolve().then(() => setLoading(false)); return }
    window.api.github?.oauthConfigured().then(v => setOauthEnabled(!!v)).catch(() => {})
    window.api.app?.autostart.isEnabled().then(setLaunchOnStartup).catch(() => {})
    Promise.all([
      window.api.settings.get(),
      window.api.system.userData(),
      window.api.system.platform(),
    ])
      .then(([s, userData, plat]) => {
        applySettings(s)
        setAppDataPath(userData || '')
        setPlatform(plat || 'win32')
        // Check if user has a locked community tag
        const ghUser = s.user?.github?.username
        if (ghUser) {
          window.api.system.lookupCommunityUser(ghUser)
            .then(cu => { if (cu?.locked) setTagLocked(true) })
            .catch(() => {})
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [applySettings])

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

  const pickFolder = async (setter) => {
    if (!window.api) return
    const picked = await window.api.system.showFolderPicker()
    if (picked) setter(picked)
  }

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

  const handleAvatarUpload = async () => {
    if (!window.api) return
    const filePath = await window.api.system.showFilePicker(null, [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg'] },
    ])
    if (!filePath) return
    try {
      const b64 = await window.api.settings.saveAvatar(filePath)
      setUserAvatar(b64)
    } catch (e) {
      toast.error('Avatar upload failed', e.message)
    }
  }

  const handleTestGithub = async () => {
    if (!ghToken.trim()) return
    setGhTestStatus('testing')
    const result = await window.api.settings.testGithub(ghToken).catch(e => ({ ok: false, message: e.message }))
    setGhTestStatus(result)
    if (result?.ok && result.login) setGhUsername(result.login)
  }

  // Stops any in-flight poll timer — guards against orphaned pollers from a
  // previous click/unmount that would otherwise keep running invisibly and
  // race with a fresh attempt.
  const stopOauthPolling = () => {
    if (oauthPollRef.current?.timerId) clearInterval(oauthPollRef.current.timerId)
    oauthPollRef.current = null
  }

  useEffect(() => stopOauthPolling, [])

  const handleOAuthStart = async () => {
    setGhTestStatus(null)
    stopOauthPolling()
    try {
      const data = await window.api.github.oauthStart()
      setOauthData(data)
      await window.api.system.openExternal(data.verification_uri)
      setOauthPolling(true)

      // GitHub's device codes expire (~15 min) — without a client-side
      // deadline too, a poll response that never resolves to success/error
      // (e.g. an org requiring admin approval keeps returning
      // authorization_pending) leaves the UI stuck on "Waiting for
      // authorisation" forever with no way out but Cancel.
      const deadline = Date.now() + (data.expires_in || 900) * 1000
      const state = { timerId: null, inFlight: false }
      oauthPollRef.current = state

      const finish = (status) => {
        clearInterval(state.timerId)
        oauthPollRef.current = null
        setOauthPolling(false)
        setOauthData(null)
        setGhTestStatus(status)
      }

      const tick = async () => {
        if (state.inFlight) return // previous poll still in flight — don't pile up requests
        if (Date.now() > deadline) {
          finish({ ok: false, message: 'GitHub login timed out before it was approved. Try again, or paste a personal access token below instead.' })
          return
        }
        state.inFlight = true
        try {
          const res = await window.api.github.oauthPoll(data.device_code)
          if (res?.status === 'success') {
            const login = res.login || ''
            const token = res.token || ''
            finish({ ok: true, login })
            setGhToken(token)
            setGhUsername(login)
            // Auto-save credentials so they persist without requiring a manual Save click
            await window.api.settings.update({ user: { github: { username: login, token } } }).catch(console.error)
            // Lookup community tag
            if (login) {
              const cu = await window.api.system.lookupCommunityUser(login).catch(() => null)
              if (cu) setUserTag(cu.tag)
            }
          } else if (res?.status === 'access_denied' || res?.status === 'expired_token') {
            finish({ ok: false, message: 'Login was denied or expired.' })
          } else if (res?.status === 'slow_down') {
            // GitHub is asking us to back off — restart the timer at a longer interval
            clearInterval(state.timerId)
            state.timerId = setInterval(tick, ((data.interval || 5) + 5) * 1000)
          }
          // 'authorization_pending' → keep polling silently
        } catch (e) {
          finish({ ok: false, message: `Login error: ${e?.toString() || 'Unknown error'}` })
        } finally {
          state.inFlight = false
        }
      }
      state.timerId = setInterval(tick, (data.interval || 5) * 1000)
    } catch (e) {
      setOauthPolling(false)
      setGhTestStatus({ ok: false, message: e?.toString() || 'Failed to start GitHub login.' })
    }
  }

  const handleSave = async () => {
    if (window.api) {
      await window.api.settings.update({
        user: { name: userName, tag: userTag, github: { username: ghUsername, token: ghToken } },
        paths: { publicProjects: publicPath, hiddenProjects: hiddenPath },
        defaults: { ide: defaultIDE, gitBranch: defaultBranch, visibility: defaultVisibility, shell: defaultShell },
        appearance: { accentColor, theme: selectedTheme, style: selectedStyle, glass: glassEnabled, fontBody, fontDisplay, logoBg },
        app: { closeBehavior, dataPath: customDataPath, shortcuts: shortcutOverrides },
      }).catch(console.error)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    toast.success('Settings saved')
  }

  const handleReset = async () => {
    if (window.api) {
      const defaults = await window.api.settings.reset().catch(console.error)
      if (defaults) applySettings(defaults)
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
  }

  const handleClearNotes = async () => {
    if (!window.api) return
    setDangerConfirm(null)
    const notes = await window.api.notes.getAll().catch(console.error) || []
    await Promise.all(notes.map(n => window.api.notes.delete(n.id).catch(console.error)))
  }

  const handleDeleteProjects = async () => {
    if (!window.api) return
    setDangerConfirm(null)
    const projects = await window.api.projects.getAll().catch(console.error) || []
    await Promise.all(projects.map(p => window.api.projects.delete(p.id).catch(console.error)))
  }

  const ghConnected = ghUsername.trim() !== '' && ghToken.trim() !== ''

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
        <div style={{ marginLeft: 'auto' }}>
          <SaveBtn saved={saved} onClick={handleSave} />
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

            {/* User */}
            {activeSection === 'user' && (
              <>
                <SectionTitle icon={<UserIcon />} title="User" desc="Your profile information displayed across the app." />

                <SettingsCard>
                  <FieldLabel>Avatar</FieldLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'var(--text)', fontFamily: 'Geist Mono, monospace', flexShrink: 0, overflow: 'hidden' }}>
                      {userAvatar
                        ? <img src={userAvatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : (userName.slice(0, 2).toUpperCase() || '??')}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <SmallBtn onClick={handleAvatarUpload}>Upload Photo</SmallBtn>
                      {userAvatar && (
                        <SmallBtn onClick={() => { setUserAvatar(null); window.api?.settings.update({ user: { avatar: null } }) }}>
                          Remove
                        </SmallBtn>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--dimmer)' }}>PNG or JPG, max 2MB</span>
                    </div>
                  </div>
                </SettingsCard>

                <SettingsCard>
                  <FieldLabel>Display Name</FieldLabel>
                  <FieldDesc>Shown in the sidebar and on the dashboard greeting.</FieldDesc>
                  <TextInput value={userName} onChange={setUserName} placeholder="Your name" />
                </SettingsCard>

                <SettingsCard>
                  <FieldLabel>Tag</FieldLabel>
                  <FieldDesc>Shown under your name in the sidebar.</FieldDesc>
                  {tagLocked ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        background: 'var(--accent-dim)', border: '1px solid var(--accent)',
                        borderRadius: 20, padding: '6px 14px',
                      }}>
                        <span style={{ fontSize: 14 }}>🔒</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{userTag}</span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
                        predefined by the author
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                      {PRESET_TAGS.map(tag => (
                        <button
                          key={tag}
                          onClick={() => setUserTag(tag)}
                          style={{
                            padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                            fontFamily: 'Geist, sans-serif', fontSize: 12,
                            border:     `1px solid ${userTag === tag ? 'var(--accent)' : 'var(--border)'}`,
                            background: userTag === tag ? 'var(--accent-dim)' : 'var(--card)',
                            color:      userTag === tag ? 'var(--text)'       : 'var(--dim)',
                            transition: 'all 0.1s',
                          }}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </SettingsCard>
              </>
            )}

            {/* Paths */}
            {activeSection === 'paths' && (
              <>
                <SectionTitle icon={<FolderIcon />} title="Paths" desc="Configure where projects and app data are stored on your machine." />

                <SettingsCard>
                  <FieldLabel>Public Projects Path</FieldLabel>
                  <FieldDesc>Default location where new public projects are stored.</FieldDesc>
                  <PathInput value={publicPath} onChange={setPublicPath} onBrowse={() => pickFolder(setPublicPath)} />
                </SettingsCard>

                <SettingsCard>
                  <FieldLabel>Hidden Projects Path</FieldLabel>
                  <FieldDesc>Location for private/hidden projects. This folder is hidden from the OS file explorer.</FieldDesc>
                  <PathInput value={hiddenPath} onChange={setHiddenPath} onBrowse={() => pickFolder(setHiddenPath)} />
                  <InfoBox>On Windows this folder has the Hidden attribute set via <code style={codeStyle}>attrib +h</code>. On macOS/Linux the dot prefix hides it automatically.</InfoBox>
                </SettingsCard>

                <SettingsCard>
                  <FieldLabel>App Data Path</FieldLabel>
                  <FieldDesc>Where Croco stores all project metadata, notes, and todos.</FieldDesc>
                  <PathInput value={loading ? 'Loading…' : appDataPath} onChange={() => {}} disabled />
                </SettingsCard>

                <SettingsCard>
                  <FieldLabel>Custom Data Path</FieldLabel>
                  <FieldDesc>Override the data storage location (e.g. a Dropbox or OneDrive folder). Leave empty to use App Data. Changing this does not migrate existing data.</FieldDesc>
                  <PathInput
                    value={customDataPath}
                    onChange={setCustomDataPath}
                    onBrowse={() => pickFolder(setCustomDataPath)}
                    placeholder="Leave empty for App Data default"
                  />
                  {customDataPath && (
                    <InfoBox>Data will be read from and written to <span style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--text)' }}>{customDataPath}</span>. Manually copy existing data from <span style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--text)' }}>{appDataPath}</span> if needed.</InfoBox>
                  )}
                </SettingsCard>
              </>
            )}

            {/* Defaults */}
            {activeSection === 'defaults' && (
              <>
                <SectionTitle icon={<SaveIcon />} title="Defaults" desc="Default values applied when creating a new project." />

                <SettingsCard>
                  <FieldLabel>Default IDE</FieldLabel>
                  <FieldDesc>Used when a project has no IDE configured.</FieldDesc>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 8 }}>
                    {IDE_OPTIONS.map(ide => (
                      <IDEOption
                        key={ide.value}
                        ide={ide}
                        selected={defaultIDE === ide.value}
                        onClick={() => setDefaultIDE(ide.value)}
                      />
                    ))}
                  </div>
                </SettingsCard>

                <SettingsCard>
                  <FieldLabel>Default Git Branch</FieldLabel>
                  <FieldDesc>Branch used for git commit and push operations.</FieldDesc>
                  <TextInput value={defaultBranch} onChange={setDefaultBranch} placeholder="main" mono />
                </SettingsCard>

                <SettingsCard>
                  <FieldLabel>Default Visibility</FieldLabel>
                  <FieldDesc>Whether new projects are public or hidden by default.</FieldDesc>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    {['public', 'hidden'].map(v => (
                      <ToggleChip
                        key={v}
                        label={v}
                        active={defaultVisibility === v}
                        color={v === 'hidden' ? 'var(--purple)' : 'var(--blue)'}
                        bg={v === 'hidden' ? 'rgba(168,85,247,0.1)' : 'rgba(74,158,255,0.1)'}
                        onClick={() => setDefaultVisibility(v)}
                      />
                    ))}
                  </div>
                </SettingsCard>

                <SettingsCard>
                  <FieldLabel>Default Shell</FieldLabel>
                  <FieldDesc>Shell used to run dev/build commands in the project terminal.</FieldDesc>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {(SHELL_OPTIONS[platform] || SHELL_OPTIONS.other).map(opt => (
                      <ToggleChip
                        key={opt.value}
                        label={opt.label}
                        active={defaultShell === opt.value}
                        color="var(--accent)"
                        bg="var(--accent-dim)"
                        onClick={() => setDefaultShell(opt.value)}
                      />
                    ))}
                  </div>
                </SettingsCard>
              </>
            )}

            {/* GitHub */}
            {activeSection === 'github' && (
              <>
                <SectionTitle icon={<GitIcon />} title="GitHub" desc="Connect your GitHub account to create and push repos directly from the app." />

                {/* Quick setup guide */}
                <SettingsCard>
                  <FieldLabel>Quick Setup</FieldLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                    {[
                      { n: 1, text: 'Open GitHub token settings', action: () => window.api?.system.openExternal('https://github.com/settings/tokens/new?scopes=repo,read:user&description=Croco+Dev+Manager'), btn: 'Open GitHub →' },
                      { n: 2, text: 'Select scopes: repo and read:user, then click "Generate token"', action: null, btn: null },
                      { n: 3, text: 'Paste the token below and click "Test Connection"', action: null, btn: null },
                    ].map(step => (
                      <div key={step.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                          {step.n}
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 12, color: 'var(--dim)' }}>{step.text}</span>
                          {step.btn && (
                            <button onClick={step.action} style={{ marginLeft: 8, fontSize: 11, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontFamily: 'Geist, sans-serif' }}>
                              {step.btn}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <InfoBox style={{ marginTop: 12 }}>
                    Make sure <code style={codeStyle}>git</code> is installed on your system — the app uses your local git binary for all operations. <span style={{ color: 'var(--blue)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => window.api?.system.openExternal('https://git-scm.com/downloads')}>Download git</span> if you see "cannot initialize repository" errors.
                  </InfoBox>
                </SettingsCard>

                <SettingsCard>
                  <FieldLabel>GitHub Username</FieldLabel>
                  <FieldDesc>Your GitHub username — used for linking repos and author info on commits.</FieldDesc>
                  <TextInput value={ghUsername} onChange={setGhUsername} placeholder="your-username" mono />
                </SettingsCard>

                <SettingsCard>
                  <FieldLabel>Connect GitHub Account</FieldLabel>
                  <FieldDesc>Connect with one click — no tokens to manage. Grants <code style={codeStyle}>repo</code> and <code style={codeStyle}>read:user</code> scopes.</FieldDesc>
                  {!oauthEnabled ? (
                    <InfoBox style={{ marginTop: 10 }}>One-click login isn't available in this build — use a personal access token below instead.</InfoBox>
                  ) : !oauthData ? (
                    <button
                      onClick={handleOAuthStart}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, marginTop: 10,
                        padding: '10px 18px', borderRadius: 8, border: '1px solid var(--border)',
                        background: ghConnected ? 'rgba(74,255,145,0.06)' : 'var(--base)',
                        color: 'var(--text)', fontSize: 13,
                        fontWeight: 500, fontFamily: 'Geist, sans-serif', cursor: 'pointer',
                        transition: 'border-color 0.12s',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                      </svg>
                      {ghConnected ? `Reconnect as @${ghUsername}` : 'Login with GitHub'}
                    </button>
                  ) : (
                    <div style={{
                      marginTop: 10, padding: '12px 16px', borderRadius: 8,
                      background: 'var(--base)', border: '1px solid var(--border)',
                      fontSize: 13,
                    }}>
                      <div style={{ color: 'var(--dim)', marginBottom: 6 }}>Enter this code at <span style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--text)' }}>github.com/login/device</span>:</div>
                      <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 22, fontWeight: 700, letterSpacing: 5, color: 'var(--orange)', marginBottom: 6 }}>
                        {oauthData.user_code}
                      </div>
                      {oauthPolling && <div style={{ fontSize: 11, color: 'var(--dimmer)' }}>Waiting for authorisation…</div>}
                      <button
                        onClick={() => { stopOauthPolling(); setOauthData(null); setOauthPolling(false) }}
                        style={{ marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', fontSize: 11, textDecoration: 'underline', fontFamily: 'Geist, sans-serif' }}
                      >Cancel</button>
                    </div>
                  )}
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                    <FieldLabel>Personal Access Token</FieldLabel>
                    <FieldDesc>Fallback when one-click login isn't available. Needs the <code style={codeStyle}>repo</code> scope — generate one at github.com/settings/tokens.</FieldDesc>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <TextInput type="password" value={ghToken} onChange={setGhToken} placeholder="ghp_..." mono />
                      <SmallBtn onClick={handleTestGithub}>{ghTestStatus === 'testing' ? 'Testing…' : 'Test Connection'}</SmallBtn>
                    </div>
                  </div>
                  {ghTestStatus && ghTestStatus !== 'testing' && (
                    <div style={{ marginTop: 10, fontSize: 12, color: ghTestStatus.ok ? 'var(--green)' : 'var(--red)', fontFamily: 'Geist Mono, monospace' }}>
                      {ghTestStatus.ok ? `✓ Connected as @${ghTestStatus.login}` : `✗ ${ghTestStatus.message}`}
                    </div>
                  )}
                </SettingsCard>

                {/* Connection status */}
                <SettingsCard>
                  <FieldLabel>Connection Status</FieldLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: ghConnected ? 'var(--green)' : 'var(--dimmer)',
                      boxShadow: ghConnected ? '0 0 0 3px rgba(74,255,145,0.15)' : 'none',
                    }} />
                    {ghConnected ? (
                      <span style={{ fontSize: 13, color: 'var(--text)' }}>
                        Connected as <span style={{ color: 'var(--blue)', fontFamily: 'Geist Mono, monospace' }}>@{ghUsername}</span>
                      </span>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--dimmer)' }}>Not connected — follow the Quick Setup steps above</span>
                    )}
                    {ghConnected && (
                      <SmallBtn onClick={() => window.api?.system.openExternal(`https://github.com/${ghUsername}`)}>
                        View Profile
                      </SmallBtn>
                    )}
                  </div>
                </SettingsCard>
              </>
            )}

            {/* Appearance */}
            {activeSection === 'appearance' && (
              <>
                <SectionTitle icon={<PaletteIcon />} title="Appearance" desc="Customise the look and feel of the app." />

                <SettingsCard>
                  <FieldLabel>Style</FieldLabel>
                  <FieldDesc>Picks the overall look-and-feel — shapes, blur, motion. Independent of Theme, which only picks colours.</FieldDesc>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 12 }}>
                    {STYLES.map(style => {
                      const isActive = selectedStyle === style.id
                      const isComingSoon = style.status === 'coming-soon'
                      return (
                        <button
                          key={style.id}
                          disabled={isComingSoon}
                          onClick={() => {
                            if (isComingSoon) return
                            setSelectedStyle(style.id)
                            applyStyle(style.id)
                            const patch = { appearance: { style: style.id } }
                            if (style.id === 'apple') {
                              // Curated font pairing to match the liquid-glass look —
                              // same idea as a Theme click curating an accent colour.
                              setFontBody('Inter')
                              setFontDisplay('inherit')
                              patch.appearance.fontBody = 'Inter'
                              patch.appearance.fontDisplay = 'inherit'
                            }
                            window.api?.settings.update(patch).catch(console.error)
                          }}
                          title={style.status === 'coming-soon' ? `${style.label} — coming soon` : style.label}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
                            padding: '12px 14px', borderRadius: 10, textAlign: 'left',
                            border: isActive ? '2px solid var(--accent)' : '2px solid var(--border)',
                            background: isActive ? 'var(--accent-dim)' : 'var(--card)',
                            cursor: isComingSoon ? 'default' : 'pointer',
                            opacity: isComingSoon ? 0.55 : 1,
                            transition: 'all 0.15s',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: isActive ? 'var(--text)' : 'var(--dim)' }}>{style.label}</span>
                            {isComingSoon && (
                              <span style={{ marginLeft: 'auto', fontSize: 9, fontFamily: 'Geist Mono, monospace', color: 'var(--dimmer)', background: 'var(--border)', padding: '1px 6px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                Soon
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: 10.5, color: 'var(--dimmer)', lineHeight: 1.4 }}>{style.description}</span>
                        </button>
                      )
                    })}
                  </div>
                </SettingsCard>

                <SettingsCard>
                  <FieldLabel>Glass Effect</FieldLabel>
                  <FieldDesc>Translucent, blurred cards and sidebar over the current Theme's colours. Independent of Style — works with any theme.</FieldDesc>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    {[{ v: false, label: 'off' }, { v: true, label: 'on' }].map(({ v, label }) => (
                      <ToggleChip
                        key={label}
                        label={label}
                        active={glassEnabled === v}
                        color="var(--accent)"
                        bg="var(--accent-dim)"
                        onClick={() => {
                          setGlassEnabled(v)
                          applyTheme(selectedTheme, v, { accentColor, fontBody, fontDisplay, logoBg })
                          window.api?.settings.update({ appearance: { glass: v } }).catch(console.error)
                        }}
                      />
                    ))}
                  </div>
                </SettingsCard>

                <SettingsCard>
                  <FieldLabel>Theme</FieldLabel>
                  <FieldDesc>Choose a colour theme for the entire app.</FieldDesc>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginTop: 12 }}>
                    {THEMES.map(theme => {
                      const [bg, accent] = getThemeAccentSwatch(theme.id)
                      const isActive = selectedTheme === theme.id
                      return (
                        <button
                          key={theme.id}
                          onClick={() => {
                            setSelectedTheme(theme.id)
                            const [, nativeAccent] = getThemeAccentSwatch(theme.id)
                            setAccentColor(nativeAccent)
                            applyTheme(theme.id, glassEnabled, { accentColor: nativeAccent, fontBody, fontDisplay, logoBg })
                            window.api?.settings.update({ appearance: { theme: theme.id, glass: glassEnabled, accentColor: nativeAccent, fontBody, fontDisplay, logoBg } }).catch(console.error)
                          }}
                          title={theme.label}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 5,
                            padding: '8px 4px',
                            borderRadius: 8,
                            border: isActive ? `2px solid ${accent}` : '2px solid var(--border)',
                            background: isActive ? `${accent}18` : 'var(--card)',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            outline: 'none',
                          }}
                        >
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: bg,
                            border: `3px solid ${accent}`,
                            boxShadow: isActive ? `0 0 0 2px ${accent}40` : 'none',
                            transition: 'box-shadow 0.15s',
                          }} />
                          <span style={{
                            fontSize: 9, fontFamily: 'Geist Mono, monospace',
                            color: isActive ? 'var(--text)' : 'var(--dimmer)',
                            textAlign: 'center', lineHeight: 1.2,
                            maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {theme.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
                      Selected: <span style={{ color: 'var(--text)' }}>{THEMES.find(t => t.id === selectedTheme)?.label || 'Default'}</span>
                    </span>
                    {THEMES.find(t => t.id === selectedTheme)?.dark === false && (
                      <span style={{ fontSize: 10, background: 'rgba(255,215,0,0.1)', color: 'var(--yellow)', padding: '1px 6px', borderRadius: 4, fontFamily: 'Geist Mono, monospace' }}>light theme</span>
                    )}
                  </div>
                </SettingsCard>

                <SettingsCard>
                  <FieldLabel>Accent Colour</FieldLabel>
                  <FieldDesc>Override the primary highlight colour for the default theme.</FieldDesc>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                    {['#e8e4dc', '#ff6b35', '#4a9eff', '#4aff91', '#a855f7', '#ffd700', '#ff4444'].map(color => (
                      <button
                        key={color}
                        onClick={() => setAccentColor(color)}
                        style={{
                          width: 28, height: 28, borderRadius: '50%', background: color,
                          border: accentColor === color ? '2px solid #fff' : '2px solid transparent',
                          outline: accentColor === color ? '2px solid ' + color : 'none',
                          outlineOffset: 2,
                          cursor: 'pointer', transition: 'all 0.15s', padding: 0,
                        }}
                      />
                    ))}
                    <input
                      type="color"
                      value={accentColor}
                      onChange={e => setAccentColor(e.target.value)}
                      style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--card)', padding: 2 }}
                    />
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: accentColor }} />
                    <span style={{ fontSize: 12, color: 'var(--dim)', fontFamily: 'Geist Mono, monospace' }}>{accentColor}</span>
                  </div>
                </SettingsCard>

                <SettingsCard>
                  <FieldLabel>UI Font</FieldLabel>
                  <FieldDesc>Body font used throughout the interface. Geist Mono is always used for code and IDs.</FieldDesc>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                    {[
                      { id: 'Geist',         sample: 'The quick brown fox' },
                      { id: 'Inter',         sample: 'The quick brown fox' },
                      { id: 'IBM Plex Sans', sample: 'The quick brown fox' },
                      { id: 'Nunito',        sample: 'The quick brown fox' },
                      { id: 'DM Sans',       sample: 'The quick brown fox' },
                      { id: 'Space Grotesk', sample: 'The quick brown fox' },
                      { id: 'Manrope',       sample: 'The quick brown fox' },
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setFontBody(f.id)}
                        style={{
                          padding: '11px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                          border: `1px solid ${fontBody === f.id ? 'var(--accent)' : 'var(--border)'}`,
                          background: fontBody === f.id ? 'var(--accent-dim)' : 'var(--card)',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ fontSize: 13, color: 'var(--text)', fontFamily: `'${f.id}', sans-serif`, marginBottom: 3 }}>{f.sample}</div>
                        <div style={{ fontSize: 10, color: fontBody === f.id ? 'var(--accent)' : 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>{f.id}</div>
                      </button>
                    ))}
                  </div>
                </SettingsCard>

                <SettingsCard>
                  <FieldLabel>Display Font</FieldLabel>
                  <FieldDesc>Serif font used for page titles and headings. Choose "Same as body" to turn the serif look off.</FieldDesc>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                    {[
                      { id: 'Lora',             label: 'Lora',             sample: 'Rise of the Croco' },
                      { id: 'Playfair Display', label: 'Playfair Display', sample: 'Rise of the Croco' },
                      { id: 'inherit',          label: 'Same as body',     sample: 'Rise of the Croco' },
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setFontDisplay(f.id)}
                        style={{
                          padding: '11px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                          border: `1px solid ${fontDisplay === f.id ? 'var(--accent)' : 'var(--border)'}`,
                          background: fontDisplay === f.id ? 'var(--accent-dim)' : 'var(--card)',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ fontSize: 15, color: 'var(--text)', fontFamily: f.id === 'inherit' ? `'${fontBody}', sans-serif` : `'${f.id}', serif`, marginBottom: 3 }}>{f.sample}</div>
                        <div style={{ fontSize: 10, color: fontDisplay === f.id ? 'var(--accent)' : 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>{f.label}</div>
                      </button>
                    ))}
                  </div>
                </SettingsCard>

              </>
            )}

            {/* Behaviour */}
            {activeSection === 'behaviour' && (
              <>
                <SectionTitle icon={<TagIcon />} title="Behaviour" desc="Configure how the app behaves." />

                <SettingsCard>
                  <FieldLabel>When closing the window</FieldLabel>
                  <FieldDesc>Controls what happens when you click the X on the title bar.</FieldDesc>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    {[
                      { id: 'tray', label: '🔔  Minimize to Tray' },
                      { id: 'quit', label: '❌  Quit App'         },
                    ].map(opt => (
                      <ToggleChip
                        key={opt.id}
                        label={opt.label}
                        active={closeBehavior === opt.id}
                        color="var(--accent)"
                        bg="var(--accent-dim)"
                        onClick={() => setCloseBehavior(opt.id)}
                      />
                    ))}
                  </div>
                  {closeBehavior === 'tray' && (
                    <InfoBox>The app will continue running in the background. Use the tray icon to reopen it or quit fully.</InfoBox>
                  )}
                </SettingsCard>

                <SettingsCard>
                  <FieldLabel>Start on startup</FieldLabel>
                  <FieldDesc>Launch Croco automatically when you log in.</FieldDesc>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    {[
                      { id: true,  label: '🚀  Enabled'  },
                      { id: false, label: '🚫  Disabled' },
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
              </>
            )}

            {/* Storage */}
            {activeSection === 'storage' && (
              <StorageSection
                storageBackend={storageBackend} setStorageBackend={setStorageBackend}
                migrating={migrating} setMigrating={setMigrating}
                migrateResult={migrateResult} setMigrateResult={setMigrateResult}
                backupBusy={backupBusy} setBackupBusy={setBackupBusy}
                backupResult={backupResult} setBackupResult={setBackupResult}
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
