import { useState, useEffect, useCallback, useRef } from 'react'
import Editor from '@monaco-editor/react'
import { applyCrocoMonacoTheme } from '../../lib/monacoSetup' // self-hosts Monaco locally instead of the default CDN loader — see that file
import { FolderIcon, FolderOpenIcon, FileIcon, SaveIcon } from '../../constants/SimpleSvgExports'
import { useToast } from '../Toast/useToast.js'
import { useData } from '../../lib/store'
import useDiscordPresence from '../../hooks/useDiscordPresence'

const DEFAULT_EDITOR_PREFS = {
  fontSize: 13, tabSize: 2, insertSpaces: true, wordWrap: 'off',
  minimap: false, lineNumbers: 'on', renderWhitespace: 'none',
  cursorBlinking: 'blink', formatOnSave: false,
}

const LANG_BY_EXT = {
  '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.ts': 'typescript', '.tsx': 'typescript',
  '.json': 'json', '.md': 'markdown', '.mdx': 'markdown',
  '.rs': 'rust', '.py': 'python', '.go': 'go', '.java': 'java',
  '.c': 'c', '.h': 'c', '.cpp': 'cpp', '.hpp': 'cpp', '.cs': 'csharp',
  '.html': 'html', '.css': 'css', '.scss': 'scss', '.less': 'less',
  '.yml': 'yaml', '.yaml': 'yaml', '.toml': 'ini', '.xml': 'xml',
  '.sh': 'shell', '.sql': 'sql', '.php': 'php', '.rb': 'ruby',
}
function langForExt(ext) { return LANG_BY_EXT[ext] || 'plaintext' }

function TreeNode({ node, depth, openPath, onOpenFile, expanded, toggleExpanded }) {
  if (node.type === 'dir') {
    if (node.ignored) return null
    const isOpen = !!expanded[node.rel]
    return (
      <div>
        <div
          onClick={() => toggleExpanded(node.rel)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            padding: '3px 8px', paddingLeft: 8 + depth * 14,
            fontSize: 12, color: 'var(--dim)', userSelect: 'none',
          }}
        >
          <span style={{ display: 'flex', flexShrink: 0, color: 'var(--dimmer)' }}>
            {isOpen ? <FolderOpenIcon size={13} /> : <FolderIcon size={13} />}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
        </div>
        {isOpen && node.children?.map(child => (
          <TreeNode key={child.rel} node={child} depth={depth + 1} openPath={openPath} onOpenFile={onOpenFile} expanded={expanded} toggleExpanded={toggleExpanded} />
        ))}
      </div>
    )
  }
  const active = node.rel === openPath
  return (
    <div
      onClick={() => onOpenFile(node)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
        padding: '3px 8px', paddingLeft: 8 + depth * 14,
        fontSize: 12, color: active ? 'var(--text)' : 'var(--dim)',
        background: active ? 'var(--accent-dim)' : 'transparent',
        borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
        userSelect: 'none',
      }}
    >
      <span style={{ display: 'flex', flexShrink: 0, color: 'var(--dimmer)' }}><FileIcon size={13} /></span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
    </div>
  )
}

