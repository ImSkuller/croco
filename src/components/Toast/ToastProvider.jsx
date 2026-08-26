import { useState, useEffect, useCallback } from 'react'
import { ToastContext } from './useToast.js'

let _id = 0

const TYPE_STYLE = {
  success: { border: '#4aff91', icon: '✓', bg: 'rgba(74,255,145,0.06)' },
  error:   { border: '#ff4444', icon: '✕', bg: 'rgba(255,68,68,0.06)'  },
  warning: { border: '#ffd700', icon: '⚠', bg: 'rgba(255,215,0,0.06)'  },
  info:    { border: '#4a9eff', icon: 'i', bg: 'rgba(74,158,255,0.06)' },
}

const DURATION = { success: 3500, error: 6000, warning: 5000, info: 3500 }

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 260)
  }, [])

  const addToast = useCallback(({ title, body, type = 'info' }) => {
    const id = ++_id
    setToasts(prev => [...prev.slice(-4), { id, title, body, type, leaving: false }])
    setTimeout(() => dismiss(id), DURATION[type] ?? 4000)
    return id
  }, [dismiss])

  const api = {
    success: (title, body) => addToast({ title, body, type: 'success' }),
    error:   (title, body) => addToast({ title, body, type: 'error'   }),
    warning: (title, body) => addToast({ title, body, type: 'warning' }),
    info:    (title, body) => addToast({ title, body, type: 'info'    }),
    dismiss,
  }

  // Subscribe to toasts pushed from the main process
  useEffect(() => {
    if (!window.api?.notify?.onToast) return
    const unsub = window.api.notify.onToast(({ title, body, type }) => addToast({ title, body, type }))
    return unsub
  }, [addToast])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function ToastStack({ toasts, onDismiss }) {
  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20,
      zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function Toast({ toast, onDismiss }) {
  const { id, title, body, type, leaving } = toast
  const s = TYPE_STYLE[type] || TYPE_STYLE.info

  return (
    <div
      style={{
        minWidth: 260, maxWidth: 360, pointerEvents: 'all',
        background: 'var(--surface, #1a1a1a)',
        border: '1px solid var(--border, #242424)',
        borderLeft: `3px solid ${s.border}`,
        borderRadius: 10,
        padding: '11px 14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-start', gap: 10,
        animation: leaving
          ? 'toastOut 0.25s cubic-bezier(0.4,0,1,1) forwards'
          : 'toastIn 0.25s cubic-bezier(0.16,1,0.3,1) both',
        backgroundColor: s.bg,
      }}
    >
      <span style={{
        width: 18, height: 18, borderRadius: 4,
        background: s.border + '22',
        color: s.border,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1,
        fontFamily: 'Geist Mono, monospace',
      }}>
        {s.icon}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text, #f0f0f0)', lineHeight: 1.3 }}>
          {title}
        </div>
        {body && (
          <div style={{ fontSize: 11, color: 'var(--dimmer, #666)', marginTop: 2, lineHeight: 1.4, fontFamily: 'Geist Mono, monospace', wordBreak: 'break-all' }}>
            {body}
          </div>
        )}
      </div>

      <button
        onClick={() => onDismiss(id)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--dimmer, #555)', fontSize: 14, lineHeight: 1,
          padding: '0 0 0 4px', flexShrink: 0, marginTop: -1,
        }}
      >
        ×
      </button>

      <style>{`
        @keyframes toastIn  { from { opacity: 0; transform: translateX(20px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes toastOut { from { opacity: 1; transform: translateX(0)    } to { opacity: 0; transform: translateX(20px) } }
      `}</style>
    </div>
  )
}
