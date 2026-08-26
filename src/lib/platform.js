// OS-aware keyboard glyphs. navigator.platform/userAgent are available synchronously
// at module load in the Tauri webview, so this is a one-time computed constant.
export const isMac = typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPod|iPad/.test(navigator.platform || navigator.userAgent || '')

export function formatKeyToken(token) {
  switch (token) {
    case 'Mod':   return isMac ? '⌘' : 'Ctrl'
    case 'Alt':   return isMac ? '⌥' : 'Alt'
    case 'Shift': return isMac ? '⇧' : 'Shift'
    default:      return token
  }
}

export function modLabel() {
  return isMac ? '⌘' : 'Ctrl'
}

// A compact "shortcut hint" string, e.g. modKeyHint('K') → "⌘K" on macOS,
// "Ctrl+K" elsewhere — Ctrl reads as a run-on word without the separator.
export function modKeyHint(key) {
  return isMac ? `${modLabel()}${key}` : `${modLabel()}+${key}`
}