// Embedded lightweight editor (Monaco — the engine VS Code itself is built
// on), not real VS Code — no extensions, no debugger. Shared between the
// standalone /ide page and ProjectDetail's "Code" tab.
export default function CodeEditor({ projectId, projectName }) {
  const toast = useToast()
  const settings = useData('settings')
  const [tree, setTree] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [tabs, setTabs] = useState([]) // [{ rel, name, ext, content, savedContent, dirty }]
  const [activeRel, setActiveRel] = useState(null)
  const [loadingTree, setLoadingTree] = useState(true)
  const tabsRef = useRef(tabs)
  useEffect(() => { tabsRef.current = tabs }, [tabs])

  const prefs = { ...DEFAULT_EDITOR_PREFS, ...(settings?.modules?.ide?.editor || {}) }

  // Re-theme whenever the app's own theme/accent changes, not just once on
  // mount — matches the rest of the UI updating live from Settings.
  useEffect(() => {
    applyCrocoMonacoTheme()
  }, [settings?.appearance?.theme, settings?.appearance?.accentColor, settings?.appearance?.glass])

  // Callers key this component by projectId (see IDE.jsx / ProjectDetail.jsx)
  // so a project switch remounts fresh — tree/tabs/activeRel all start at
  // their initial values automatically, no manual reset needed here.
  useEffect(() => {
    if (!projectId || !window.api) return
    window.api.projects.getFileTree(projectId)
      .then(setTree)
      .catch(() => setTree([]))
      .finally(() => setLoadingTree(false))
  }, [projectId])

  const toggleExpanded = useCallback((rel) => {
    setExpanded(prev => ({ ...prev, [rel]: !prev[rel] }))
  }, [])

  const openFile = useCallback(async (node) => {
    setActiveRel(node.rel)
    if (tabsRef.current.some(t => t.rel === node.rel)) return
    try {
      const content = await window.api.ide.readFile(projectId, node.rel)
      setTabs(prev => [...prev, { rel: node.rel, name: node.name, ext: node.ext, content, savedContent: content, dirty: false }])
    } catch (e) {
      toast.error('Could not open file', e.message)
    }
  }, [projectId, toast])

  const activeTab = tabs.find(t => t.rel === activeRel) || null

  // Discord Rich Presence — overrides whatever the parent page (IDE.jsx or
  // ProjectDetail) set, since this fires after them on mount/update. Only
  // takes over once a file is actually open; otherwise the parent's more
  // generic "Using the IDE" / "Editing <project>" context stands.
  useDiscordPresence(
    activeTab ? `Editing ${activeTab.name}` : null,
    projectName ? `in ${projectName}` : null
  )

  const handleChange = (value) => {
    if (!activeRel) return
    setTabs(prev => prev.map(t => t.rel === activeRel ? { ...t, content: value ?? '', dirty: (value ?? '') !== t.savedContent } : t))
  }

  const editorRef = useRef(null)

  const saveTab = useCallback(async (rel) => {
    const tab = tabsRef.current.find(t => t.rel === rel)
    if (!tab || !tab.dirty) return
    let content = tab.content
    if (prefs.formatOnSave && rel === activeRel && editorRef.current) {
      try {
        await editorRef.current.getAction('editor.action.formatDocument')?.run()
        content = editorRef.current.getValue()
      } catch { /* no formatter registered for this language — save as-is */ }
    }
    try {
      await window.api.ide.writeFile(projectId, rel, content)
      setTabs(prev => prev.map(t => t.rel === rel ? { ...t, content, savedContent: content, dirty: false } : t))
    } catch (e) {
      toast.error('Could not save file', e.message)
    }
  }, [projectId, toast, prefs.formatOnSave, activeRel])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && activeRel) {
        e.preventDefault()
        saveTab(activeRel)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeRel, saveTab])

  const closeTab = (rel, e) => {
    e.stopPropagation()
    setTabs(prev => prev.filter(t => t.rel !== rel))
    if (activeRel === rel) {
      const remaining = tabs.filter(t => t.rel !== rel)
      setActiveRel(remaining.length ? remaining[remaining.length - 1].rel : null)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* File tree */}
      <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '8px 0' }}>
        {loadingTree ? (
          <div style={{ padding: 12, fontSize: 12, color: 'var(--dimmer)' }}>Loading…</div>
        ) : !tree?.length ? (
          <div style={{ padding: 12, fontSize: 12, color: 'var(--dimmer)' }}>No files</div>
        ) : tree.map(node => (
          <TreeNode key={node.rel} node={node} depth={0} openPath={activeRel} onOpenFile={openFile} expanded={expanded} toggleExpanded={toggleExpanded} />
        ))}
      </div>

      {/* Editor + tabs */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {tabs.length > 0 && (
          <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            {tabs.map(t => (
              <div
                key={t.rel}
                onClick={() => setActiveRel(t.rel)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                  fontSize: 12, cursor: 'pointer', flexShrink: 0,
                  color: t.rel === activeRel ? 'var(--text)' : 'var(--dim)',
                  background: t.rel === activeRel ? 'var(--card)' : 'transparent',
                  borderRight: '1px solid var(--border)',
                }}
              >
                <span>{t.name}</span>
                {t.dirty && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
                <span onClick={(e) => closeTab(t.rel, e)} style={{ color: 'var(--dimmer)', padding: '0 2px' }}>×</span>
              </div>
            ))}
          </div>
        )}

        {activeTab ? (
          <>
            <Editor
              key={activeTab.rel}
              height="100%"
              language={langForExt(activeTab.ext)}
              value={activeTab.content}
              theme="croco"
              onChange={handleChange}
              onMount={(editor) => { editorRef.current = editor; applyCrocoMonacoTheme() }}
              options={{
                fontSize: prefs.fontSize,
                tabSize: prefs.tabSize,
                insertSpaces: prefs.insertSpaces,
                wordWrap: prefs.wordWrap,
                minimap: { enabled: prefs.minimap },
                lineNumbers: prefs.lineNumbers,
                renderWhitespace: prefs.renderWhitespace,
                cursorBlinking: prefs.cursorBlinking,
                automaticLayout: true,
                fontFamily: 'Geist Mono, monospace',
              }}
            />
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dimmer)', fontSize: 13 }}>
            Select a file to start editing
          </div>
        )}

        {activeTab && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--dimmer)', flexShrink: 0 }}>
            <span>{activeTab.rel}</span>
            <span
              onClick={() => saveTab(activeTab.rel)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: activeTab.dirty ? 'pointer' : 'default', color: activeTab.dirty ? 'var(--accent)' : 'var(--dimmer)' }}
            >
              <SaveIcon size={11} /> {activeTab.dirty ? 'Save (Ctrl+S)' : 'Saved'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
