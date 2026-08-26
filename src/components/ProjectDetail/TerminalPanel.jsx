import { useState, useRef, useEffect } from 'react'
import { CopyIcon, StopIcon, PlayIcon, RefreshIcon, TerminalIcon } from '../../constants/SimpleSvgExports'

const SCRIPT_SLOTS    = ['dev', 'build', 'start', 'test']
const RUN_ENVS        = ['development', 'production', 'staging', 'test']
const ENV_COLOR       = { development: '#4aff91', production: '#ff6b35', staging: '#a855f7', test: '#ffd700' }
const PRIORITY_SLOTS  = new Set(['dev', 'start', 'build', 'test', 'lint', 'preview', 'serve', 'watch'])

export default function TerminalPanel({ output, command, isRunning, project, allScripts, runEnv, onEnvChange, onClear, onRun, onRefreshScripts }) {
  const bottomRef    = useRef(null)
  const customRef    = useRef(null)
  const [copied,     setCopied]     = useState(false)
  const [custom,     setCustom]     = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [showAll,    setShowAll]    = useState(false)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [output])

  const cmds = project?.commands || {}

  // Build the script button list: npm scripts take priority, fall back to project.commands slots
  const npmScripts = allScripts.length > 0 ? allScripts : []
  const fallbackSlots = SCRIPT_SLOTS.filter(s => cmds[s]).map(s => ({ name: s, command: cmds[s] }))
  const scriptList = npmScripts.length > 0 ? npmScripts : fallbackSlots

  // Sort: priority scripts first, then alphabetical
  const sorted = [...scriptList].sort((a, b) => {
    const pa = PRIORITY_SLOTS.has(a.name) ? 0 : 1
    const pb = PRIORITY_SLOTS.has(b.name) ? 0 : 1
    return pa !== pb ? pa - pb : a.name.localeCompare(b.name)
  })

  const visibleScripts = showAll ? sorted : sorted.slice(0, 8)
  const hasMore = sorted.length > 8

  const handleCopy = () => {
    navigator.clipboard.writeText(output.map(l => l.text).join('')).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  const runCustom = () => {
    if (!custom.trim() || isRunning) return
    onRun(custom.trim())
    setCustom(''); setShowCustom(false)
  }

  const isActiveScript = (s) => isRunning && command === s.command
  const envColor = ENV_COLOR[runEnv] || 'var(--dim)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 400 }}>

      {/* ── Environment selector ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', flexShrink: 0 }}>NODE_ENV</span>
        <div style={{ display: 'flex', gap: 2, padding: 2, background: 'var(--border)', borderRadius: 7 }}>
          {RUN_ENVS.map(env => (
            <button key={env} onClick={() => !isRunning && onEnvChange(env)} disabled={isRunning}
              style={{
                padding: '4px 9px', borderRadius: 5, border: 'none', fontSize: 10,
                fontFamily: 'Geist Mono, monospace', cursor: isRunning ? 'not-allowed' : 'pointer',
                background: runEnv === env ? `${ENV_COLOR[env]}18` : 'transparent',
                color:      runEnv === env ? ENV_COLOR[env] : 'var(--dimmer)',
                outline:    runEnv === env ? `1px solid ${ENV_COLOR[env]}40` : 'none',
                transition: 'all 0.12s',
              }}>
              {env}
            </button>
          ))}
        </div>
        {runEnv !== 'development' && (
          <span style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', color: envColor, background: `${envColor}14`, border: `1px solid ${envColor}35`, padding: '2px 7px', borderRadius: 4 }}>
            NODE_ENV={runEnv}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          {output.length > 0 && (
            <button onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 11, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
              <CopyIcon />{copied ? 'Copied!' : 'Copy'}
            </button>
          )}
          {output.length > 0 && (
            <button onClick={onClear} style={{ padding: '4px 9px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 11, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
              Clear
            </button>
          )}
          {isRunning && (
            <button onClick={() => onRun()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 7, border: 'none',
                background: 'rgba(255,68,68,0.12)', color: '#ff4444',
                fontSize: 12, fontWeight: 500, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}>
              <StopIcon /> Stop
            </button>
          )}
        </div>
      </div>

      {/* ── Script buttons ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
        {visibleScripts.map(s => (
          <button key={s.name}
            onClick={() => !isRunning && onRun(s.command)}
            disabled={isRunning}
            title={s.command}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 11px', borderRadius: 7, fontSize: 11, fontFamily: 'Geist, sans-serif',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              border: `1px solid ${isActiveScript(s) ? 'rgba(74,255,145,0.4)' : 'var(--border)'}`,
              background: isActiveScript(s) ? 'rgba(74,255,145,0.08)' : 'var(--card)',
              color:      isActiveScript(s) ? '#4aff91' : isRunning ? 'var(--dimmer)' : 'var(--dim)',
              opacity: isRunning && !isActiveScript(s) ? 0.4 : 1,
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => { if (!isRunning) { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.color = 'var(--text)' } }}
            onMouseLeave={e => { if (!isRunning && !isActiveScript(s)) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--dim)' } }}
          >
            {isActiveScript(s) ? <span style={{ fontSize: 8, color: '#4aff91' }}>●</span> : <PlayIcon />}
            <span style={{ fontFamily: 'Geist Mono, monospace' }}>{s.name}</span>
          </button>
        ))}

        {hasMore && (
          <button onClick={() => setShowAll(p => !p)}
            style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--dimmer)', cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
            {showAll ? '↑ less' : `+${sorted.length - 8} more`}
          </button>
        )}

        {/* Custom command */}
        {!showCustom ? (
          <button onClick={() => { setShowCustom(true); setTimeout(() => customRef.current?.focus(), 50) }}
            disabled={isRunning}
            style={{ padding: '5px 11px', borderRadius: 7, fontSize: 11, fontFamily: 'Geist, sans-serif',
              border: '1px dashed var(--border)', background: 'transparent', color: 'var(--dimmer)',
              cursor: isRunning ? 'not-allowed' : 'pointer', opacity: isRunning ? 0.4 : 1 }}>
            $ custom…
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <input ref={customRef} value={custom} onChange={e => setCustom(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') runCustom(); if (e.key === 'Escape') { setShowCustom(false); setCustom('') } }}
              placeholder="npm run lint"
              style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, padding: '5px 9px', borderRadius: 6,
                background: 'var(--base)', border: '1px solid var(--border-bright)', color: 'var(--text)', outline: 'none', width: 160 }} />
            <button onClick={runCustom} disabled={!custom.trim()}
              style={{ padding: '5px 11px', borderRadius: 6, border: 'none',
                background: custom.trim() ? 'var(--orange)' : 'var(--dimmer)', color: '#fff',
                fontSize: 11, fontFamily: 'Geist, sans-serif', cursor: custom.trim() ? 'pointer' : 'not-allowed' }}>
              Run
            </button>
            <button onClick={() => { setShowCustom(false); setCustom('') }}
              style={{ padding: '5px 9px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--dim)', fontSize: 11, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}>
              ✕
            </button>
          </div>
        )}
      </div>

      {/* ── Script source tag ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        {scriptList.length > 0 && (
          <div style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
            {npmScripts.length > 0
              ? <span><span style={{ color: 'var(--green)' }}>package.json</span> · {sorted.length} scripts</span>
              : <span><span style={{ color: 'var(--orange)' }}>project config</span> · {sorted.length} scripts</span>
            }
          </div>
        )}
        <button
          onClick={onRefreshScripts}
          disabled={isRunning}
          title="Re-scan scripts from package.json / project config"
          style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 7px', borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dimmer)', fontSize: 10, cursor: isRunning ? 'not-allowed' : 'pointer', fontFamily: 'Geist, sans-serif', opacity: isRunning ? 0.5 : 1 }}
        >
          <RefreshIcon /> Refresh
        </button>
      </div>

      {/* ── Running command label ── */}
      {command && (
        <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--dimmer)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: isRunning ? '#4aff91' : 'var(--dimmer)', fontSize: 8 }}>{isRunning ? '●' : '■'}</span>
          <span style={{ color: isRunning ? '#4aff91' : 'var(--dim)' }}>{command}</span>
          {isRunning && runEnv !== 'development' && (
            <span style={{ color: envColor, fontSize: 10 }}>[{runEnv}]</span>
          )}
        </div>
      )}

      {/* ── Output area ── */}
      <div style={{
        flex: 1, background: '#0a0a0a', border: '1px solid var(--border)', borderRadius: 10,
        padding: '14px 16px', overflowY: 'auto', fontFamily: 'Geist Mono, monospace', fontSize: 12,
        lineHeight: 1.6, minHeight: 300, maxHeight: 580,
      }}>
        {output.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10, opacity: 0.4 }}>
            <TerminalIcon />
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>
              {scriptList.length > 0 ? 'Select a script above to run it' : 'No scripts found — use the custom command input'}
            </span>
          </div>
        ) : (
          <>
            {output.map((line, i) => (
              <span key={i} style={{
                display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                color: line.type === 'stderr'  ? '#ff6b6b'
                     : line.type === 'error'   ? '#ff4444'
                     : line.type === 'system'  ? '#666'
                     : '#c9d1d9',
              }}>
                {line.text}
              </span>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </div>
  )
}
