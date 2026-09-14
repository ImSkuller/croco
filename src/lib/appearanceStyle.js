// "Style" is a second, independent appearance axis alongside Theme (see
// theme.js). Theme picks colours; Style picks the overall look-and-feel —
// shapes, blur, motion, chrome. They compose: e.g. the Futuristic theme's
// cyan accent still applies under the Apple style's frosted-glass chrome.

export const STYLES = [
  {
    id:          'apple',
    label:       'Apple',
    description: 'Liquid-glass: frosted translucent black panels, blur, spring motion. The default.',
    status:      'available',
  },
  {
    id:          'natural',
    label:       'Natural',
    description: 'Calmer and less "AI-generated" — flatter cards, no gradient accents or glow, quieter motion.',
    status:      'available',
  },
]
// 'default' (flat cards, no glass/motion treatment) and 'minimal'
// (Phase 4.4 — near-zero radius, narrower sidebar) were both retired here:
// Apple is now the one true default, and Natural covers the "calmer, flatter"
// use case on its own. normalizeStyleId already falls back any unknown/
// unavailable id to 'apple', so existing users who had either selected land
// on Apple automatically, same as a removed Theme. 'pasta-galaxy' (removed
// earlier, docs/ui-audit.md §6) was a permanent "coming soon" placeholder —
// one line in this file, zero CSS, zero logic anywhere else in the repo.

export function normalizeStyleId(styleId) {
  return STYLES.some(s => s.id === styleId && s.status === 'available') ? styleId : 'apple'
}

const STYLE_CLASS_PREFIX = 'style-'

export function applyStyle(styleId) {
  const html = document.documentElement
  styleId = normalizeStyleId(styleId)
  STYLES.forEach(s => html.classList.remove(`${STYLE_CLASS_PREFIX}${s.id}`))
  html.classList.add(`${STYLE_CLASS_PREFIX}${styleId}`)
}
