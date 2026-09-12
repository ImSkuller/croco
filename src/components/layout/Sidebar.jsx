import { useState, useEffect, useRef, useMemo, memo } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { GridIcon, ListIcon, Logo, NoteIcon, SearchIcon, SettingsIcon, TodoIcon } from '../../constants/SvgExports.jsx'
import {
  StarIcon, ActivityIcon, TrendIcon, GithubIcon, TrashIcon, HomeIcon, BulbIcon,
  PlusCircleIcon, ImportIcon, PaletteIcon, SaveIcon, FolderIcon, NoteIcon2, CheckCircleIcon,
  GameIcon, GiftIcon, MusicNoteIcon, PuzzleIcon, AIIcon, IDEIcon, ClockIcon,
} from '../../constants/SimpleSvgExports.jsx'
import ManagerVersion from '../../constants/versionManager.jsx'
import { useToast } from '../Toast/useToast.js'
import { useData, useDataStore, EMPTY_LIST, refreshData } from '../../lib/store'
import { modKeyHint } from '../../lib/platform'
import { refreshCapabilitiesOnLaunch } from '../../lib/capabilities'
import { applyTheme, THEMES, getThemeAccentSwatch } from '../../lib/theme'
import CrocoGame from '../CrocoGame/CrocoGame.jsx'
import CloneModal from '../Projects/CloneModal.jsx'

const TYPE_COLOR = {
  project: 'var(--blue)',
  note:    'var(--orange)',
  todo:    'var(--green)',
  page:    'var(--dimmer)',
  action:  'var(--accent)',
}

const STATIC_PAGES = [
  { type: 'page', label: 'Dashboard',  sub: 'page', to: '/',           icon: <HomeIcon /> },
  { type: 'page', label: 'Notes',      sub: 'page', to: '/notes',      icon: <NoteIcon /> },
  { type: 'page', label: 'Todo',       sub: 'page', to: '/todos',      icon: <TodoIcon /> },
  { type: 'page', label: 'Activity',   sub: 'page', to: '/activity',   icon: <ActivityIcon /> },
  { type: 'page', label: 'Patterns',   sub: 'page', to: '/patterns',   icon: <TrendIcon /> },
  { type: 'page', label: 'Settings',   sub: 'page', to: '/settings',   icon: <SettingsIcon /> },
  { type: 'page', label: 'Favourites', sub: 'page', to: '/favourites', icon: <StarIcon filled /> },
  { type: 'page', label: 'Ideas',      sub: 'page', to: '/ideas',      icon: <BulbIcon /> },
  { type: 'page', label: 'GitHub',     sub: 'page', to: '/github',     icon: <GithubIcon /> },
  { type: 'page', label: 'Trash',      sub: 'page', to: '/trash',      icon: <TrashIcon /> },
]

// Beta module pages only exist while their module is on — same flags the
// sidebar nav uses, so Ctrl+K never offers a route RequireModule would
// bounce straight back off.
function modulePages({ ai, ide, focus }) {
  const pages = []
  if (ai)    pages.push({ type: 'page', label: 'AI',    sub: 'page · beta', to: '/ai',    icon: <AIIcon /> })
  if (ide)   pages.push({ type: 'page', label: 'IDE',   sub: 'page · beta', to: '/ide',   icon: <IDEIcon /> })
  if (focus) pages.push({ type: 'page', label: 'Focus', sub: 'page · beta', to: '/focus', icon: <ClockIcon /> })
  return pages
}

