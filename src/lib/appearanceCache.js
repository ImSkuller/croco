// Caches the fully-resolved appearance (theme + style classes, plus the
// accent/font CSS custom properties applyTheme sets inline) to localStorage
// so the next launch can repaint it synchronously — see the inline
// <script> at the top of index.html's <head>, which reads this cache and
// applies it before React even mounts. Without this, every launch showed
// a flash of the default/wrong-theme look for the window between first
// paint and the async settings.get() round-trip resolving in App.jsx.
//
// applyTheme (theme.js) and applyStyle (appearanceStyle.js) both call this
// after they finish — whichever ran most recently wins, which is correct
// since it snapshots the full current state each time, not just its own
// slice of it.
const KEY = 'croco:appearance-cache'
const TRACKED_VARS = ['--accent', '--orange', '--accent-dim', '--accent-glow', '--font-body', '--font-display', '--logo-bg']

export function cacheAppearance() {
  try {
    const html = document.documentElement
    const vars = {}
    for (const k of TRACKED_VARS) {
      const v = html.style.getPropertyValue(k)
      if (v) vars[k] = v
    }
    localStorage.setItem(KEY, JSON.stringify({ className: html.className, vars }))
  } catch {
    // Private window / storage disabled — falls back to the old behavior
    // (repaint after settings load) instead of pre-paint. Never worth
    // surfacing to the user over.
  }
}
