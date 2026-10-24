import { useState, useEffect, useRef, useCallback } from 'react'
import { useToast } from '../Toast/useToast.js'
import { extractListItems } from '../../lib/listItems.js'
import AddTodosButton from '../AI/AddTodosButton'

const PERMISSION_MODES = [
  { value: 'plan',        label: 'Plan',         desc: 'Read-only — can look around and propose, never edits or runs anything.' },
  { value: 'manual',      label: 'Manual',       desc: 'Asks before each tool use — review and Accept or Reject right here.' },
  { value: 'acceptEdits', label: 'Accept Edits', desc: 'Auto-accepts file edits. Still won’t run arbitrary commands unprompted.' },
  { value: 'dontAsk',     label: "Don't Ask",    desc: 'Skips confirmation prompts where the CLI allows it.' },
]

// Minimal line-level diff for a single old/new string pair — not a real LCS
// diff (this is a side panel, not the editor), just labeled removed/added
// blocks capped so one giant tool_use can't blow out the panel.
const MAX_DIFF_LINES = 24
function clipLines(text) {
  const lines = String(text ?? '').split('\n')
  if (lines.length <= MAX_DIFF_LINES) return lines.join('\n')
  return lines.slice(0, MAX_DIFF_LINES).join('\n') + `\n… (${lines.length - MAX_DIFF_LINES} more lines)`
}

function EditDiff({ oldString, newString }) {
  return (
    <>
      {oldString != null && (
        <pre style={diffBlockStyle('rgba(255,68,68,0.08)', '#ff6b6b')}>{clipLines(oldString).split('\n').map(l => `- ${l}`).join('\n')}</pre>
      )}
      {newString != null && (
        <pre style={diffBlockStyle('rgba(46,204,113,0.08)', '#2ecc71')}>{clipLines(newString).split('\n').map(l => `+ ${l}`).join('\n')}</pre>
      )}
    </>
  )
}

function diffBlockStyle(bg, color) {
  return {
    margin: '4px 0', padding: '6px 8px', borderRadius: 'var(--r-sm)', background: bg, color,
    fontFamily: 'Geist Mono, monospace', fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  }
}

