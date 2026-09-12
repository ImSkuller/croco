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

// Builds a Monaco theme from the app's own live CSS custom properties
// instead of a hardcoded palette per Croco theme — so the editor always
// matches whatever the user actually has active (theme choice, custom
// accent color) without this file needing to know the specifics of any of
// them. Monaco's theme `colors` map requires real hex values, so this only
// reads the hex-valued vars (never the rgba() ones like --accent-dim).
export function applyCrocoMonacoTheme() {
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
  monaco.editor.setTheme('croco')
}

export default monaco
