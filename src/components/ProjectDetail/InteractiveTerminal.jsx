import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { RefreshIcon, XCircleIcon } from '../../constants/SimpleSvgExports'

// A real shell, not a preset-script runner — see TerminalPanel.jsx for
// that (dev/build/start/test buttons, one command at a time, streamed as
// plain text). This spawns the user's actual shell inside a PTY
// (src-tauri/src/pty.rs) and renders it with xterm.js, the standard
// terminal-emulation library (ANSI parsing, cursor handling, scrollback —
// not worth hand-rolling). Stays mounted across tab switches (same
// "always mounted so state survives" pattern ProjectDetail.jsx already
// uses for TerminalPanel) so the shell session itself survives switching
// to another tab and back, only ending when you leave the project page or
// explicitly restart it.
export default function InteractiveTerminal({ projectId }) {
  const containerRef = useRef(null)
  const sessionIdRef = useRef(null)
  const [status, setStatus] = useState('connecting') // 'connecting' | 'running' | 'exited' | 'error'
  const [remountKey, setRemountKey] = useState(0)

  useEffect(() => {
    if (!containerRef.current || !window.api?.pty) return
    let cancelled = false
    let offOutput, offExit, resizeObserver, resizeDebounce

    const term = new Terminal({
      fontFamily: 'Geist Mono, monospace',
      fontSize: 13,
      cursorBlink: true,
      convertEol: true,
      theme: {
        background: getComputedStyle(document.documentElement).getPropertyValue('--base').trim() || '#0a0a0a',
        foreground: getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#e8e4dc',
        cursor: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e8e4dc',
      },
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)
    fit.fit()

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
      clearTimeout(resizeDebounce)
      resizeObserver?.disconnect()
      if (sessionIdRef.current) window.api.pty.kill(sessionIdRef.current).catch(() => {})
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 400 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', color: status === 'running' ? '#4aff91' : status === 'error' ? '#ff4444' : 'var(--dimmer)' }}>
          {status === 'connecting' ? '● connecting…' : status === 'running' ? '● shell running' : status === 'exited' ? '■ shell exited' : '■ could not start'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
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
