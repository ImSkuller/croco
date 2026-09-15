// Self-hosts Monaco entirely from the local `monaco-editor` package instead
// of @monaco-editor/react's default behavior (fetching Monaco's assets from
// a CDN at runtime) — a desktop app with a "local-first, works offline"
// principle can't have a core editing feature silently require internet on
// first use. Imported once, lazily, only from CodeEditor.jsx (itself
// dynamically imported) so none of this — nor monaco-editor's several MB —
// ends up in the app's main bundle for users who never enable the IDE
// module.
import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'

// Deliberately no custom MonacoEnvironment.getWorker wiring here — this
// package's `exports` map doesn't resolve cleanly through the bundler's
// `?worker` import syntax (rolldown-vite fails to resolve the worker
// subpaths), and this is a lightweight editor, not a full IDE, so running
// without dedicated language-service workers is an acceptable trade-off:
// Monaco falls back to running tokenization/basic language features on the
// main thread (a one-time console warning, not a crash). The part that
// actually matters for local-first — the editor core itself never being
// fetched from a CDN — is what `loader.config` below fixes.
loader.config({ monaco })

// ─── Catppuccin Mocha (MIT-licensed color palette — https://catppuccin.com)
// A real ported syntax-highlighting *token* theme, not just re-themed
// editor chrome — this is the IDE module's default (see
// settings.modules.ide.editor.colorTheme) regardless of which app-wide
// Croco theme/accent is active, the same way every real code editor treats
// its own syntax theme as an independent choice from the rest of its UI
// chrome. Hex values and the semantic token mapping below both come from
// Catppuccin's own published palette/theme conventions.
const MOCHA = {
  rosewater: '#f5e0dc', flamingo: '#f2cdcd', pink: '#f5c2e7', mauve: '#cba6f7',
  red: '#f38ba8', maroon: '#eba0ac', peach: '#fab387', yellow: '#f9e2af',
  green: '#a6e3a1', teal: '#94e2d5', sky: '#89dceb', sapphire: '#74c7ec',
  blue: '#89b4fa', lavender: '#b4befe', text: '#cdd6f4', subtext1: '#bac2de',
  subtext0: '#a6adc8', overlay2: '#9399b2', overlay1: '#7f849c', overlay0: '#6c7086',
  surface2: '#585b70', surface1: '#45475a', surface0: '#313244',
  base: '#1e1e2e', mantle: '#181825', crust: '#11111b',
}