function playBabum() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const play = (freq, start, dur) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
      gain.gain.setValueAtTime(0.4, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + dur + 0.05)
    }
    // ba-bum ba-bum pattern
    play(220, 0.00, 0.18)
    play(330, 0.20, 0.28)
    play(220, 0.60, 0.18)
    play(330, 0.80, 0.28)
  } catch { /* AudioContext not available */ }
}

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const toast    = useToast()

  const [open,         setOpen]         = useState(false)
  const [showClone,    setShowClone]    = useState(false)
  const [hasUpdate,    setHasUpdate]    = useState(false)
  const [showGame,     setShowGame]     = useState(false)
  const profileClicksRef               = useRef(0)
  const profileClickTimerRef           = useRef(null)

  // Central store — instant render from cache, background revalidation.
  // Mutations anywhere in the app update these automatically.
  const projects  = useData('projects') || EMPTY_LIST
  const notes     = useData('notes')    || EMPTY_LIST
  const todos     = useData('todos')    || EMPTY_LIST
  const settings           = useData('settings')

  const userName     = settings?.user?.name || ''
  const userTag      = settings?.user?.tag || 'Developer'
  const userAvatar   = settings?.user?.avatar || null

  // Revalidate (cheap, only when stale) on navigation so counts stay honest
  const ensure = useDataStore(s => s.ensure)
  useEffect(() => {
    ensure('projects'); ensure('notes'); ensure('todos'); ensure('settings')
  }, [location.pathname, ensure])

  // Kick off the first entitlements refresh on launch — cosmetic UI state
  // only (see lib/capabilities.js); failures (offline, no GitHub login,
  // server unreachable) are expected and silently degrade to free tier.
  useEffect(() => {
    refreshCapabilitiesOnLaunch()
  }, [])

  // Check for updates once on mount — show toast if update is available
  useEffect(() => {
    if (!window.api?.updates) return
    window.api.updates.check()
      .then(info => {
        if (info?.hasUpdate) {
          setHasUpdate(true)
          toast.warning(`Update v${info.latest} available`, 'Go to Settings → Updates to install.')
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setOpen(true) }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const openTodosCount    = useMemo(() => todos.filter(t => !t.completed && !t.trashedAt).length, [todos])
  const unarchivedNotes   = useMemo(() => notes.filter(n => !n.archived && !n.trashedAt).length, [notes])
  const activeProjects    = useMemo(() => projects.filter(p => !p.archived && !p.trashedAt).length, [projects])
  const trashedCount      = useMemo(() =>
    projects.filter(p => p.trashedAt).length + notes.filter(n => n.trashedAt).length + todos.filter(t => t.trashedAt).length,
    [projects, notes, todos])
  const initials          = userName ? userName.slice(0, 2).toUpperCase() : '??'

  const aiModuleOn    = !!settings?.modules?.ai?.enabled
  const ideModuleOn   = !!settings?.modules?.ide?.enabled
  const focusModuleOn = !!settings?.modules?.focusTimer?.enabled

  const NAV = useMemo(() => {
    const menuItems = [
      { to: '/',            label: 'Dashboard',  badge: null,                    icon: <GridIcon /> },
      { to: '/projects',    label: 'Projects',   badge: activeProjects || null,   icon: <ListIcon /> },
      { to: '/favourites',  label: 'Favourites', badge: null,                    icon: <StarIcon filled={false} /> },
      { to: '/notes',       label: 'Notes',      badge: unarchivedNotes || null,  icon: <NoteIcon /> },
      { to: '/todos',       label: 'Todo',       badge: openTodosCount || null,   icon: <TodoIcon />, badgeStyle: 'accent' },
      { to: '/activity',    label: 'Activity',   badge: null,                    icon: <ActivityIcon /> },
      { to: '/patterns',    label: 'Patterns',   badge: null,                    icon: <TrendIcon /> },
      { to: '/github',      label: 'GitHub',     badge: null,                    icon: <GithubIcon /> },
    ]
    // Beta modules — only shown once enabled in Settings → Modules.
    if (aiModuleOn)    menuItems.push({ to: '/ai',    label: 'AI',    badge: 'β', badgeStyle: 'accent', icon: <AIIcon /> })
    if (ideModuleOn)   menuItems.push({ to: '/ide',   label: 'IDE',   badge: 'β', badgeStyle: 'accent', icon: <IDEIcon /> })
    if (focusModuleOn) menuItems.push({ to: '/focus', label: 'Focus', badge: 'β', badgeStyle: 'accent', icon: <ClockIcon /> })
    return [
      { label: 'Menu', items: menuItems },
      {
        label: 'System',
        items: [
          { to: '/trash',     label: 'Trash',    badge: trashedCount || null,   icon: <TrashIcon /> },
          { to: '/settings',  label: 'Settings', badge: hasUpdate ? '↑' : null, icon: <SettingsIcon />, badgeStyle: hasUpdate ? 'accent' : undefined },
        ],
      },
    ]
  }, [activeProjects, unarchivedNotes, openTodosCount, trashedCount, hasUpdate, aiModuleOn, ideModuleOn, focusModuleOn])

  // Command-palette actions — the part that makes Ctrl/Cmd+K an actual
  // command palette rather than just an entity/page search. Each calls the
  // exact same window.api sequence as its "real" button elsewhere in the
  // app, so there's one behavior to reason about, not a second copy.
  const handleImportFolder = async () => {
    if (!window.api) return
    const folderPath = await window.api.system.showFolderPicker()
    if (!folderPath) return
    try {
      const project = await window.api.projects.import(folderPath)
      refreshData('projects')
      navigate(`/projects/${project.id}`)
    } catch (e) { toast.error('Import failed', e.message) }
  }

  const handleCycleTheme = () => {
    if (!window.api || !settings) return
    const currentId = settings.appearance?.theme || 'default'
    const idx = THEMES.findIndex(t => t.id === currentId)
    const next = THEMES[(idx + 1) % THEMES.length]
    const [, nativeAccent] = getThemeAccentSwatch(next.id)
    const glass      = settings.appearance?.glass || false
    const fontBody   = settings.appearance?.fontBody || 'Geist'
    const fontDisplay = settings.appearance?.fontDisplay || 'Lora'
    const logoBg     = settings.appearance?.logoBg
    applyTheme(next.id, glass, { accentColor: nativeAccent, fontBody, fontDisplay, logoBg })
    window.api.settings.update({ appearance: { theme: next.id, accentColor: nativeAccent } }).catch(() => {})
    toast.info(`Theme: ${next.label}`, '')
  }

  const handleExportBackup = async () => {
    if (!window.api) return
    const stamp = new Date().toISOString().slice(0, 10)
    const dest = await window.api.system.showSavePicker(`croco-backup-${stamp}.json`, [{ name: 'Croco Backup', extensions: ['json'] }])
    if (!dest) return
    try {
      const r = await window.api.data.exportAll(dest)
      toast.success('Backup exported', `${r.projects} projects, ${r.notes} notes, ${r.todos} todos.`)
    } catch (e) { toast.error('Export failed', e.message) }
  }

  const actionItems = useMemo(() => [
    { type: 'action', label: 'New Project',   sub: 'action', icon: <PlusCircleIcon />, action: () => navigate('/projects/new') },
    { type: 'action', label: 'Import Folder', sub: 'action', icon: <ImportIcon />,     action: handleImportFolder },
    { type: 'action', label: 'Clone from GitHub', sub: 'action', icon: <GithubIcon />, action: () => setShowClone(true) },
    { type: 'action', label: 'New Note',      sub: 'action', icon: <NoteIcon2 />,      action: () => navigate('/note-editor') },
    { type: 'action', label: 'New Todo',      sub: 'action', icon: <CheckCircleIcon />, action: () => navigate('/todos') },
    { type: 'action', label: 'Switch Theme',  sub: 'action', icon: <PaletteIcon />,    action: handleCycleTheme },
    { type: 'action', label: 'Export Backup', sub: 'action', icon: <SaveIcon />,       action: handleExportBackup },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [settings])

  const searchItems = useMemo(() => [
    ...actionItems,
    // Trashed items are deliberately excluded from search/command palette
    // results — Trash is a dedicated recovery view, not something you
    // stumble into via Ctrl/Cmd+K.
    ...projects.filter(p => !p.trashedAt).map(p => ({
      type:  'project',
      label: p.name,
      sub:   p.tags?.join(' · ') || p.ide || 'project',
      to:    `/projects/${p.id}`,
      // A project's own chosen emoji (if any) is real user content, not app
      // chrome — kept as-is; only the fallback (no custom emoji set) uses
      // an SVG icon.
      icon:  p.emoji || <FolderIcon />,
    })),
    ...notes.filter(n => !n.trashedAt).map(n => ({
      type:  'note',
      label: n.title,
      sub:   n.project || 'no project',
      to:    `/note-editor/${n.id}`,
      icon:  n.emoji || <NoteIcon2 />,
    })),
    ...todos.filter(t => !t.completed && !t.trashedAt).map(t => ({
      type:  'todo',
      label: t.title,
      sub:   `${t.priority || 'med'} priority`,
      to:    '/todos',
      icon:  t.emoji || <CheckCircleIcon />,
    })),
    ...STATIC_PAGES,
    ...modulePages({ ai: aiModuleOn, ide: ideModuleOn, focus: focusModuleOn }),
  ], [actionItems, projects, notes, todos, aiModuleOn, ideModuleOn, focusModuleOn])

  return (
    <>
      <aside style={{
        width: 'var(--sidebar-width)',
        minWidth: 'var(--sidebar-width)',
        height: '100vh',
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        animation: 'pmSlideLeft 0.4s cubic-bezier(0.16,1,0.3,1) both',
      }}>

        {/* Logo area */}
        <div style={{
          padding: '16px 14px 14px',
          borderBottom: '1px solid var(--sidebar-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
        }}>
          <div style={{
            width: 24,
            height: 24,
            background: 'var(--logo-bg, #ffffff)',
            borderRadius: 'var(--r-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Logo />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', letterSpacing: -0.3 }}>Croco</div>
            <div style={{ fontSize: 9, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', marginTop: 1 }}>v{ManagerVersion}</div>
          </div>
        </div>

        {/* Update banner */}
        {hasUpdate && (
          <div
            onClick={() => {}}
            style={{
              margin: '0 8px',
              marginTop: 8,
              padding: '7px 10px',
              background: 'rgba(255,215,0,0.08)',
              border: '1px solid rgba(255,215,0,0.25)',
              borderRadius: 'var(--r-md)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 11 }}>⬆</span>
            <span style={{ fontSize: 10, color: '#ffd700', fontFamily: 'Geist, sans-serif', flex: 1, lineHeight: 1.3 }}>
              Update available<br/>
              <span style={{ opacity: 0.7 }}>Settings → Updates</span>
            </span>
          </div>
        )}

        {/* Search */}
        <div style={{ padding: '10px 10px 6px' }}>
          <div
            onClick={() => setOpen(true)}
            role="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              padding: '6px 9px',
              cursor: 'pointer',
              transition: 'border-color var(--transition-fast)',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-bright)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <span style={{ color: 'var(--dimmer)', display: 'flex', flexShrink: 0 }}><SearchIcon /></span>
            <span style={{ fontSize: 12, color: 'var(--dimmer)', flex: 1 }}>Search...</span>
            <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, color: 'var(--dimmer)', background: 'var(--border)', padding: '1px 4px', borderRadius: 'var(--r-sm)' }}>{modKeyHint('K')}</span>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ padding: '4px 8px', flex: '1 1 0%', overflowY: 'auto' }}>
          {NAV.map((group, gi) => (
            <div key={group.label} style={{ marginBottom: gi < NAV.length - 1 ? 4 : 0 }}>
              {group.items.map(item => (
                <SidebarItem key={item.to} item={item} />
              ))}
              {gi < NAV.length - 1 && (
                <div style={{ height: 1, background: 'var(--sidebar-border)', margin: '6px 4px' }} />
              )}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div
          style={{
            padding: '10px 12px',
            borderTop: '1px solid var(--sidebar-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            transition: 'background var(--transition-fast)',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--card)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          onClick={() => {
            profileClicksRef.current += 1
            clearTimeout(profileClickTimerRef.current)
            if (profileClicksRef.current >= 5) {
              profileClicksRef.current = 0
              setShowGame(true)
            } else {
              profileClickTimerRef.current = setTimeout(() => { profileClicksRef.current = 0 }, 2000)
            }
          }}
        >
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 26,
              height: 26,
              background: userAvatar ? 'transparent' : 'var(--accent-dim)',
              border: '1px solid var(--border)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--accent)',
              fontFamily: 'Geist Mono, monospace',
              overflow: 'hidden',
            }}>
              {userAvatar
                ? <img src={userAvatar} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userName || 'User'}
            </div>
            <div style={{ fontSize: 9, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>{userTag || 'Developer'}</div>
          </div>
        </div>

      </aside>

      {open && <SearchPalette items={searchItems} onClose={() => setOpen(false)} onGame={() => { setOpen(false); setShowGame(true) }} onEasterEggs={() => { setOpen(false); navigate('/easter-eggs') }} onBabum={() => { setOpen(false); playBabum() }} onLeetcode={() => { setOpen(false); window.api?.system.openExternal('https://leetcode.com/problemset/') }} />}
      {showGame && <CrocoGame onClose={() => setShowGame(false)} />}
      {showClone && <CloneModal defaultParent={settings?.paths?.publicProjects} onClose={() => setShowClone(false)} />}
    </>
  )
}

function SearchPalette({ items, onClose, onGame, onEasterEggs, onBabum, onLeetcode }) {
  const navigate    = useNavigate()
  const inputRef    = useRef(null)
  const listRef     = useRef(null)
  const [query,     setQuery]     = useState('')
  const [selected,  setSelected]  = useState(0)

  const q = query.trim().toLowerCase()
  const isGameQuery       = q === 'croco:game'
  const isEasterEggQuery  = q === 'croco:easter-egg'
  const isBabumQuery      = q === 'croco:babumbabum'
  const isLeetcodeQuery   = q === 'croco:leetcode'
  const isSpecialQuery    = isGameQuery || isEasterEggQuery || isBabumQuery || isLeetcodeQuery

  const results = query.trim() && !isSpecialQuery
    ? items.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.sub.toLowerCase().includes(query.toLowerCase()) ||
        item.type.toLowerCase().includes(query.toLowerCase())
      )
    : isSpecialQuery ? [] : items

  useEffect(() => { Promise.resolve().then(() => setSelected(0)) }, [query])
  useEffect(() => { inputRef.current?.focus() }, [])

  const go = (item) => {
    onClose()
    if (item.action) item.action()
    else navigate(item.to)
  }

  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected(s => Math.min(s + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected(s => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      if (isGameQuery)      { onGame?.(); return }
      if (isEasterEggQuery) { onEasterEggs?.(); return }
      if (isBabumQuery)     { onBabum?.(); return }
      if (isLeetcodeQuery)  { onLeetcode?.(); return }
      if (results[selected]) go(results[selected])
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  useEffect(() => {
    const el = listRef.current?.children[selected]
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 120,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 520, background: 'var(--surface)', border: '1px solid var(--border-bright)',
          borderRadius: 'var(--r-xl)', overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          animation: 'pmFadeDown 0.15s cubic-bezier(0.16,1,0.3,1) both',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--dim)', display: 'flex', flexShrink: 0 }}><SearchIcon /></span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search projects, notes, pages..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 14, color: 'var(--text)', fontFamily: 'Geist, sans-serif',
              caretColor: 'var(--accent)',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', fontSize: 16, lineHeight: 1, padding: 0 }}
            >×</button>
          )}
          <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'var(--dimmer)', background: 'var(--border)', padding: '2px 6px', borderRadius: 'var(--r-sm)', flexShrink: 0 }}>Esc</span>
        </div>

        <div ref={listRef} style={{ maxHeight: 360, overflowY: 'auto', padding: '6px 0' }}>
          {isGameQuery ? (
            <div
              onClick={onGame}
              style={{ padding: '20px 18px', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
            >
              <span style={{ fontSize: 28, display: 'flex', color: 'var(--accent)' }}><GameIcon size={28} /></span>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Croco Run</div>
              <div style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Press Enter or click to play</div>
            </div>
          ) : isEasterEggQuery ? (
            <div
              onClick={onEasterEggs}
              style={{ padding: '20px 18px', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
            >
              <span style={{ fontSize: 28, display: 'flex', color: 'var(--accent)' }}><GiftIcon size={28} /></span>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Easter Eggs</div>
              <div style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Press Enter to see all hidden features</div>
            </div>
          ) : isBabumQuery ? (
            <div
              onClick={onBabum}
              style={{ padding: '20px 18px', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
            >
              <span style={{ fontSize: 28, display: 'flex', color: 'var(--accent)' }}><MusicNoteIcon size={28} /></span>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>ba bum ba bum</div>
              <div style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Press Enter to play</div>
            </div>
          ) : isLeetcodeQuery ? (
            <div
              onClick={onLeetcode}
              style={{ padding: '20px 18px', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
            >
              <span style={{ fontSize: 28, display: 'flex', color: 'var(--accent)' }}><PuzzleIcon size={28} /></span>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>LeetCode</div>
              <div style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Press Enter to open the problem set</div>
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: '32px 18px', textAlign: 'center', fontSize: 13, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
              No results for "{query}"
            </div>
          ) : results.map((item, i) => (
            <div
              key={item.type + item.label + (item.to || '')}
              onClick={() => go(item)}
              onMouseEnter={() => setSelected(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '9px 18px', cursor: 'pointer',
                background: selected === i ? 'var(--card)' : 'transparent',
                borderLeft: `2px solid ${selected === i ? 'var(--accent)' : 'transparent'}`,
                transition: 'background var(--transition-fast)',
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, flexShrink: 0, color: 'var(--dim)' }}>{item.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: selected === i ? 'var(--text)' : 'var(--dim)', fontWeight: selected === i ? 500 : 400 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', marginTop: 1 }}>
                  {item.sub}
                </div>
              </div>
              <span style={{ fontSize: 9, fontFamily: 'Geist Mono, monospace', color: TYPE_COLOR[item.type], background: `${TYPE_COLOR[item.type]}18`, padding: '2px 6px', borderRadius: 'var(--r-sm)', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {item.type}
              </span>
              {selected === i && (
                <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', flexShrink: 0 }}>↵</span>
              )}
            </div>
          ))}
        </div>

        <div style={{ padding: '8px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 16 }}>
          {[['↑↓', 'navigate'], ['↵', 'open'], ['Esc', 'close']].map(([key, hint]) => (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
              <span style={{ background: 'var(--border)', padding: '1px 5px', borderRadius: 'var(--r-sm)' }}>{key}</span>
              {hint}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}


const SidebarItem = memo(function SidebarItem({ item }) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      title={item.dim ? (item.dimTitle || '') : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '6px 8px',
        borderRadius: 'var(--r-md)',
        cursor: 'pointer',
        border: 'none',
        borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
        position: 'relative',
        transition: 'all var(--transition-base)',
        textAlign: 'left',
        fontSize: 12,
        fontWeight: isActive ? 600 : 400,
        fontFamily: 'Geist, sans-serif',
        textDecoration: 'none',
        background: isActive ? 'var(--accent-dim)' : isHovered ? 'var(--hover-bg)' : 'transparent',
        color: isActive ? 'var(--text)' : isHovered ? 'var(--text)' : 'var(--dim)',
        marginBottom: 1,
        opacity: item.dim && !isActive ? 0.4 : 1,
      })}
    >
      <span style={{
        width: 14, height: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {item.icon}
      </span>

      <span style={{ flex: 1 }}>{item.label}</span>

      {item.badge != null && (
        <span style={{
          fontSize: 9,
          fontFamily: 'Geist Mono, monospace',
          background: item.badgeStyle === 'accent' ? 'var(--accent-dim)' : 'var(--border)',
          color:      item.badgeStyle === 'accent' ? 'var(--accent)'     : 'var(--dimmer)',
          padding: '1px 5px',
          borderRadius: 'var(--r-xl)',
          transition: 'all var(--transition-base)',
        }}>
          {item.badge}
        </span>
      )}
    </NavLink>
  )
})
