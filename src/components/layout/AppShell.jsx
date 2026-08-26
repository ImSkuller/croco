import { useEffect, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import ToastProvider from '../Toast/ToastProvider'
import { formatKeyToken } from '../../lib/platform'
import { SHORTCUT_DEFS, resolveBindings, chordKey, bindingToDisplay } from '../../lib/shortcuts'

export default function AppShell() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const [showHelp,  setShowHelp]  = useState(false)
  const [checked,   setChecked]   = useState(false)
  const [overrides, setOverrides] = useState({})

  // First-launch redirect
  useEffect(() => {
    if (!window.api || location.pathname === '/onboarding') { Promise.resolve().then(() => setChecked(true)); return }
    window.api.settings.get().then(s => {
      if (!s?.app?.onboarded) navigate('/onboarding', { replace: true })
      setOverrides(s?.app?.shortcuts || {})
    }).catch(() => {}).finally(() => setChecked(true))
  }, [])

  // Listen for shortcut changes saved from Settings page
  useEffect(() => {
    const handler = () => {
      window.api?.settings.get().then(s => setOverrides(s?.app?.shortcuts || {})).catch(() => {})
    }
    window.addEventListener('croco:shortcuts-changed', handler)
    return () => window.removeEventListener('croco:shortcuts-changed', handler)
  }, [])

  // Global keyboard shortcuts
  useEffect(() => {
    let gPressed = false
    let gTimer   = null

    const handler = (e) => {
      const inInput = ['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable
      if (inInput) return

      const b = resolveBindings(overrides)

      // Help
      if (!e.ctrlKey && !e.metaKey && e.key === b['help']) {
        e.preventDefault(); setShowHelp(h => !h); return
      }
      if (e.key === 'Escape') { setShowHelp(false); return }

      // Ctrl+, → settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault(); navigate('/settings'); return
      }

      // Chord: g → wait for second key
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
        gPressed = true
        clearTimeout(gTimer)
        gTimer = setTimeout(() => { gPressed = false }, 1000)
        return
      }
      if (gPressed) {
        gPressed = false
        clearTimeout(gTimer)
        const keyRoutes = {
          [chordKey(b['goto-dash'])]:      '/',
          [chordKey(b['goto-projects'])]:  '/projects',
          [chordKey(b['goto-notes'])]:     '/notes',
          [chordKey(b['goto-todos'])]:     '/todos',
          [chordKey(b['goto-settings'])]:  '/settings',
          [chordKey(b['goto-ideas'])]:     '/ideas',
          [chordKey(b['goto-activity'])]:  '/activity',
          [chordKey(b['goto-favs'])]:      '/favourites',
        }
        if (keyRoutes[e.key]) { e.preventDefault(); navigate(keyRoutes[e.key]) }
      }
    }

    window.addEventListener('keydown', handler)
    return () => { window.removeEventListener('keydown', handler); clearTimeout(gTimer) }
  }, [navigate, overrides])

  if (!checked) return null

  return (
    <ToastProvider>
      <div style={{ display: 'flex', height: '100vh', minHeight: 700, background: 'var(--base)', fontFamily: 'var(--font-body)', color: 'var(--text)', fontSize: 13, lineHeight: 1.5 }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--base)' }}>
          <Outlet />
        </div>
      </div>

      {showHelp && <ShortcutsModal overrides={overrides} onClose={() => setShowHelp(false)} />}
    </ToastProvider>
  )
}

function ShortcutsModal({ overrides, onClose }) {
  const groups = [...new Set(SHORTCUT_DEFS.map(s => s.group))]

  const displayFor = (def) => {
    const override = overrides[def.id]
    if (!override) return def.display
    if (def.chord) {
      const second = chordKey(override).toUpperCase()
      return ['G', 'then', second]
    }
    return bindingToDisplay(override)
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px 16px',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', border: '1px solid var(--border-bright)',
        borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '85vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
        animation: 'pmFadeDown 0.15s cubic-bezier(0.16,1,0.3,1) both',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Keyboard Shortcuts</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
              Remap in <span style={{ color: 'var(--dim)' }}>Settings → Shortcuts</span>
            </span>
            <kbd style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', background: 'var(--border)', color: 'var(--dimmer)', padding: '2px 6px', borderRadius: 4 }}>?</kbd>
          </div>
        </div>

        <div style={{ overflowY: 'auto', padding: '12px 18px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {groups.map(group => (
            <div key={group}>
              <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Geist Mono, monospace', marginBottom: 6 }}>
                {group}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {SHORTCUT_DEFS.filter(s => s.group === group).map((s, i) => {
                  const tokens = displayFor(s)
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', gap: 12 }}>
                      <span style={{ fontSize: 12, color: 'var(--dim)', minWidth: 0 }}>{s.desc}</span>
                      <div style={{ display: 'flex', gap: 3, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {tokens.map((k, ki) => (
                          k === 'then' || k === '–'
                            ? <span key={ki} style={{ fontSize: 10, color: 'var(--dimmer)', alignSelf: 'center' }}>{k}</span>
                            : <kbd key={ki} style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '3px 6px', borderRadius: 5, boxShadow: '0 1px 0 var(--border)', whiteSpace: 'nowrap' }}>{formatKeyToken(k)}</kbd>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--dimmer)' }}>Press <kbd style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', background: 'var(--border)', color: 'var(--dim)', padding: '1px 5px', borderRadius: 3 }}>Esc</kbd> or click outside to close</span>
        </div>
      </div>
    </div>
  )
}
