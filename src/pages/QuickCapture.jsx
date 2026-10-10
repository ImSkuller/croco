import { useState, useRef, useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { emit } from '@tauri-apps/api/event'

// The popup window the global quick-capture hotkey (Ctrl+Shift+Space,
// not yet user-remappable — see main.rs::setup_app) opens. Deliberately
// tiny: one text field, Enter to save, Escape to cancel — the whole
// point is capturing a thought without breaking whatever you were doing,
// not a full todo/note editor (open the real app for that).
export default function QuickCapture() {
  const [type, setType] = useState('todo') // 'todo' | 'note'
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => { textareaRef.current?.focus() }, [])

  const close = () => { getCurrentWindow().close().catch(() => {}) }

  const save = () => {
    const trimmed = text.trim()
    if (!trimmed || !window.api || saving) return
    setSaving(true)
    const action = type === 'todo'
      ? window.api.todos.create({ title: trimmed })
      : (() => {
          // First line is the title, same split the drag-and-drop .md
          // import already uses elsewhere (Notes.jsx) — familiar
          // behavior rather than a new convention.
          const lines = trimmed.split('\n')
          const title = lines[0].trim() || 'Untitled'
          const content = lines.slice(1).join('\n').trim()
          return window.api.notes.create({ title, content, tags: [], starred: false })
        })()
    action
      .then(() => {
        // Cross-window — this popup and the main window are separate JS
        // realms, so a plain DOM CustomEvent (what every in-window
        // mutation elsewhere uses) would only reach this soon-to-close
        // window's own listeners. See lib/store.js's matching listener.
        emit('croco:cross-window-data-changed').catch(() => {})
        close()
      })
      .catch(() => setSaving(false))
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { close(); return }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
  }

  return (
    <div
      onKeyDown={onKeyDown}
      style={{
        display: 'flex', flexDirection: 'column', height: '100vh', padding: 14, gap: 10,
        background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Geist, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', gap: 4 }}>
        {['todo', 'note'].map(t => (
          <button
            key={t}
            onClick={() => setType(t)}
            style={{
              padding: '4px 10px', borderRadius: 'var(--r-md)', border: 'none', cursor: 'pointer',
              fontSize: 12, fontFamily: 'Geist, sans-serif', textTransform: 'capitalize',
              background: type === t ? 'var(--accent)' : 'var(--card)',
              color: type === t ? 'var(--accent-text, #000)' : 'var(--dim)',
            }}
          >
            {t}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--dimmer)', alignSelf: 'center' }}>
          Enter to save · Esc to cancel
        </div>
      </div>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={type === 'todo' ? 'What needs doing?' : "Quick note — first line is the title, Shift+Enter for more"}
        style={{
          flex: 1, resize: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
          padding: 10, background: 'var(--card)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13,
          outline: 'none',
        }}
      />
    </div>
  )
}
