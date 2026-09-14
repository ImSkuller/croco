// "Style" is a second, independent appearance axis alongside Theme (see
// theme.js). Theme picks colours; Style picks the overall look-and-feel —
// shapes, blur, motion, chrome. They compose: e.g. the Futuristic theme's
// cyan accent still applies under the Default style's frosted-glass chrome.
import { cacheAppearance } from './appearanceCache'

// The id 'apple' is internal only (matches the `style-apple` CSS class and
// every existing settings.json on disk) — user-facing, this is just
// "Default" now. Deliberately NOT renamed to id 'default': that id used to
// belong to a completely different (flat, non-glass) retired style, and
// reusing it here would silently resurrect the exact naming collision this
// was meant to avoid. normalizeStyleId/applyStyle only ever see the id, so
// nothing downstream needs to know the label changed.
export const STYLES = [
  {
    id:          'apple',
    label:       'Default',
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
// The old 'default' (flat cards, no glass/motion treatment) and 'minimal'
// (Phase 4.4 — near-zero radius, narrower sidebar) styles were both retired
// here: the former Apple style is now the one true default (relabelled
// above), and Natural covers the "calmer, flatter" use case on its own.
// normalizeStyleId already falls back any unknown/unavailable id to
// 'apple', so existing users who had either selected land on the new
// default automatically, same as a removed Theme. 'pasta-galaxy' (removed
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

  cacheAppearance()
}
