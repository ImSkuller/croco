import { useEffect } from 'react'

function match(e, combo) {
  const inInput = ['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable
  const parts   = combo.toLowerCase().split('+')
  const key     = parts[parts.length - 1]
  const ctrl    = parts.includes('ctrl')
  const shift   = parts.includes('shift')

  if ((e.ctrlKey || e.metaKey) !== ctrl) return false
  if (e.shiftKey !== shift) return false
  // In inputs, only allow ctrl combos and Escape
  if (inInput && !ctrl && key !== 'escape') return false

  return e.key.toLowerCase() === key
}

export function useKeyboard(bindings) {
  useEffect(() => {
    const handler = (e) => {
      for (const [combo, fn] of Object.entries(bindings)) {
        if (match(e, combo)) { e.preventDefault(); fn(e); return }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })
}