// Renders whatever a pending PreToolUse hook request looks like, specialized
// for the tools that actually touch disk (Edit/MultiEdit/Write); anything
// else (Bash, Read, …) falls back to a plain input dump.
function PermissionRequestCard({ request, onRespond, responding }) {
  const { toolName, toolInput } = request
  let body
  if (toolName === 'Edit' && toolInput) {
    body = <EditDiff oldString={toolInput.old_string} newString={toolInput.new_string} />
  } else if (toolName === 'MultiEdit' && Array.isArray(toolInput?.edits)) {
    body = toolInput.edits.map((e, i) => <EditDiff key={i} oldString={e.old_string} newString={e.new_string} />)
  } else if (toolName === 'Write' && toolInput) {
    body = <pre style={diffBlockStyle('rgba(46,204,113,0.08)', '#2ecc71')}>{clipLines(toolInput.content)}</pre>
  } else {
    body = <pre style={diffBlockStyle('var(--card)', 'var(--dim)')}>{clipLines(JSON.stringify(toolInput, null, 2))}</pre>
  }
  const filePath = toolInput?.file_path
  return (
    <div style={{ margin: '0 12px 10px', padding: '10px 10px 8px', borderRadius: 'var(--r-md)', border: '1px solid var(--accent)', background: 'var(--card)', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>{toolName}</span>
        {filePath && <span style={{ fontSize: 10.5, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', wordBreak: 'break-all' }}>{filePath}</span>}
      </div>
      {body}
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <button
          onClick={() => onRespond('allow')}
          disabled={responding}
          style={{ flex: 1, padding: '6px 0', borderRadius: 'var(--r-md)', border: 'none', cursor: 'pointer', background: 'var(--accent)', color: 'var(--base)', fontSize: 11, fontWeight: 600, opacity: responding ? 0.6 : 1 }}
        >Accept</button>
        <button
          onClick={() => onRespond('deny')}
          disabled={responding}
          style={{ flex: 1, padding: '6px 0', borderRadius: 'var(--r-md)', border: '1px solid rgba(255,68,68,0.4)', cursor: 'pointer', background: 'rgba(255,68,68,0.1)', color: '#ff6b6b', fontSize: 11, fontWeight: 600, opacity: responding ? 0.6 : 1 }}
        >Reject</button>
      </div>
    </div>
  )
}

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
  // Claude Code can fire several tool calls at once, each with its own hook
  // request — keep them all, answer them one at a time, oldest first.
  const [permissionQueue, setPermissionQueue] = useState([]) // [{requestId, toolName, toolInput}]
  const pendingPermission = permissionQueue[0] || null
  const clearPermissions = () => setPermissionQueue([])
  const [respondingPermission, setRespondingPermission] = useState(false)
  const sessionIdRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    window.api?.ide.claudeCode.check().then(r => { if (!cancelled) setAvailable(!!r?.available) }).catch(() => { if (!cancelled) setAvailable(false) })
    return () => { cancelled = true }
  }, [])

  // Appends to the in-progress assistant bubble, or starts a new one —
  // derived entirely from the previous messages array (no side-channel ref)
  // so this stays correct even if a tool_use block sits between two text
  // blocks in the same turn (the tool_use message becomes `last`, so the
  // next text block correctly starts a fresh bubble instead of being
  // concatenated onto stale leftover text from before the tool call).
  const appendAssistantChunk = useCallback((text) => {
    setMessages(prev => {
      const last = prev[prev.length - 1]
      if (last && last.role === 'assistant' && last.streaming) {
        return [...prev.slice(0, -1), { ...last, text: last.text + text }]
      }
      return [...prev, { role: 'assistant', text, streaming: true }]
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
      clearPermissions()
    })
    const offPermission = window.api?.ide.claudeCode.onPermissionRequest((payload) => {
      if (payload?.projectId !== projectId) return
      setPermissionQueue(q => (q.some(r => r.requestId === payload.requestId) ? q : [...q, payload]))
    })
    return () => { offEvent?.(); offStderr?.(); offDone?.(); offPermission?.() }
  }, [projectId, appendAssistantChunk])

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }) }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text }])
    setSending(true)
    try {
      await window.api.ide.claudeCode.send(projectId, text, sessionIdRef.current, permissionMode)
    } catch (e) {
      setSending(false)
      toast.error('Could not reach Claude Code', e.message)
      setMessages(prev => [...prev, { role: 'error', text: e.message }])
    }
  }

  const respondPermission = async (decision) => {
    if (!pendingPermission || respondingPermission) return
    setRespondingPermission(true)
    try {
      await window.api.ide.claudeCode.respondPermission(pendingPermission.requestId, decision)
      setMessages(prev => [...prev, { role: 'tool', text: `${decision === 'allow' ? 'Accepted' : 'Rejected'}: ${pendingPermission.toolName}`, streaming: false }])
    } catch (e) {
      toast.error('Could not send the decision', e.message)
    } finally {
      setPermissionQueue(q => q.filter(r => r.requestId !== pendingPermission.requestId))
      setRespondingPermission(false)
    }
  }

  const stop = () => {
    window.api?.ide.claudeCode.stop(projectId).catch(() => {})
    setSending(false)
    clearPermissions()
    // The killed process won't emit a `result` event to close out its own
    // streaming bubble (and the backend now deliberately withholds a stale
    // claudecode:done for it too — see claude_cli.rs), so without this a
    // stopped mid-stream bubble would stay marked `streaming: true` forever,
    // which also hides its "Add as Todos" affordance permanently.
    setMessages(prev => {
      const last = prev[prev.length - 1]
      if (last && last.role === 'assistant' && last.streaming) {
        return [...prev.slice(0, -1), { ...last, streaming: false }]
      }
      return prev
    })
  }

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
                <br /><br />
                Open this project's terminal tab first and any Bash command it runs will echo there too.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div className="pm-tab-content" style={{
                  padding: '8px 10px', borderRadius: 'var(--r-md)', fontSize: 12.5, lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word', minWidth: 0,
                  background: m.role === 'user' ? 'var(--accent-dim)' : m.role === 'error' ? 'rgba(255,68,68,0.1)' : m.role === 'tool' ? 'var(--card)' : 'var(--card)',
                  border: `1px solid ${m.role === 'error' ? 'rgba(255,68,68,0.3)' : 'var(--border)'}`,
                  color: m.role === 'error' ? '#ff6b6b' : m.role === 'tool' ? 'var(--dim)' : 'var(--text)',
                  fontFamily: m.role === 'tool' ? 'Geist Mono, monospace' : 'inherit',
                }}>
                  {m.role === 'tool' ? `→ ${m.text}` : m.text}
                </div>
                {m.role === 'assistant' && !m.streaming && (
                  <AddTodosButton items={extractListItems(m.text)} projectId={projectId} />
                )}
              </div>
            ))}
            {sending && !pendingPermission && !(messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.streaming) && (
              <div style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Thinking…</div>
            )}
          </div>

          {pendingPermission && (
            <PermissionRequestCard request={pendingPermission} onRespond={respondPermission} responding={respondingPermission} />
          )}

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
