import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { WebglAddon } from '@xterm/addon-webgl'
import { ClipboardAddon } from '@xterm/addon-clipboard'
import '@xterm/xterm/css/xterm.css'
import { RefreshIcon, SearchIcon, XCircleIcon } from '../../constants/SimpleSvgExports'

// A real shell, not a preset-script runner — see TerminalPanel.jsx for
// that (dev/build/start/test buttons, one command at a time, streamed as
// plain text). This spawns the user's actual shell inside a PTY
// (src-tauri/src/pty.rs) and renders it with xterm.js, the standard
// terminal-emulation library (ANSI parsing, cursor handling, scrollback —
// not worth hand-rolling), plus its official addons: clickable URLs
// (web-links), Ctrl+F find-in-scrollback (search), correct emoji/CJK
// widths (unicode11), OSC 52 clipboard writes from CLI tools (clipboard),
// and the GPU renderer (webgl, with automatic fallback to the DOM
// renderer if a context can't be created or gets lost). Stays mounted
// across tab switches (same "always mounted so state survives" pattern
// ProjectDetail.jsx already uses for TerminalPanel) so the shell session
// itself survives switching to another tab and back, only ending when you
// leave the project page or explicitly restart it.

// ANSI palette: the app's own status colors (same hues the Activity page
// uses) over the theme's base/text, so shell output looks native to Croco.
const ANSI_THEME = {
  black: '#1a1a1a', red: '#ff5555', green: '#4aff91', yellow: '#ffd700',
  blue: '#4a9eff', magenta: '#a855f7', cyan: '#4adbdb', white: '#d8d4cc',
  brightBlack: '#6b6b6b', brightRed: '#ff7b7b', brightGreen: '#7dffb0',
  brightYellow: '#ffe14a', brightBlue: '#7bb8ff', brightMagenta: '#c17bff',
  brightCyan: '#7bebeb', brightWhite: '#ffffff',
}

const SEARCH_DECORATIONS = {
  matchBackground: '#4a4a2a',
  matchOverviewRuler: '#ffd700',
  activeMatchBackground: '#7a6a1a',
  activeMatchColorOverviewRuler: '#ffffff',
}

