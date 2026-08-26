import { useState, useEffect, useRef, useMemo, memo } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { GridIcon, ListIcon, Logo, NoteIcon, SearchIcon, SettingsIcon, TodoIcon } from '../../constants/SvgExports.jsx'
import { StarIcon, ActivityIcon, TrendIcon, GithubIcon } from '../../constants/SimpleSvgExports.jsx'
import ManagerVersion from '../../constants/versionManager.jsx'
import { useToast } from '../Toast/useToast.js'
import { useData, useDataStore, EMPTY_LIST } from '../../lib/store'
import { modKeyHint } from '../../lib/platform'
import CrocoGame from '../CrocoGame/CrocoGame.jsx'

const TYPE_COLOR = {
  project: 'var(--blue)',
  note:    'var(--orange)',
  todo:    'var(--green)',
  page:    'var(--dimmer)',
}

const STATIC_PAGES = [
  { type: 'page', label: 'Dashboard',  sub: 'page', to: '/',           emoji: '🏠' },
  { type: 'page', label: 'Settings',   sub: 'page', to: '/settings',   emoji: '⚙️' },
  { type: 'page', label: 'Favourites', sub: 'page', to: '/favourites', emoji: '⭐' },
  { type: 'page', label: 'Ideas',      sub: 'page', to: '/ideas',      emoji: '💡' },
  { type: 'page', label: 'GitHub',     sub: 'page', to: '/github',     emoji: '🐙' },
]

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

  const openTodosCount    = useMemo(() => todos.filter(t => !t.completed).length, [todos])
  const unarchivedNotes   = useMemo(() => notes.filter(n => !n.archived).length, [notes])
  const activeProjects    = useMemo(() => projects.filter(p => !p.archived).length, [projects])
  const initials          = userName ? userName.slice(0, 2).toUpperCase() : '??'

  const NAV = useMemo(() => [
    {
      label: 'Menu',
      items: [
        { to: '/',            label: 'Dashboard',  badge: null,                    icon: <GridIcon /> },
        { to: '/projects',    label: 'Projects',   badge: activeProjects || null,   icon: <ListIcon /> },
        { to: '/favourites',  label: 'Favourites', badge: null,                    icon: <StarIcon filled={false} /> },
        { to: '/notes',       label: 'Notes',      badge: unarchivedNotes || null,  icon: <NoteIcon /> },
        { to: '/todos',       label: 'Todo',       badge: openTodosCount || null,   icon: <TodoIcon />, badgeStyle: 'accent' },
        { to: '/activity',    label: 'Activity',   badge: null,                    icon: <ActivityIcon /> },
        { to: '/patterns',    label: 'Patterns',   badge: null,                    icon: <TrendIcon /> },
        { to: '/github',      label: 'GitHub',     badge: null,                    icon: <GithubIcon /> },
      ],
    },
    {
      label: 'System',
      items: [
        { to: '/settings', label: 'Settings', badge: hasUpdate ? '↑' : null, icon: <SettingsIcon />, badgeStyle: hasUpdate ? 'accent' : undefined },
      ],
    },
  ], [activeProjects, unarchivedNotes, openTodosCount, hasUpdate])

  const searchItems = useMemo(() => [
    ...projects.map(p => ({
      type:  'project',
      label: p.name,
      sub:   p.tags?.join(' · ') || p.ide || 'project',
      to:    `/projects/${p.id}`,
      emoji: p.emoji || '📁',
    })),
    ...notes.map(n => ({
      type:  'note',
      label: n.title,
      sub:   n.project || 'no project',
      to:    `/note-editor/${n.id}`,
      emoji: n.emoji || '📝',
    })),
    ...todos.filter(t => !t.completed).map(t => ({
      type:  'todo',
      label: t.title,
      sub:   `${t.priority || 'med'} priority`,
      to:    '/todos',
      emoji: t.emoji || '✅',
    })),
    ...STATIC_PAGES,
  ], [projects, notes, todos])

  return (
    <>
      <aside style={{
        width: 200,
        minWidth: 200,
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
            borderRadius: 6,
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
              borderRadius: 8,
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
              borderRadius: 6,
              padding: '6px 9px',
              cursor: 'pointer',
              transition: 'border-color var(--transition-fast)',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-bright)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <span style={{ color: 'var(--dimmer)', display: 'flex', flexShrink: 0 }}><SearchIcon /></span>
            <span style={{ fontSize: 12, color: 'var(--dimmer)', flex: 1 }}>Search...</span>
            <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, color: 'var(--dimmer)', background: 'var(--border)', padding: '1px 4px', borderRadius: 3 }}>{modKeyHint('K')}</span>
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

  const go = (item) => { navigate(item.to); onClose() }

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
          borderRadius: 14, overflow: 'hidden',
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
          <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'var(--dimmer)', background: 'var(--border)', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>Esc</span>
        </div>

        <div ref={listRef} style={{ maxHeight: 360, overflowY: 'auto', padding: '6px 0' }}>
          {isGameQuery ? (
            <div
              onClick={onGame}
              style={{ padding: '20px 18px', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
            >
              <span style={{ fontSize: 28 }}>🐊</span>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Croco Run</div>
              <div style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Press Enter or click to play</div>
            </div>
          ) : isEasterEggQuery ? (
            <div
              onClick={onEasterEggs}
              style={{ padding: '20px 18px', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
            >
              <span style={{ fontSize: 28 }}>🥚</span>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Easter Eggs</div>
              <div style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Press Enter to see all hidden features</div>
            </div>
          ) : isBabumQuery ? (
            <div
              onClick={onBabum}
              style={{ padding: '20px 18px', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
            >
              <span style={{ fontSize: 28 }}>🎵</span>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>ba bum ba bum</div>
              <div style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Press Enter to play</div>
            </div>
          ) : isLeetcodeQuery ? (
            <div
              onClick={onLeetcode}
              style={{ padding: '20px 18px', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
            >
              <span style={{ fontSize: 28 }}>🧩</span>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>LeetCode</div>
              <div style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Press Enter to open the problem set</div>
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: '32px 18px', textAlign: 'center', fontSize: 13, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
              No results for "{query}"
            </div>
          ) : results.map((item, i) => (
            <div
              key={item.to + item.label}
              onClick={() => go(item)}
              onMouseEnter={() => setSelected(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '9px 18px', cursor: 'pointer',
                background: selected === i ? 'var(--card)' : 'transparent',
                borderLeft: `2px solid ${selected === i ? 'var(--accent)' : 'transparent'}`,
                transition: 'background 0.08s',
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{item.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: selected === i ? 'var(--text)' : 'var(--dim)', fontWeight: selected === i ? 500 : 400 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', marginTop: 1 }}>
                  {item.sub}
                </div>
              </div>
              <span style={{ fontSize: 9, fontFamily: 'Geist Mono, monospace', color: TYPE_COLOR[item.type], background: `${TYPE_COLOR[item.type]}18`, padding: '2px 6px', borderRadius: 4, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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
              <span style={{ background: 'var(--border)', padding: '1px 5px', borderRadius: 3 }}>{key}</span>
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
        borderRadius: 6,
        cursor: 'pointer',
        border: 'none',
        borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
        position: 'relative',
        transition: 'all 0.15s ease',
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
          borderRadius: 20,
          transition: 'all 0.15s ease',
        }}>
          {item.badge}
        </span>
      )}
    </NavLink>
  )
})
