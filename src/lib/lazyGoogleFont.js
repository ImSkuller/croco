// Lazy-loads one of the *opt-in* Settings font-picker choices from Google
// Fonts, on demand, instead of the old blocking @import that pulled all 12
// picker fonts on every cold start regardless of selection. The 3 shipped
// defaults (Geist, Geist Mono, Lora) are self-hosted in index.css and never
// go through this path.
//
// Called from two places: theme.js::applyTheme whenever a saved
// fontBody/fontDisplay override needs to actually render (covers every
// launch for a user who picked a non-default font), and Settings' font
// picker on mount (so the preview swatches render in their real face
// instead of the fallback while browsing).

const loaded = new Set(['Geist', 'Geist Mono', 'Lora', 'inherit'])

const GOOGLE_FONTS_SPEC = {
  'Inter':           'Inter:wght@300;400;500;600;700',
  'IBM Plex Sans':   'IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400',
  'Nunito':          'Nunito:wght@300;400;500;600;700',
  'DM Sans':         'DM+Sans:wght@300;400;500;600;700',
  'Space Grotesk':   'Space+Grotesk:wght@300;400;500;600;700',
  'Manrope':         'Manrope:wght@300;400;500;600;700',
  'Playfair Display': 'Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400',
}

/** Injects a <link> for `family` the first time it's needed; no-ops after that (or for a default/unknown family). */
export function lazyLoadGoogleFont(family) {
  if (!family || loaded.has(family)) return
  const spec = GOOGLE_FONTS_SPEC[family]
  if (!spec) return
  loaded.add(family)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`
  document.head.appendChild(link)
}

/** Loads every opt-in picker font at once — used by the Settings font pickers so preview swatches render correctly while browsing. */
export function lazyLoadAllPickerFonts() {
  Object.keys(GOOGLE_FONTS_SPEC).forEach(lazyLoadGoogleFont)
}
