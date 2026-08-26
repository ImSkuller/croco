export const THEMES = [
  { id: 'default',                    label: 'Default',              dark: true  },
  { id: 'theme-catppuccin-latte',     label: 'Catppuccin Latte',     dark: false },
  { id: 'theme-catppuccin-frappe',    label: 'Catppuccin Frappé',    dark: true  },
  { id: 'theme-catppuccin-macchiato', label: 'Catppuccin Macchiato', dark: true  },
  { id: 'theme-catppuccin-mocha',     label: 'Catppuccin Mocha',     dark: true  },
  { id: 'theme-neovim',               label: 'NeoVim Dark',          dark: true  },
  { id: 'theme-vim',                  label: 'Vim Classic',          dark: true  },
  { id: 'theme-futuristic',           label: 'Futuristic',           dark: true  },
]

// Themes removed in the 1.6 minimal redesign still linger in saved settings;
// anything unknown falls back to the default theme.
export function normalizeThemeId(themeId) {
  return THEMES.some(t => t.id === themeId) ? themeId : 'default'
}

export function applyTheme(themeId, glass = false, overrides = {}) {
  const html = document.documentElement
  themeId = normalizeThemeId(themeId)
  THEMES.forEach(t => { if (t.id !== 'default') html.classList.remove(t.id) })
  if (themeId && themeId !== 'default') html.classList.add(themeId)
  glass ? html.classList.add('glass') : html.classList.remove('glass')

  const { accentColor, fontBody, fontDisplay, logoBg } = overrides
  if (accentColor) {
    html.style.setProperty('--accent', accentColor)
    html.style.setProperty('--orange', accentColor)
    if (accentColor.startsWith('#') && accentColor.length === 7) {
      const r = parseInt(accentColor.slice(1, 3), 16)
      const g = parseInt(accentColor.slice(3, 5), 16)
      const b = parseInt(accentColor.slice(5, 7), 16)
      html.style.setProperty('--accent-dim',  `rgba(${r},${g},${b},0.12)`)
      html.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.25)`)
    }
  }
  if (fontBody) html.style.setProperty('--font-body', `'${fontBody}', sans-serif`)
  if (fontDisplay) {
    html.style.setProperty(
      '--font-display',
      fontDisplay === 'inherit' ? 'var(--font-body)' : `'${fontDisplay}', serif`
    )
  }
  if (logoBg) html.style.setProperty('--logo-bg', logoBg)
}

export function getThemeAccentSwatch(themeId) {
  // Returns a representative color pair [bg, accent] for the theme picker swatch
  const map = {
    'default':                    ['#0a0a0a', '#e8e4dc'],
    'theme-catppuccin-latte':     ['#eff1f5', '#8839ef'],
    'theme-catppuccin-frappe':    ['#303446', '#ca9ee6'],
    'theme-catppuccin-macchiato': ['#24273a', '#c6a0f6'],
    'theme-catppuccin-mocha':     ['#1e1e2e', '#cba6f7'],
    'theme-neovim':               ['#1a1b26', '#73daca'],
    'theme-vim':                  ['#1c1c1c', '#5faf5f'],
    'theme-futuristic':           ['#050914', '#00f0ff'],
  }
  return map[themeId] || ['#0a0a0a', '#e8e4dc']
}
