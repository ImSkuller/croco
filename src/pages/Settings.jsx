import { useState, useEffect, useCallback, useRef } from 'react'
import { UserIcon, FolderIcon, SaveIcon, GitIcon, PaletteIcon, ShieldIcon, TagIcon, RefreshIcon, KeyboardIcon, DatabaseIcon, VaultIcon, CheckIcon, XCircleIcon, BellIcon, CheckCircleIcon, AIIcon, EyeIcon, EyeOffIcon, APIIcon, CopyIcon, AlertTriangleIcon, PuzzleIcon } from '../constants/SimpleSvgExports'
import { SettingsNavItem, SectionTitle, SettingsCard, FieldLabel, FieldDesc, TextInput, ToggleChip, Toggle, InfoBox, SmallBtn } from '../components/Settings/Exports'
import { useToast } from '../components/Toast/useToast.js'
import { THEMES, applyTheme, getThemeAccentSwatch, normalizeThemeId } from '../lib/theme.js'
import { STYLES, applyStyle, normalizeStyleId, applySmoothAnimations } from '../lib/appearanceStyle.js'
import { lazyLoadAllPickerFonts } from '../lib/lazyGoogleFont.js'
import { SHORTCUT_DEFS } from '../lib/shortcuts'
import StorageSection from '../components/Settings/StorageSection'
import ObsidianSection from '../components/Settings/ObsidianSection'
import ModulesSection from '../components/Settings/ModulesSection'
import TagsSection from '../components/Settings/TagsSection'
import UpdatesSection from '../components/Settings/UpdatesSection'
import TerminalSection from '../components/Settings/TerminalSection'
import ShortcutsSection from '../components/Settings/ShortcutsSection'
import DangerSection from '../components/Settings/DangerSection'
import UserSection from '../components/Settings/UserSection'
import PathsSection from '../components/Settings/PathsSection'
import DefaultsSection from '../components/Settings/DefaultsSection'
import { codeStyle, mergeDeep } from '../components/Settings/shared.js'
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

  // Opt-in font picker previews need their real faces loaded to render
  // correctly — deferred until the Appearance tab is actually opened
  // rather than on every app launch (see lib/lazyGoogleFont.js).
  useEffect(() => {
    if (activeSection === 'appearance') lazyLoadAllPickerFonts()
  }, [activeSection])

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

  const [ghUsername,    setGhUsername]    = useState('')
  // ghToken only ever holds a value the user just typed/received this
  // session — settings_get never returns the real stored token (it lives in
  // the OS keyring), so "is a token on file" is tracked separately.
  const [ghToken,       setGhToken]       = useState('')
  const [ghTokenStored, setGhTokenStored] = useState(false)
  const [ghTestStatus,  setGhTestStatus]  = useState(null) // null | 'testing' | {ok, login, message}
  const [secretsFallbackActive, setSecretsFallbackActive] = useState(false)
  const [aiEnabled,     setAiEnabled]     = useState(false)
  const [aiProvider,    setAiProvider]    = useState('anthropic')
  const [aiKeysStored,  setAiKeysStored]  = useState({ anthropic: false, openai: false, gemini: false })
  // Same "only holds what was just typed this session" rule as ghToken —
  // settings_get never returns a real stored AI key.
  const [aiKeyInput,    setAiKeyInput]    = useState('')
  const [aiKeyVisible,  setAiKeyVisible]  = useState(false)
  const [aiKeySaving,   setAiKeySaving]   = useState(false)
  const [apiEnabled,    setApiEnabled]    = useState(false)
  const [apiPort,       setApiPort]       = useState(3131)
  const [apiRunning,    setApiRunning]    = useState(false)
  const [apiTokenStored,setApiTokenStored]= useState(false)
  // Only ever holds a token this session just generated/regenerated — the
  // backend never returns a stored token's real value, by design (same
  // "shown once" rule as e.g. a GitHub OAuth device code).
  const [apiTokenReveal,setApiTokenReveal]= useState(null)
  const [apiBusy,       setApiBusy]       = useState(false)
  const [oauthEnabled,  setOauthEnabled]  = useState(true) // optimistic default (always true in shipped builds); corrected after the async check below
  const [oauthData,     setOauthData]     = useState(null) // {user_code, verification_uri, device_code, interval}
  const [oauthPolling,  setOauthPolling]  = useState(false)
  const oauthPollRef = useRef(null) // { timerId, inFlight } — lets us clear/reschedule and avoid overlapping poll requests

  const [closeBehavior, setCloseBehavior] = useState('tray')
  const [launchOnStartup, setLaunchOnStartup] = useState(false)
  const [launchOnStartupBusy, setLaunchOnStartupBusy] = useState(false)

  const [accentColor,      setAccentColor]      = useState('#e8e4dc')
  const [selectedTheme,    setSelectedTheme]    = useState('default')
  const [selectedStyle,    setSelectedStyle]    = useState('default')
  const [glassEnabled,     setGlassEnabled]     = useState(false)
  const [smoothAnimations, setSmoothAnimations] = useState(true)
  const [fontBody,         setFontBody]         = useState('Geist')
  const [fontDisplay,      setFontDisplay]      = useState('Lora')
  const [logoBg,           setLogoBg]           = useState('#ffffff')
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

  // Desktop notifications for schedules/deadlines
  const [deadlineRemindersEnabled, setDeadlineRemindersEnabled] = useState(true)
  const [showHiddenOnDashboard, setShowHiddenOnDashboard] = useState(false)
  const [notifPrefs, setNotifPrefs] = useState({})
  const [desktopPermissionGranted, setDesktopPermissionGranted] = useState(null) // null (unknown yet) | bool

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
    setSettings(s)
    setGhUsername(s.user?.github?.username || '')
    setGhTokenStored(!!s.user?.github?.tokenStored)
    setSecretsFallbackActive(!!s.app?.secretsFallbackActive)
    setAiEnabled(!!s.ai?.commitMessages?.enabled)
    setAiProvider(s.ai?.commitMessages?.provider || 'anthropic')
    setAiKeysStored(s.ai?.keysStored || { anthropic: false, openai: false, gemini: false })
    setApiEnabled(!!s.api?.enabled)
    setApiPort(s.api?.port || 3131)
    setApiRunning(!!s.api?.running)
    setApiTokenStored(!!s.api?.tokenStored)
    setCloseBehavior(s.app?.closeBehavior || 'tray')
    const color = s.appearance?.accentColor || '#e8e4dc'
    setAccentColor(color)
    const theme = normalizeThemeId(s.appearance?.theme || 'default')
    const glass = s.appearance?.glass || false
    setSelectedTheme(theme)
    setGlassEnabled(glass)
    setSmoothAnimations(s.appearance?.smoothAnimations ?? true)
    setSelectedStyle(normalizeStyleId(s.appearance?.style || 'apple'))
    setFontBody(s.appearance?.fontBody || 'Geist')
    setFontDisplay(s.appearance?.fontDisplay || 'Lora')
    setLogoBg(s.appearance?.logoBg || '#ffffff')
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
    setDeadlineRemindersEnabled(s.app?.deadlineReminders?.enabled ?? true)
    setShowHiddenOnDashboard(!!s.app?.showHiddenOnDashboard)
    setNotifPrefs(s.app?.notifications || {})
  }, [])

  useEffect(() => {
    if (!window.api) return
    window.api.github?.oauthConfigured().then(v => setOauthEnabled(!!v)).catch(() => {})
    window.api.app?.autostart.isEnabled().then(setLaunchOnStartup).catch(() => {})
    window.api.notify?.isDesktopPermissionGranted().then(setDesktopPermissionGranted).catch(() => {})
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

  const handleShowHiddenToggle = () => {
    setShowHiddenOnDashboard(prev => {
      const next = !prev
      window.api?.settings.update({ app: { showHiddenOnDashboard: next } }).catch(() => {})
      return next
    })
  }

  const handleNotifToggle = (event) => {
    setNotifPrefs(prev => {
      const next = { ...prev, [event]: !prev[event] }
      window.api?.settings.update({ app: { notifications: { [event]: next[event] } } }).catch(() => {})
      return next
    })
  }

  const handleDeadlineRemindersToggle = () => {
    setDeadlineRemindersEnabled(prev => {
      const next = !prev
      window.api?.settings.update({ app: { deadlineReminders: { enabled: next } } }).catch(() => {})
      return next
    })
  }

  const handleAiToggle = () => {
    setAiEnabled(prev => {
      const next = !prev
      window.api?.settings.update({ ai: { commitMessages: { enabled: next, provider: aiProvider } } }).catch(() => {})
      return next
    })
  }

  const handleAiProviderChange = (provider) => {
    setAiProvider(provider)
    setAiKeyInput('')
    window.api?.settings.update({ ai: { commitMessages: { enabled: aiEnabled, provider } } }).catch(() => {})
  }

  const handleAiKeySave = async () => {
    if (!aiKeyInput.trim() || !window.api) return
    setAiKeySaving(true)
    try {
      await window.api.settings.setAiKey(aiProvider, aiKeyInput.trim())
      setAiKeysStored(prev => ({ ...prev, [aiProvider]: true }))
      setAiKeyInput('')
      toast.success('API key saved')
    } catch (e) {
      toast.error('Could not save key', e.message)
    } finally {
      setAiKeySaving(false)
    }
  }

  const handleAiKeyClear = async () => {
    if (!window.api) return
    await window.api.settings.setAiKey(aiProvider, '').catch(() => {})
    setAiKeysStored(prev => ({ ...prev, [aiProvider]: false }))
  }

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

  const handleApiToggle = async () => {
    const next = !apiEnabled
    setApiEnabled(next)
    await window.api?.settings.update({ api: { enabled: next, port: apiPort } }).catch(() => {})
    await applyLocalApi()
  }

  const handleApiPortChange = async (port) => {
    const n = Math.max(1024, Math.min(65535, Number(port) || 3131))
    setApiPort(n)
    await window.api?.settings.update({ api: { enabled: apiEnabled, port: n } }).catch(() => {})
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

  const handleRequestDesktopPermission = async () => {
    if (!window.api) return
    const granted = await window.api.notify.requestDesktopPermission().catch(() => false)
    setDesktopPermissionGranted(!!granted)
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
            setGhUsername(login)
            // Auto-save credentials so they persist without requiring a manual Save click.
            // Token goes straight to the OS keyring, never through settings.update.
            if (token) {
              await window.api.settings.setGithubToken(token).catch(console.error)
              setGhTokenStored(true)
            }
            await window.api.settings.update({ user: { github: { username: login } } }).catch(console.error)
            // Lookup community tag
            if (login) {
              const cu = await window.api.system.lookupCommunityUser(login).catch(() => null)
              if (cu) patchLocal({ user: { tag: cu.tag } })
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

  // GitHub's personal access token is the one field on this page that still
  // needs an explicit save (same reasoning as the AI key's own "Save Key"
  // button below): it's a secret written to the OS keyring, not a plain
  // settings.json field, so it shouldn't fire on every blur — a stray tab-
  // away mid-paste would write a half-typed token.
  const handleSaveGithubToken = async () => {
    if (!ghToken.trim() || !window.api) return
    await window.api.settings.setGithubToken(ghToken.trim()).catch(console.error)
    setGhTokenStored(true)
    setGhToken('')
    toast.success('GitHub token saved')
  }

  const handleReset = async () => {
    if (window.api) {
      const defaults = await window.api.settings.reset().catch(console.error)
      if (defaults) { applySettings(defaults); setVersion(v => v + 1) }
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

  const ghConnected = ghUsername.trim() !== '' && (ghTokenStored || ghToken.trim() !== '')

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

            {/* GitHub */}
            {activeSection === 'github' && (
              <>
                <SectionTitle icon={<GitIcon />} title="GitHub" desc="Connect GitHub to upload your projects from inside Croco." />

                {/* Quick setup guide */}
                <SettingsCard>
                  <FieldLabel>How to Connect</FieldLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                    {[
                      { n: 1, text: 'Open the GitHub page that creates a token (a password for apps)', action: () => window.api?.system.openExternal('https://github.com/settings/tokens/new?scopes=repo,read:user&description=Croco+Dev+Manager'), btn: 'Open GitHub →' },
                      { n: 2, text: 'Leave "repo" and "read:user" ticked, then click "Generate token"', action: null, btn: null },
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
                    Croco needs Git installed on your computer. <span style={{ color: 'var(--blue)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => window.api?.system.openExternal('https://git-scm.com/downloads')}>Download git</span> if you see a "cannot initialize repository" error.
                  </InfoBox>
                </SettingsCard>

                <SettingsCard>
                  <FieldLabel>GitHub Username</FieldLabel>
                  <FieldDesc>Used to link your projects to GitHub.</FieldDesc>
                  <TextInput value={ghUsername} onChange={setGhUsername} onBlur={() => saveField({ user: { github: { username: ghUsername } } })} placeholder="your-username" mono />
                </SettingsCard>

                <SettingsCard>
                  <FieldLabel>Connect GitHub Account</FieldLabel>
                  <FieldDesc>The easiest way: log in on GitHub's website and you're done.</FieldDesc>
                  {!oauthEnabled ? (
                    <InfoBox style={{ marginTop: 10 }}>Quick login isn't available in this version. Use a token below instead.</InfoBox>
                  ) : !oauthData ? (
                    <button
                      onClick={handleOAuthStart}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, marginTop: 10,
                        padding: '10px 18px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
                        background: ghConnected ? 'rgba(74,255,145,0.06)' : 'var(--base)',
                        color: 'var(--text)', fontSize: 13,
                        fontWeight: 500, fontFamily: 'Geist, sans-serif', cursor: 'pointer',
                        transition: 'border-color var(--transition-fast)',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                      </svg>
                      {ghConnected ? `Reconnect as @${ghUsername}` : 'Login with GitHub'}
                    </button>
                  ) : (
                    <div style={{
                      marginTop: 10, padding: '12px 16px', borderRadius: 'var(--r-md)',
                      background: 'var(--base)', border: '1px solid var(--border)',
                      fontSize: 13,
                    }}>
                      <div style={{ color: 'var(--dim)', marginBottom: 6 }}>Type this code on <span style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--text)' }}>github.com/login/device</span>:</div>
                      <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 22, fontWeight: 700, letterSpacing: 5, color: 'var(--orange)', marginBottom: 6 }}>
                        {oauthData.user_code}
                      </div>
                      {oauthPolling && <div style={{ fontSize: 11, color: 'var(--dimmer)' }}>Waiting for you to approve on GitHub…</div>}
                      <button
                        onClick={() => { stopOauthPolling(); setOauthData(null); setOauthPolling(false) }}
                        style={{ marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', fontSize: 11, textDecoration: 'underline', fontFamily: 'Geist, sans-serif' }}
                      >Cancel</button>
                    </div>
                  )}
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                    <FieldLabel>Token</FieldLabel>
                    <FieldDesc>
                      Use this if the login button above doesn't work. Create one at github.com/settings/tokens with the <code style={codeStyle}>repo</code> option ticked.
                      {ghTokenStored && ' A token is already saved. Paste a new one to replace it.'}
                    </FieldDesc>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <TextInput type="password" value={ghToken} onChange={setGhToken} placeholder={ghTokenStored ? '••••••••  (saved — paste to replace)' : 'ghp_...'} mono />
                      <SmallBtn onClick={handleSaveGithubToken} disabled={!ghToken.trim()}>Save Token</SmallBtn>
                      <SmallBtn onClick={handleTestGithub}>{ghTestStatus === 'testing' ? 'Testing…' : 'Test Connection'}</SmallBtn>
                    </div>
                    {secretsFallbackActive && (
                      <InfoBox style={{ marginTop: 10 }}>
                        Your computer's secure password storage isn't available, so this token is saved in an encrypted file on this computer instead.
                      </InfoBox>
                    )}
                  </div>
                  {ghTestStatus && ghTestStatus !== 'testing' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, color: ghTestStatus.ok ? 'var(--green)' : 'var(--red)', fontFamily: 'Geist Mono, monospace' }}>
                      {ghTestStatus.ok
                        ? <><CheckIcon size={12} /> Connected as @{ghTestStatus.login}</>
                        : <><XCircleIcon size={12} /> {ghTestStatus.message}</>}
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
                      <span style={{ fontSize: 13, color: 'var(--dimmer)' }}>Not connected. Follow the steps above.</span>
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

            {/* AI */}
            {activeSection === 'ai' && (
              <>
                <SectionTitle icon={<AIIcon />} title="AI" desc="Let AI write your commit messages. Off by default, and it only works if you add your own API key." />

                <SettingsCard>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <FieldLabel>AI Commit Messages</FieldLabel>
                      <FieldDesc>Adds a "Generate with AI" button when you save changes. Your changes are sent to the AI company you pick below. You always get to review the message first.</FieldDesc>
                    </div>
                    <Toggle value={aiEnabled} onChange={handleAiToggle} />
                  </div>
                </SettingsCard>

                <SettingsCard>
                  <FieldLabel>AI Company</FieldLabel>
                  <FieldDesc>Each one needs its own API key (a password you get from their website).</FieldDesc>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    {[
                      { id: 'anthropic', label: 'Anthropic' },
                      { id: 'openai',    label: 'OpenAI'    },
                      { id: 'gemini',    label: 'Gemini'    },
                    ].map(opt => (
                      <ToggleChip
                        key={opt.id}
                        label={<>{opt.label}{aiKeysStored[opt.id] && <CheckIcon size={11} />}</>}
                        active={aiProvider === opt.id}
                        color="var(--accent)"
                        bg="var(--accent-dim)"
                        onClick={() => handleAiProviderChange(opt.id)}
                      />
                    ))}
                  </div>

                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                    <FieldLabel>{{ anthropic: 'Anthropic', openai: 'OpenAI', gemini: 'Gemini' }[aiProvider]} API Key</FieldLabel>
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
                          placeholder={aiKeysStored[aiProvider] ? '••••••••  (saved — paste to replace)' : 'sk-...'}
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
                      <SmallBtn onClick={handleAiKeySave}>{aiKeySaving ? 'Saving…' : 'Save Key'}</SmallBtn>
                      {aiKeysStored[aiProvider] && <SmallBtn onClick={handleAiKeyClear}>Clear</SmallBtn>}
                    </div>
                    {secretsFallbackActive && (
                      <InfoBox style={{ marginTop: 10 }}>
                        Your computer's secure password storage isn't available, so this key is saved in an encrypted file on this computer instead.
                      </InfoBox>
                    )}
                  </div>
                </SettingsCard>
              </>
            )}

            {/* Local API */}
            {activeSection === 'localApi' && (
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
                    <Toggle value={apiEnabled} onChange={handleApiToggle} />
                  </div>
                </SettingsCard>

                {apiEnabled && (
                  <>
                    <SettingsCard>
                      <FieldLabel>Port</FieldLabel>
                      <FieldDesc>A number other programs use to find Croco. The default works for most people.</FieldDesc>
                      <div style={{ marginTop: 8, maxWidth: 140 }}>
                        <TextInput type="number" value={apiPort} onChange={handleApiPortChange} mono />
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
            )}

            {/* Tags */}
            {activeSection === 'tags' && <TagsSection />}

            {/* Modules */}
            {activeSection === 'modules' && <ModulesSection aiKeysStored={aiKeysStored} />}

            {/* Appearance */}
            {activeSection === 'appearance' && (
              <>
                <SectionTitle icon={<PaletteIcon />} title="Appearance" desc="Change how Croco looks." />

                <SettingsCard>
                  <FieldLabel>Style</FieldLabel>
                  <FieldDesc>Changes the shape and feel of buttons and panels. Colours are set separately under Theme.</FieldDesc>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 12 }}>
                    {STYLES.map(style => {
                      const isActive = selectedStyle === style.id
                      return (
                        <button
                          key={style.id}
                          onClick={() => {
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
                          title={style.label}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
                            padding: '12px 14px', borderRadius: 'var(--r-lg)', textAlign: 'left',
                            border: isActive ? '2px solid var(--accent)' : '2px solid var(--border)',
                            background: isActive ? 'var(--accent-dim)' : 'var(--card)',
                            cursor: 'pointer',
                            transition: 'all var(--transition-base)',
                          }}
                        >
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: isActive ? 'var(--text)' : 'var(--dim)' }}>{style.label}</span>
                          <span style={{ fontSize: 10.5, color: 'var(--dimmer)', lineHeight: 1.4 }}>{style.description}</span>
                        </button>
                      )
                    })}
                  </div>
                </SettingsCard>

                <SettingsCard>
                  <FieldLabel>Glass Effect</FieldLabel>
                  <FieldDesc>Makes the window see-through with a frosted look. Works with any theme. On older computers it may look slightly different.</FieldDesc>
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
                          window.api?.system.setWindowGlass(v).catch(console.error)
                        }}
                      />
                    ))}
                  </div>
                </SettingsCard>

                <SettingsCard>
                  <FieldLabel>Smooth Animations</FieldLabel>
                  <FieldDesc>Smooth movement when switching pages and pressing buttons. Turn off if you prefer things to change instantly. Your computer's "reduce motion" setting is always respected.</FieldDesc>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    {[{ v: true, label: 'on' }, { v: false, label: 'off' }].map(({ v, label }) => (
                      <ToggleChip
                        key={label}
                        label={label}
                        active={smoothAnimations === v}
                        color="var(--accent)"
                        bg="var(--accent-dim)"
                        onClick={() => {
                          setSmoothAnimations(v)
                          applySmoothAnimations(v)
                          window.api?.settings.update({ appearance: { smoothAnimations: v } }).catch(console.error)
                        }}
                      />
                    ))}
                  </div>
                </SettingsCard>

                <SettingsCard>
                  <FieldLabel>Theme</FieldLabel>
                  <FieldDesc>Pick the colours for the whole app.</FieldDesc>
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
                            borderRadius: 'var(--r-md)',
                            border: isActive ? `2px solid ${accent}` : '2px solid var(--border)',
                            background: isActive ? `${accent}18` : 'var(--card)',
                            cursor: 'pointer',
                            transition: 'all var(--transition-base)',
                            outline: 'none',
                          }}
                        >
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: bg,
                            border: `3px solid ${accent}`,
                            boxShadow: isActive ? `0 0 0 2px ${accent}40` : 'none',
                            transition: 'box-shadow var(--transition-base)',
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
                      <span style={{ fontSize: 10, background: 'rgba(255,215,0,0.1)', color: 'var(--yellow)', padding: '1px 6px', borderRadius: 'var(--r-sm)', fontFamily: 'Geist Mono, monospace' }}>light theme</span>
                    )}
                  </div>
                </SettingsCard>

                <SettingsCard>
                  <FieldLabel>Accent Colour</FieldLabel>
                  <FieldDesc>The colour used for highlights and selected items.</FieldDesc>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                    {['#e8e4dc', '#ff6b35', '#4a9eff', '#4aff91', '#a855f7', '#ffd700', '#ff4444'].map(color => (
                      <button
                        key={color}
                        onClick={() => { setAccentColor(color); saveField({ appearance: { accentColor: color } }) }}
                        style={{
                          width: 28, height: 28, borderRadius: '50%', background: color,
                          border: accentColor === color ? '2px solid #fff' : '2px solid transparent',
                          outline: accentColor === color ? '2px solid ' + color : 'none',
                          outlineOffset: 2,
                          cursor: 'pointer', transition: 'all var(--transition-base)', padding: 0,
                        }}
                      />
                    ))}
                    <input
                      type="color"
                      value={accentColor}
                      onChange={e => { setAccentColor(e.target.value); saveField({ appearance: { accentColor: e.target.value } }) }}
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
                  <FieldDesc>The font used for most text. Code always uses a code font.</FieldDesc>
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
                        onClick={() => { setFontBody(f.id); saveField({ appearance: { fontBody: f.id } }) }}
                        style={{
                          padding: '11px 14px', borderRadius: 'var(--r-md)', cursor: 'pointer', textAlign: 'left',
                          border: `1px solid ${fontBody === f.id ? 'var(--accent)' : 'var(--border)'}`,
                          background: fontBody === f.id ? 'var(--accent-dim)' : 'var(--card)',
                          transition: 'all var(--transition-base)',
                        }}
                      >
                        <div style={{ fontSize: 13, color: 'var(--text)', fontFamily: `'${f.id}', sans-serif`, marginBottom: 3 }}>{f.sample}</div>
                        <div style={{ fontSize: 10, color: fontBody === f.id ? 'var(--accent)' : 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>{f.id}</div>
                      </button>
                    ))}
                  </div>
                </SettingsCard>

                <SettingsCard>
                  <FieldLabel>Heading Font</FieldLabel>
                  <FieldDesc>The font used for page titles. Choose "Same as body" for a plainer look.</FieldDesc>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                    {[
                      { id: 'Lora',             label: 'Lora',             sample: 'Rise of the Croco' },
                      { id: 'Playfair Display', label: 'Playfair Display', sample: 'Rise of the Croco' },
                      { id: 'inherit',          label: 'Same as body',     sample: 'Rise of the Croco' },
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => { setFontDisplay(f.id); saveField({ appearance: { fontDisplay: f.id } }) }}
                        style={{
                          padding: '11px 14px', borderRadius: 'var(--r-md)', cursor: 'pointer', textAlign: 'left',
                          border: `1px solid ${fontDisplay === f.id ? 'var(--accent)' : 'var(--border)'}`,
                          background: fontDisplay === f.id ? 'var(--accent-dim)' : 'var(--card)',
                          transition: 'all var(--transition-base)',
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
                <SectionTitle icon={<TagIcon />} title="General" desc="How Croco starts, closes, and notifies you." />

                <SettingsCard>
                  <FieldLabel>When closing the window</FieldLabel>
                  <FieldDesc>What happens when you click the X button.</FieldDesc>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    {[
                      { id: 'tray', label: <><BellIcon size={12} /> Keep Running in Background</> },
                      { id: 'quit', label: <><XCircleIcon size={12} /> Quit</> },
                    ].map(opt => (
                      <ToggleChip
                        key={opt.id}
                        label={opt.label}
                        active={closeBehavior === opt.id}
                        color="var(--accent)"
                        bg="var(--accent-dim)"
                        onClick={() => { setCloseBehavior(opt.id); saveField({ app: { closeBehavior: opt.id } }) }}
                      />
                    ))}
                  </div>
                  {closeBehavior === 'tray' && (
                    <InfoBox>Croco stays open in the background. Click its icon near the clock to reopen it or quit for good.</InfoBox>
                  )}
                </SettingsCard>

                <SettingsCard>
                  <FieldLabel>Open When I Turn On My Computer</FieldLabel>
                  <FieldDesc>Croco opens by itself when you log in.</FieldDesc>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    {[
                      { id: true,  label: <><CheckCircleIcon size={12} /> Enabled</> },
                      { id: false, label: <><XCircleIcon size={12} /> Disabled</> },
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

                <SettingsCard>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <FieldLabel>Show hidden projects on the Dashboard</FieldLabel>
                      <FieldDesc>Hidden projects are left off the Dashboard unless you turn this on. Archived projects never show there.</FieldDesc>
                    </div>
                    <Toggle value={showHiddenOnDashboard} onChange={handleShowHiddenToggle} />
                  </div>
                </SettingsCard>

                <SettingsCard>
                  <FieldLabel>Desktop Notifications</FieldLabel>
                  <FieldDesc>Pop-up alerts from your computer. Choose which ones you want.</FieldDesc>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12, marginBottom: desktopPermissionGranted === false ? 12 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: 'var(--text)' }}>Deadline reminders <span style={{ color: 'var(--dimmer)' }}>— when a deadline arrives</span></span>
                      <Toggle value={deadlineRemindersEnabled} onChange={handleDeadlineRemindersToggle} />
                    </div>
                    {[
                      { id: 'runFinished',   label: 'Run finished',        desc: 'a project run completes' },
                      { id: 'runFailed',     label: 'Run failed',          desc: 'a project run stops with an error' },
                      { id: 'pushSucceeded', label: 'Upload succeeded',    desc: 'only when Croco is in the background' },
                      { id: 'pushFailed',    label: 'Upload failed',       desc: 'the upload to GitHub did not work' },
                      { id: 'aiReply',       label: 'AI reply ready',      desc: 'only when Croco is in the background' },
                      { id: 'focusEnded',    label: 'Focus session ended', desc: 'a work or break timer ends' },
                    ].map(n => (
                      <div key={n.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: 'var(--text)' }}>{n.label} <span style={{ color: 'var(--dimmer)' }}>— {n.desc}</span></span>
                        <Toggle value={!!notifPrefs[n.id]} onChange={() => handleNotifToggle(n.id)} />
                      </div>
                    ))}
                  </div>
                  {desktopPermissionGranted === false && (
                    <InfoBox>
                      Your computer hasn't allowed Croco to show notifications yet.
                      <button
                        onClick={handleRequestDesktopPermission}
                        style={{ marginLeft: 8, padding: '3px 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 11, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}
                      >
                        Allow Notifications
                      </button>
                    </InfoBox>
                  )}
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