let themesDefined = false
function defineStaticThemes() {
  if (themesDefined) return
  themesDefined = true

  monaco.editor.defineTheme('catppuccin-mocha', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment',            foreground: MOCHA.overlay2.slice(1), fontStyle: 'italic' },
      { token: 'string',             foreground: MOCHA.green.slice(1) },
      { token: 'string.regexp',      foreground: MOCHA.pink.slice(1) },
      { token: 'regexp',             foreground: MOCHA.pink.slice(1) },
      { token: 'number',             foreground: MOCHA.peach.slice(1) },
      { token: 'number.hex',         foreground: MOCHA.peach.slice(1) },
      { token: 'constant',           foreground: MOCHA.peach.slice(1) },
      { token: 'keyword',            foreground: MOCHA.mauve.slice(1) },
      { token: 'keyword.control',    foreground: MOCHA.mauve.slice(1) },
      { token: 'keyword.operator',   foreground: MOCHA.sky.slice(1) },
      { token: 'operator',           foreground: MOCHA.sky.slice(1) },
      { token: 'storage',            foreground: MOCHA.mauve.slice(1) },
      { token: 'type',               foreground: MOCHA.yellow.slice(1) },
      { token: 'type.identifier',    foreground: MOCHA.yellow.slice(1) },
      { token: 'class',              foreground: MOCHA.yellow.slice(1) },
      { token: 'interface',          foreground: MOCHA.yellow.slice(1) },
      { token: 'namespace',          foreground: MOCHA.yellow.slice(1) },
      { token: 'function',           foreground: MOCHA.blue.slice(1) },
      { token: 'function.call',      foreground: MOCHA.blue.slice(1) },
      { token: 'support.function',   foreground: MOCHA.sapphire.slice(1) },
      { token: 'variable',           foreground: MOCHA.text.slice(1) },
      { token: 'variable.parameter', foreground: MOCHA.maroon.slice(1) },
      { token: 'variable.predefined',foreground: MOCHA.red.slice(1) },
      { token: 'identifier',         foreground: MOCHA.text.slice(1) },
      { token: 'tag',                foreground: MOCHA.blue.slice(1) },
      { token: 'attribute.name',     foreground: MOCHA.yellow.slice(1) },
      { token: 'attribute.value',    foreground: MOCHA.green.slice(1) },
      { token: 'delimiter',          foreground: MOCHA.overlay2.slice(1) },
      { token: 'delimiter.bracket',  foreground: MOCHA.overlay2.slice(1) },
      { token: 'annotation',         foreground: MOCHA.yellow.slice(1) },
      { token: 'meta.decorator',     foreground: MOCHA.yellow.slice(1) },
    ],
    colors: {
      'editor.background':                 MOCHA.base,
      'editor.foreground':                 MOCHA.text,
      'editorLineNumber.foreground':       MOCHA.surface2,
      'editorLineNumber.activeForeground': MOCHA.overlay1,
      'editorCursor.foreground':           MOCHA.rosewater,
      'editor.selectionBackground':        MOCHA.surface1 + 'aa',
      'editor.lineHighlightBackground':    MOCHA.surface0 + '80',
      'editorIndentGuide.background':      MOCHA.surface0,
      'editorIndentGuide.activeBackground':MOCHA.surface1,
      'editorGutter.background':           MOCHA.base,
      'editorWidget.background':           MOCHA.mantle,
      'editorWidget.border':               MOCHA.surface0,
      'editorSuggestWidget.background':    MOCHA.mantle,
      'editorSuggestWidget.border':        MOCHA.surface0,
      'editorSuggestWidget.selectedBackground': MOCHA.surface0,
      'scrollbarSlider.background':        MOCHA.surface1 + '80',
      'scrollbarSlider.hoverBackground':   MOCHA.surface2 + '90',
    },
  })
}

// Builds the 'croco' Monaco theme from the app's own live CSS custom
// properties instead of a hardcoded palette per Croco theme — so it always
// matches whatever the user has active (theme choice, custom accent color)
// without this file needing to know the specifics of any of them. Monaco's
// theme `colors` map requires real hex values, so this only reads the
// hex-valued vars (never the rgba() ones like --accent-dim). Kept as the
// non-default alternative to catppuccin-mocha (see colorTheme setting) for
// anyone who'd rather the editor visually match the rest of the app.
function defineCrocoTheme() {
  const css = getComputedStyle(document.documentElement)
  const hex = (name, fallback) => {
    const v = css.getPropertyValue(name).trim()
    return /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : fallback
  }
  monaco.editor.defineTheme('croco', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background':               hex('--base', '#0a0a0a'),
      'editor.foreground':                hex('--text', '#e8e4dc'),
      'editorLineNumber.foreground':      hex('--dimmer', '#555555'),
      'editorLineNumber.activeForeground':hex('--dim', '#999999'),
      'editorCursor.foreground':          hex('--accent', '#e8e4dc'),
      'editorGutter.background':          hex('--base', '#0a0a0a'),
      'editorWidget.background':          hex('--card', '#111111'),
      'editorWidget.border':              hex('--border', '#222222'),
      'editorSuggestWidget.background':   hex('--card', '#111111'),
      'editorSuggestWidget.border':       hex('--border', '#222222'),
    },
  })
}

// Back-compat export — still called on mount/settings-change by
// CodeEditor.jsx for the 'croco' variant specifically.
export function applyCrocoMonacoTheme() {
  defineCrocoTheme()
  monaco.editor.setTheme('croco')
}

// Switches the editor's syntax theme. 'catppuccin-mocha' is static (defined
// once, lazily, the first time it's needed) since it doesn't depend on
// anything about the live app theme; 'croco' is rebuilt from current CSS
// vars every time so it always tracks the app's active theme/accent.
export function setMonacoColorTheme(variant) {
  if (variant === 'croco') {
    applyCrocoMonacoTheme()
    return
  }
  defineStaticThemes()
  monaco.editor.setTheme('catppuccin-mocha')
}

export default monaco
