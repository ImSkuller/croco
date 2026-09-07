// "Style" is a second, independent appearance axis alongside Theme (see
// theme.js). Theme picks colours; Style picks the overall look-and-feel —
// shapes, blur, motion, chrome. They compose: e.g. the Futuristic theme's
// cyan accent still applies under the Apple style's frosted-glass chrome.

export const STYLES = [
  {
    id:          'default',
    label:       'Default',
    description: 'The current Croco look — flat cards, minimal chrome.',
    status:      'available',
  },
  {
    id:          'apple',
    label:       'Apple',
    description: 'Liquid-glass: frosted translucent black panels, blur, spring motion.',
    status:      'available',
  },
  {
    id:          'natural',
    label:       'Natural',
    description: 'Calmer and less "AI-generated" — flatter cards, no gradient accents or glow, quieter motion.',
    status:      'available',
  },
]
// 'pasta-galaxy' (removed in the Phase 4 UI rearchitecture, docs/ui-audit.md
// §6) was a permanent "coming soon" placeholder — one line in this file,
// zero CSS, zero logic anywhere else in the repo. normalizeStyleId already
// falls back any unknown/unavailable id to 'default', so existing users who
// had it selected land on Default automatically, same as a removed Theme.

export function normalizeStyleId(styleId) {
  return STYLES.some(s => s.id === styleId && s.status === 'available') ? styleId : 'default'
}

const STYLE_CLASS_PREFIX = 'style-'

export function applyStyle(styleId) {
  const html = document.documentElement
  styleId = normalizeStyleId(styleId)
  STYLES.forEach(s => html.classList.remove(`${STYLE_CLASS_PREFIX}${s.id}`))
  if (styleId !== 'default') html.classList.add(`${STYLE_CLASS_PREFIX}${styleId}`)
}
