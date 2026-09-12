import { useState, useEffect, useRef, useCallback } from 'react'
import { useToast } from '../Toast/useToast.js'

function conversationIdFor(key) {
  const storageKey = `croco:ai:conv:${key}`
  let id = localStorage.getItem(storageKey)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(storageKey, id)
  }
  return id
}

const MODE_PLACEHOLDER = {
  chat:     'Ask anything — it remembers what matters across sessions.',
  research: 'Ask something that needs an up-to-date, verified answer.',
  plan:     'Describe what you want to get done.',
  code:     'Ask about this project\'s code, or describe a change.',
}

// Splits an assistant reply into prose and fenced code blocks so the IDE
// side panel can offer "Insert" / "Replace file" per block. Language tag is
// kept for display only.
const FENCE_RE = /```([\w+-]*)\n([\s\S]*?)```/g
function splitFences(text) {
  const parts = []
  let last = 0
  for (const m of text.matchAll(FENCE_RE)) {
    if (m.index > last) parts.push({ type: 'text', text: text.slice(last, m.index) })
    parts.push({ type: 'code', lang: m[1], code: m[2].replace(/\n$/, '') })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ type: 'text', text: text.slice(last) })
  return parts
}

// One pipeline, reused by all four modes — see ai.rs::ai_chat. History is
// persisted in the Storage Brain (brain/conversations/<id>.json), not kept
// only in this component's state, so it survives a reload and switching
// providers mid-conversation carries no loss (the backend rebuilds context
// from the Brain on every call, never from a provider's own session).
//
// `conversationKey` defaults to the mode (one conversation per mode on the
// AI page); the IDE passes a per-file key so each file has its own thread.
// `fileContext` is a function returning the current editor contents — sent
// with every call, never stored. `onApplyCode(code, how)` turns fenced code
// blocks into Insert / Replace buttons; `how` is 'insert' | 'replace'.
export default function ChatPanel({ mode, provider, projectId, conversationKey, fileContext, onApplyCode, compact = false }) {
  const toast = useToast()
  const conversationId = conversationIdFor(conversationKey || mode)
  // Keyed by conversationId so a mode switch derives "still loading" as
  // loaded.conversationId !== conversationId, instead of a synchronous
  // setMessages(null) reset at the top of the effect.
  const [loaded, setLoaded] = useState({ conversationId: null, messages: [] })
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)
  const messages = loaded.conversationId === conversationId ? loaded.messages : null

  useEffect(() => {
    let cancelled = false
    window.api?.ai?.brain.conversationGet(conversationId)
      .then(msgs => { if (!cancelled) setLoaded({ conversationId, messages: msgs || [] }) })
      .catch(() => { if (!cancelled) setLoaded({ conversationId, messages: [] }) })
    return () => { cancelled = true }
  }, [conversationId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, sending])

  // Appends onto the current conversation's message list, tolerating the
  // rare case where conversationId already moved on from under an in-flight
  // send (mode switched mid-request) by starting fresh rather than mixing
  // messages from two different conversations.
  const appendMessages = (more) => setLoaded(prev => ({
    conversationId,
    messages: [...(prev.conversationId === conversationId ? prev.messages : []), ...more],
  }))

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || sending || !window.api?.ai) return
    setInput('')
    setSending(true)
    appendMessages([{ role: 'user', text, at: new Date().toISOString() }])
    try {
      const ctx = typeof fileContext === 'function' ? fileContext() : (fileContext || null)
      const reply = await window.api.ai.chat(mode, provider, projectId || null, conversationId, text, ctx)
      appendMessages([{ role: 'assistant', text: reply, at: new Date().toISOString() }])
    } catch (e) {
      toast.error('AI request failed', e.message || String(e))
      setLoaded(prev => ({
        conversationId,
        // Roll back the optimistic user message that never got a reply.
        messages: (prev.conversationId === conversationId ? prev.messages : []).slice(0, -1),
      }))
      setInput(text)
    } finally {
      setSending(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, sending, mode, provider, projectId, conversationId, toast, fileContext])

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const pad = compact ? '12px 12px' : '20px 24px'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: pad, display: 'flex', flexDirection: 'column', gap: compact ? 10 : 14 }}>
        {messages === null ? (
          <div style={{ fontSize: 12, color: 'var(--dimmer)' }}>Loading conversation…</div>
        ) : messages.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--dimmer)' }}>{MODE_PLACEHOLDER[mode] || MODE_PLACEHOLDER.chat}</div>
        ) : messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: compact ? '95%' : '80%', padding: '10px 14px', borderRadius: 'var(--r-lg)',
              background: m.role === 'user' ? 'var(--accent-dim)' : 'var(--card)',
              border: `1px solid ${m.role === 'user' ? 'var(--accent)' : 'var(--border)'}`,
              backdropFilter: 'var(--panel-blur)', WebkitBackdropFilter: 'var(--panel-blur)',
              fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.5, minWidth: 0,
            }}>
              {m.role === 'assistant' && onApplyCode
                ? splitFences(m.text).map((p, j) => p.type === 'text'
                  ? <span key={j}>{p.text}</span>
                  : <CodeBlock key={j} part={p} onApply={onApplyCode} />)
                : m.text}
            </div>
          </div>
        ))}
        {sending && <div style={{ fontSize: 12, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Thinking…</div>}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: compact ? '10px 12px' : '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={MODE_PLACEHOLDER[mode] || MODE_PLACEHOLDER.chat}
          rows={2}
          style={{ flex: 1, resize: 'none', background: 'var(--base)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '9px 12px', fontSize: 13, color: 'var(--text)', fontFamily: 'Geist, sans-serif', outline: 'none', transition: 'border-color var(--transition-fast)', minWidth: 0 }}
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          style={{
            padding: '0 18px', borderRadius: 'var(--r-md)', border: 'none',
            background: 'var(--accent)', color: 'var(--accent-text)', fontSize: 12, fontWeight: 600,
            cursor: (sending || !input.trim()) ? 'not-allowed' : 'pointer',
            opacity: (sending || !input.trim()) ? 0.5 : 1,
            fontFamily: 'Geist, sans-serif', transition: 'opacity var(--transition-fast)',
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}

function CodeBlock({ part, onApply }) {
  const btn = {
    padding: '3px 9px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
    background: 'transparent', color: 'var(--dim)', fontSize: 10, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'Geist, sans-serif', transition: 'all var(--transition-fast)',
  }
  return (
    <div style={{ margin: '8px 0', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--base)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', flex: 1 }}>{part.lang || 'code'}</span>
        <button style={btn} onClick={() => onApply(part.code, 'insert')} title="Insert at cursor">Insert</button>
        <button style={btn} onClick={() => onApply(part.code, 'replace')} title="Replace the whole file">Replace file</button>
      </div>
      <pre style={{ margin: 0, padding: '8px 10px', fontSize: 12, fontFamily: 'Geist Mono, monospace', overflowX: 'auto', whiteSpace: 'pre', color: 'var(--text)' }}>{part.code}</pre>
    </div>
  )
}
