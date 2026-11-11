import { useState, useEffect, useRef } from 'react'
import { SHORTCUT_DEFS } from '../../lib/shortcuts'
import ShortcutsSection from './ShortcutsSection'

// Owns the shortcut overrides and the "press the new keys" capture listener.
export default function ShortcutsTab({ settings }) {
  const [shortcutOverrides, setShortcutOverrides] = useState(settings.app?.shortcuts || {})
  const [capturingId, setCapturingId] = useState(null)
  const shortcutOverridesRef = useRef(shortcutOverrides)
  useEffect(() => { shortcutOverridesRef.current = shortcutOverrides }, [shortcutOverrides])

  useEffect(() => {
    if (!capturingId) return
    const def = SHORTCUT_DEFS.find(d => d.id === capturingId)
    if (!def) return
    const handler = (e) => {
      if (e.key === 'Escape') { setCapturingId(null); return }
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return
      e.preventDefault(); e.stopPropagation()
      let key
      if (def.chord) {
        if (e.key.length > 1) return
        key = `g+${e.key.toLowerCase()}`
      } else {
        const parts = []
        if (e.ctrlKey || e.metaKey) parts.push('ctrl')
        if (e.shiftKey) parts.push('shift')
        parts.push(e.key.toLowerCase())
        key = parts.join('+')
      }
      const next = { ...shortcutOverridesRef.current, [capturingId]: key }
      setShortcutOverrides(next)
      window.api?.settings.update({ app: { shortcuts: next } }).catch(() => {})
      window.dispatchEvent(new Event('croco:shortcuts-changed'))
      setCapturingId(null)
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [capturingId])

  return (
    <ShortcutsSection
      capturingId={capturingId} setCapturingId={setCapturingId}
      shortcutOverrides={shortcutOverrides} setShortcutOverrides={setShortcutOverrides}
    />
  )
}
