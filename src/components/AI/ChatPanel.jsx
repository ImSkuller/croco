import { useState, useEffect, useRef, useCallback } from 'react'
import { useToast } from '../Toast/useToast.js'

function conversationIdFor(mode) {
  const key = `croco:ai:conv:${mode}`
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

const MODE_PLACEHOLDER = {
  chat:     'Ask anything — it remembers what matters across sessions.',
  research: 'Ask something that needs an up-to-date, verified answer.',
  plan:     'Describe what you want to get done.',
  code:     'Ask about this project\'s code, or describe a change.',
}

// One pipeline, reused by all four modes — see ai.rs::ai_chat. History is
// persisted in the Storage Brain (brain/conversations/<id>.json), not kept
// only in this component's state, so it survives a reload and switching
// providers mid-conversation carries no loss (the backend rebuilds context
// from the Brain on every call, never from a provider's own session).
export default function ChatPanel({ mode, provider, projectId }) {
  const toast = useToast()
  const conversationId = conversationIdFor(mode)
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
      const reply = await window.api.ai.chat(mode, provider, projectId || null, conversationId, text)
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
  }, [input, sending, mode, provider, projectId, conversationId, toast])

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {messages === null ? (
          <div style={{ fontSize: 12, color: 'var(--dimmer)' }}>Loading conversation…</div>
        ) : messages.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--dimmer)' }}>{MODE_PLACEHOLDER[mode] || MODE_PLACEHOLDER.chat}</div>
        ) : messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '80%', padding: '10px 14px', borderRadius: 10,
              background: m.role === 'user' ? 'var(--accent-dim)' : 'var(--card)',
              border: `1px solid ${m.role === 'user' ? 'var(--accent)' : 'var(--border)'}`,
              fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.5,
            }}>
              {m.text}
            </div>
          </div>
        ))}
        {sending && <div style={{ fontSize: 12, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Thinking…</div>}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={MODE_PLACEHOLDER[mode] || MODE_PLACEHOLDER.chat}
          rows={2}
          style={{ flex: 1, resize: 'none', background: 'var(--base)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text)', fontFamily: 'Geist, sans-serif', outline: 'none' }}
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          style={{
            padding: '0 18px', borderRadius: 8, border: 'none',
            background: 'var(--accent)', color: '#000', fontSize: 12, fontWeight: 600,
            cursor: (sending || !input.trim()) ? 'not-allowed' : 'pointer',
            opacity: (sending || !input.trim()) ? 0.5 : 1,
            fontFamily: 'Geist, sans-serif',
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}
