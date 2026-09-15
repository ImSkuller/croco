import { useState, useEffect, useRef, useCallback } from 'react'
import { useToast } from '../Toast/useToast.js'

const PERMISSION_MODES = [
  { value: 'plan',        label: 'Plan',         desc: 'Read-only — can look around and propose, never edits or runs anything.' },
  { value: 'manual',      label: 'Manual',       desc: 'Asks before each tool use (denied automatically — no prompt UI in this panel yet).' },
  { value: 'acceptEdits', label: 'Accept Edits', desc: 'Auto-accepts file edits. Still won’t run arbitrary commands unprompted.' },
  { value: 'dontAsk',     label: "Don't Ask",    desc: 'Skips confirmation prompts where the CLI allows it.' },
]

// Renders the transcript from claude -p --output-format stream-json — one
// JSON object per line describing a turn (system init, assistant text/
// tool-use, the final result). See src-tauri/src/claude_cli.rs for the
// process side; this only ever talks to it over window.api.ide.claudeCode.
export default function ClaudeCodePanel({ projectId, permissionMode, onPermissionModeChange, onClose }) {
  const toast = useToast()
  const [available, setAvailable] = useState(null) // null = checking
  const [messages, setMessages] = useState([]) // [{role, text, cost, error}]
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const sessionIdRef = useRef(null)
  const listRef = useRef(null)
  const draftRef = useRef('') // accumulates streamed assistant text for the in-progress turn

  useEffect(() => {
    let cancelled = false
    window.api?.ide.claudeCode.check().then(r => { if (!cancelled) setAvailable(!!r?.available) }).catch(() => { if (!cancelled) setAvailable(false) })
    return () => { cancelled = true }
  }, [])

  const appendAssistantChunk = useCallback((text) => {
    draftRef.current += text
    setMessages(prev => {
      const next = [...prev]
      const last = next[next.length - 1]
      if (last && last.role === 'assistant' && last.streaming) {
        next[next.length - 1] = { ...last, text: draftRef.current }
      } else {
        next.push({ role: 'assistant', text: draftRef.current, streaming: true })
      }
      return next
    })
  }, [])

  useEffect(() => {
    if (!projectId) return
    const offEvent = window.api?.ide.claudeCode.onEvent((payload) => {
      if (payload?.projectId !== projectId) return
      const event = payload.event
      if (!event) return
      if (event.type === 'system' && event.subtype === 'init') {
        sessionIdRef.current = event.session_id || sessionIdRef.current
      } else if (event.type === 'assistant') {
        const blocks = event.message?.content || []
        for (const block of blocks) {
          if (block.type === 'text' && block.text) appendAssistantChunk(block.text)
          else if (block.type === 'tool_use') {
            setMessages(prev => [...prev, { role: 'tool', text: block.name, streaming: false }])
          }
        }
      } else if (event.type === 'result') {
        sessionIdRef.current = event.session_id || sessionIdRef.current
        draftRef.current = ''
        setMessages(prev => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.role === 'assistant' && last.streaming) next[next.length - 1] = { ...last, streaming: false }
          return next
        })
        if (event.is_error) {
          setMessages(prev => [...prev, { role: 'error', text: event.result || 'Claude Code returned an error.' }])
        }
        setSending(false)
      }
    })
    const offStderr = window.api?.ide.claudeCode.onStderr((payload) => {
      if (payload?.projectId !== projectId || !payload.text?.trim()) return
      setMessages(prev => [...prev, { role: 'error', text: payload.text }])
    })
    const offDone = window.api?.ide.claudeCode.onDone((payload) => {
      if (payload?.projectId !== projectId) return
      setSending(false)
    })
    return () => { offEvent?.(); offStderr?.(); offDone?.() }
  }, [projectId, appendAssistantChunk])

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }) }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text }])
    draftRef.current = ''
    setSending(true)
    try {
      await window.api.ide.claudeCode.send(projectId, text, sessionIdRef.current, permissionMode)
    } catch (e) {
      setSending(false)
      toast.error('Could not reach Claude Code', e.message)
      setMessages(prev => [...prev, { role: 'error', text: e.message }])
    }
  }

  const stop = () => { window.api?.ide.claudeCode.stop(projectId).catch(() => {}); setSending(false) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 6px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Claude Code</span>
        <button onClick={onClose} title="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', fontSize: 14, lineHeight: 1, padding: 2 }}>×</button>
      </div>

      {available === false ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20, textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>The <code style={{ fontFamily: 'Geist Mono, monospace' }}>claude</code> CLI wasn't found on your PATH.</span>
          <span style={{ fontSize: 11, color: 'var(--dimmer)' }}>Install Claude Code, then reopen this panel.</span>
        </div>
      ) : (
        <>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
            {PERMISSION_MODES.map(m => (
              <button
                key={m.value}
                title={m.desc}
                onClick={() => onPermissionModeChange(m.value)}
                style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 'var(--r-xl)', cursor: 'pointer',
                  border: `1px solid ${permissionMode === m.value ? 'var(--accent)' : 'var(--border)'}`,
                  background: permissionMode === m.value ? 'var(--accent-dim)' : 'transparent',
                  color: permissionMode === m.value ? 'var(--accent)' : 'var(--dimmer)',
                  transition: 'all var(--transition-fast)',
                }}
              >{m.label}</button>
            ))}
          </div>

          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--dimmer)', textAlign: 'center', marginTop: 20 }}>
                Ask Claude Code about this project — it runs the real <code style={{ fontFamily: 'Geist Mono, monospace' }}>claude</code> CLI, scoped to this project's folder.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className="pm-tab-content" style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '92%', padding: '8px 10px', borderRadius: 'var(--r-md)', fontSize: 12.5, lineHeight: 1.5,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                background: m.role === 'user' ? 'var(--accent-dim)' : m.role === 'error' ? 'rgba(255,68,68,0.1)' : m.role === 'tool' ? 'var(--card)' : 'var(--card)',
                border: `1px solid ${m.role === 'error' ? 'rgba(255,68,68,0.3)' : 'var(--border)'}`,
                color: m.role === 'error' ? '#ff6b6b' : m.role === 'tool' ? 'var(--dim)' : 'var(--text)',
                fontFamily: m.role === 'tool' ? 'Geist Mono, monospace' : 'inherit',
              }}>
                {m.role === 'tool' ? `→ ${m.text}` : m.text}
              </div>
            ))}
            {sending && draftRef.current === '' && (
              <div style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Thinking…</div>
            )}
          </div>

          <div style={{ padding: 10, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Message Claude Code…"
              rows={2}
              style={{
                flex: 1, resize: 'none', background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)', padding: '7px 9px', color: 'var(--text)', fontSize: 12.5,
                fontFamily: 'Geist, sans-serif', outline: 'none', transition: 'border-color var(--transition-fast)',
              }}
            />
            <button
              onClick={sending ? stop : send}
              disabled={!sending && !input.trim()}
              style={{
                padding: '0 14px', borderRadius: 'var(--r-md)', border: 'none', cursor: 'pointer',
                background: sending ? 'rgba(255,68,68,0.15)' : 'var(--accent)',
                color: sending ? '#ff6b6b' : 'var(--base)',
                fontSize: 11, fontWeight: 600, opacity: (!sending && !input.trim()) ? 0.5 : 1,
                transition: 'all var(--transition-fast)',
              }}
            >{sending ? 'Stop' : 'Send'}</button>
          </div>
        </>
      )}
    </div>
  )
}