export default function InteractiveTerminal({ projectId }) {
  const containerRef = useRef(null)
  const sessionIdRef = useRef(null)
  const termRef = useRef(null)
  const searchAddonRef = useRef(null)
  const searchInputRef = useRef(null)
  const [status, setStatus] = useState('connecting') // 'connecting' | 'running' | 'exited' | 'error'
  const [remountKey, setRemountKey] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [matchInfo, setMatchInfo] = useState(null) // { resultIndex, resultCount } from the search addon

  useEffect(() => {
    if (!containerRef.current || !window.api?.pty) return
    let cancelled = false
    let offOutput, offExit, resizeObserver, resizeDebounce

    const cssVar = (name, fallback) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
    const term = new Terminal({
      fontFamily: 'Geist Mono, monospace',
      fontSize: 13,
      cursorBlink: true,
      convertEol: true,
      scrollback: 5000,
      allowProposedApi: true, // unicode11 + search-result decorations need it
      theme: {
        background: cssVar('--base', '#0a0a0a'),
        foreground: cssVar('--text', '#e8e4dc'),
        cursor: cssVar('--accent', '#e8e4dc'),
        selectionBackground: 'rgba(138, 138, 138, 0.35)',
        ...ANSI_THEME,
      },
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    // URLs in output become ctrl-clickable; route through the system
    // browser, same as every other external link in the app.
    term.loadAddon(new WebLinksAddon((_event, uri) => {
      window.api.system.openExternal(uri).catch(() => {})
    }))
    const searchAddon = new SearchAddon()
    term.loadAddon(searchAddon)
    const unicode11 = new Unicode11Addon()
    term.loadAddon(unicode11)
    term.unicode.activeVersion = '11'
    term.loadAddon(new ClipboardAddon())
    term.open(containerRef.current)
    // GPU renderer — measurably smoother on fast-scrolling output. Not
    // guaranteed available in every WebView2 session, so fall back to the
    // default DOM renderer rather than failing: dispose on context loss
    // (xterm reverts automatically once the addon is disposed).
    try {
      const webgl = new WebglAddon()
      webgl.onContextLoss(() => webgl.dispose())
      term.loadAddon(webgl)
    } catch {
      /* DOM renderer fallback */
    }
    fit.fit()
    termRef.current = term
    searchAddonRef.current = searchAddon

    const offResults = searchAddon.onDidChangeResults((r) => {
      if (!cancelled) setMatchInfo(r && r.resultCount > 0 ? r : r?.resultCount === 0 ? { resultIndex: -1, resultCount: 0 } : null)
    })

    // Terminal-level shortcuts, intercepted before xterm forwards the
    // keystroke to the shell: Ctrl+F opens the find bar; Ctrl+Shift+C /
    // Ctrl+Shift+V copy/paste (plain Ctrl+C must keep meaning SIGINT).
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true
      if (e.ctrlKey && !e.shiftKey && e.key === 'f') {
        e.preventDefault()
        setSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 0)
        return false
      }
      if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault()
        const sel = term.getSelection()
        if (sel) navigator.clipboard?.writeText(sel).catch(() => {})
        return false
      }
      if (e.ctrlKey && e.shiftKey && (e.key === 'V' || e.key === 'v')) {
        e.preventDefault()
        navigator.clipboard?.readText().then((text) => {
          if (text && sessionIdRef.current) window.api.pty.write(sessionIdRef.current, text).catch(() => {})
        }).catch(() => {})
        return false
      }
      return true
    })

    const start = async () => {
      try {
        // term.cols/rows should already reflect a real fit() against a
        // visible container at this point, but fall back to a sane size
        // rather than ever spawning a degenerate 0x0 pty.
        const cols = term.cols > 0 ? term.cols : 80
        const rows = term.rows > 0 ? term.rows : 24
        const sessionId = await window.api.pty.spawn(projectId, cols, rows)
        if (cancelled) { window.api.pty.kill(sessionId).catch(() => {}); return }
        sessionIdRef.current = sessionId
        setStatus('running')

        offOutput = window.api.pty.onOutput((payload) => {
          if (payload?.sessionId === sessionId) term.write(payload.data)
        })
        offExit = window.api.pty.onExit((payload) => {
          if (payload?.sessionId === sessionId && !cancelled) setStatus('exited')
        })

        term.onData((data) => {
          if (sessionIdRef.current) window.api.pty.write(sessionIdRef.current, data).catch(() => {})
        })

        // Debounced, and only calls pty.resize when the fit actually
        // changed cols/rows: calling fit() inside a ResizeObserver
        // callback can itself alter the observed element (xterm resizes
        // its internal canvas/rows to match), which re-triggers the same
        // observer — an undebounced version of this spirals into dozens
        // of resize events, and each one makes ConPTY force a full
        // redraw/cursor-position requery on the shell, which in testing
        // was enough to make the shell never settle at an idle prompt at
        // all. Coalescing bursts into one trailing call, and skipping the
        // IPC round-trip entirely when nothing actually changed, fixes both.
        resizeObserver = new ResizeObserver(() => {
          clearTimeout(resizeDebounce)
          resizeDebounce = setTimeout(() => {
            const prevCols = term.cols, prevRows = term.rows
            fit.fit()
            if (!cancelled && (term.cols !== prevCols || term.rows !== prevRows) && sessionIdRef.current) {
              window.api.pty.resize(sessionIdRef.current, term.cols, term.rows).catch(() => {})
            }
          }, 120)
        })
        resizeObserver.observe(containerRef.current)
      } catch {
        if (!cancelled) setStatus('error')
      }
    }
    start()

    return () => {
      cancelled = true
      offOutput?.()
      offExit?.()
      offResults?.dispose?.()
      clearTimeout(resizeDebounce)
      resizeObserver?.disconnect()
      if (sessionIdRef.current) window.api.pty.kill(sessionIdRef.current).catch(() => {})
      termRef.current = null
      searchAddonRef.current = null
      term.dispose()
    }
    // remountKey is otherwise unused by the effect body — it's a dependency
    // purely so bumping it (Restart button) forces this whole effect to
    // re-run: dispose the old terminal/session via the cleanup function
    // above, then spawn a fresh one. A `key` prop on this component's own
    // returned root would NOT do that (key only affects how a *parent*
    // reconciles this component against siblings, not self-remounting).
  }, [projectId, remountKey])

  const restart = () => {
    setStatus('connecting')
    setRemountKey(k => k + 1)
  }

  const runSearch = (query, { backwards = false, incremental = false } = {}) => {
    const addon = searchAddonRef.current
    if (!addon) return
    if (!query) { addon.clearDecorations(); setMatchInfo(null); return }
    const opts = { decorations: SEARCH_DECORATIONS, incremental }
    if (backwards) addon.findPrevious(query, opts)
    else addon.findNext(query, opts)
  }

  const closeSearch = () => {
    setSearchOpen(false)
    setSearchQuery('')
    setMatchInfo(null)
    searchAddonRef.current?.clearDecorations()
    termRef.current?.focus()
  }

  const openSearch = () => {
    setSearchOpen(true)
    setTimeout(() => searchInputRef.current?.focus(), 0)
  }

  const searchKeyDown = (e) => {
    if (e.key === 'Enter') runSearch(searchQuery, { backwards: e.shiftKey })
    else if (e.key === 'Escape') closeSearch()
  }

  const findBtnStyle = { padding: '2px 7px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 11, cursor: 'pointer', fontFamily: 'Geist Mono, monospace', lineHeight: '16px' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 400 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', color: status === 'running' ? '#4aff91' : status === 'error' ? '#ff4444' : 'var(--dimmer)' }}>
          {status === 'connecting' ? '● connecting…' : status === 'running' ? '● shell running' : status === 'exited' ? '■ shell exited' : '■ could not start'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {searchOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); runSearch(e.target.value, { incremental: true }) }}
                onKeyDown={searchKeyDown}
                placeholder="Find in terminal…"
                style={{ width: 170, padding: '3px 8px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--base)', color: 'var(--text)', fontSize: 11, fontFamily: 'Geist Mono, monospace', outline: 'none' }}
              />
              <span style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', color: 'var(--dimmer)', minWidth: 38, textAlign: 'center' }}>
                {matchInfo ? (matchInfo.resultCount > 0 ? `${matchInfo.resultIndex + 1}/${matchInfo.resultCount}` : '0/0') : ''}
              </span>
              <button title="Previous match (Shift+Enter)" onClick={() => runSearch(searchQuery, { backwards: true })} style={findBtnStyle}>↑</button>
              <button title="Next match (Enter)" onClick={() => runSearch(searchQuery)} style={findBtnStyle}>↓</button>
              <button title="Close (Esc)" onClick={closeSearch} style={findBtnStyle}>✕</button>
            </div>
          ) : (
            <button title="Find in terminal (Ctrl+F)" onClick={openSearch} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 11, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
              <SearchIcon size={11} /> Find
            </button>
          )}
          {(status === 'exited' || status === 'error') && (
            <button onClick={restart} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 11, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
              <RefreshIcon /> Restart
            </button>
          )}
        </div>
      </div>
      <div
        ref={containerRef}
        style={{ flex: 1, minHeight: 300, maxHeight: 580, borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', padding: '10px 4px 4px 10px', background: 'var(--base)', overflow: 'hidden' }}
      />
      {status === 'error' && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#ff6b6b', display: 'flex', alignItems: 'center', gap: 6 }}>
          <XCircleIcon size={12} /> Could not start a shell — check that a shell is available on your system PATH.
        </div>
      )}
    </div>
  )
}
