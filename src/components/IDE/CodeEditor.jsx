import { useState, useEffect, useCallback, useRef } from 'react'
import Editor from '@monaco-editor/react'
import { applyCrocoMonacoTheme } from '../../lib/monacoSetup' // self-hosts Monaco locally instead of the default CDN loader — see that file
import { FolderIcon, FolderOpenIcon, FileIcon, SaveIcon, RefreshIcon } from '../../constants/SimpleSvgExports'
import { useToast } from '../Toast/useToast.js'
import { useData } from '../../lib/store'
import useDiscordPresence from '../../hooks/useDiscordPresence'
import ChatPanel from '../AI/ChatPanel'

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

// A little VS Code-style per-extension color coding for file icons — purely
// cosmetic, makes a busy tree scannable at a glance.
const ICON_COLOR_BY_EXT = {
  '.js': '#e8c547', '.jsx': '#61dafb', '.mjs': '#e8c547', '.cjs': '#e8c547',
  '.ts': '#4a9eff', '.tsx': '#4a9eff',
  '.json': '#e5854f', '.md': '#b48cf2', '.mdx': '#b48cf2',
  '.rs': '#e5646a', '.py': '#6fdd9a', '.go': '#4ad9d9', '.java': '#e5854f',
  '.c': '#6aa8f0', '.h': '#6aa8f0', '.cpp': '#6aa8f0', '.hpp': '#6aa8f0', '.cs': '#b48cf2',
  '.html': '#e5854f', '.css': '#4a9eff', '.scss': '#e56aad', '.less': '#4a9eff',
  '.yml': '#b48cf2', '.yaml': '#b48cf2', '.toml': '#b48cf2',
}
function iconColorForExt(ext) { return ICON_COLOR_BY_EXT[ext] || 'var(--dimmer)' }

function TreeRow({ children, depth, active, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
        padding: '4px 8px', paddingLeft: 8 + depth * 14, margin: '0 4px',
        borderRadius: 'var(--r-sm)', fontSize: 12, userSelect: 'none',
        background: active ? 'var(--accent-dim)' : hovered ? 'var(--hover-bg)' : 'transparent',
        borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
        transition: 'background var(--transition-fast)',
      }}
    >
      {children}
    </div>
  )
}

function TreeNode({ node, depth, openPath, onOpenFile, expanded, toggleExpanded }) {
  if (node.type === 'dir') {
    if (node.ignored) return null
    const isOpen = !!expanded[node.rel]
    return (
      <div>
        <TreeRow depth={depth} onClick={() => toggleExpanded(node.rel)}>
          <span style={{ display: 'flex', flexShrink: 0, color: 'var(--dimmer)' }}>
            {isOpen ? <FolderOpenIcon size={13} /> : <FolderIcon size={13} />}
          </span>
          <span style={{ color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
        </TreeRow>
        {isOpen && node.children?.map(child => (
          <TreeNode key={child.rel} node={child} depth={depth + 1} openPath={openPath} onOpenFile={onOpenFile} expanded={expanded} toggleExpanded={toggleExpanded} />
        ))}
      </div>
    )
  }
  const active = node.rel === openPath
  return (
    <TreeRow depth={depth} active={active} onClick={() => onOpenFile(node)}>
      <span style={{ display: 'flex', flexShrink: 0, color: iconColorForExt(node.ext) }}><FileIcon size={13} /></span>
      <span style={{ color: active ? 'var(--text)' : 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
    </TreeRow>
  )
}

// Embedded lightweight editor (Monaco — the engine VS Code itself is built
// on), not real VS Code — no extensions, no debugger. Shared between the
// standalone /ide page and ProjectDetail's "Code" tab.
export default function CodeEditor({ projectId, projectName, projectGithubUrl }) {
  const toast = useToast()
  const settings = useData('settings')
  const [tree, setTree] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [tabs, setTabs] = useState([]) // [{ rel, name, ext, content, savedContent, dirty }]
  const [activeRel, setActiveRel] = useState(null)
  const [loadingTree, setLoadingTree] = useState(true)
  const [aiOpen, setAiOpen] = useState(() => { try { return localStorage.getItem('croco:ide:aiOpen') === '1' } catch { return false } })
  const tabsRef = useRef(tabs)
  useEffect(() => { tabsRef.current = tabs }, [tabs])
  useEffect(() => { try { localStorage.setItem('croco:ide:aiOpen', aiOpen ? '1' : '0') } catch { /* private mode */ } }, [aiOpen])

  const prefs = { ...DEFAULT_EDITOR_PREFS, ...(settings?.modules?.ide?.editor || {}) }
  // "Ask AI" is only offered when the AI module is on; provider follows
  // whatever the AI page last selected so the two never disagree.
  const aiEnabled = !!settings?.modules?.ai?.enabled
  const aiProvider = settings?.modules?.ai?.provider || 'anthropic'

  // Re-theme whenever the app's own theme/accent changes, not just once on
  // mount — matches the rest of the UI updating live from Settings.
  useEffect(() => {
    applyCrocoMonacoTheme()
  }, [settings?.appearance?.theme, settings?.appearance?.accentColor, settings?.appearance?.glass])

  const loadTree = useCallback((showSpinner) => {
    if (!projectId || !window.api) return
    if (showSpinner) setLoadingTree(true)
    window.api.projects.getFileTree(projectId)
      .then(setTree)
      .catch(() => setTree([]))
      .finally(() => setLoadingTree(false))
  }, [projectId])

  // Callers key this component by projectId (see IDE.jsx / ProjectDetail.jsx)
  // so a project switch remounts fresh — tree/tabs/activeRel all start at
  // their initial values automatically, no manual reset needed here.
  useEffect(() => { Promise.resolve().then(() => loadTree(true)) }, [loadTree])

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
    projectName ? `in ${projectName}` : null,
    projectGithubUrl
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

  // The open file's live contents, read at send time (not captured at
  // render) so the AI always sees what's actually in the buffer.
  const fileContextFor = useCallback(() => {
    const tab = tabsRef.current.find(t => t.rel === activeRel)
    if (!tab) return null
    return `File: ${tab.rel}\n\n\`\`\`${langForExt(tab.ext)}\n${tab.content}\n\`\`\``
  }, [activeRel])

  // Applies a fenced block from the AI reply through Monaco's edit API so
  // it lands in the undo stack like any typed change. Nothing is written
  // to disk until the user saves.
  const applyCode = useCallback((code, how) => {
    const editor = editorRef.current
    if (!editor || !activeRel) { toast.error('No file open', 'Open a file in the editor first.'); return }
    const model = editor.getModel()
    if (!model) return
    if (how === 'replace') {
      editor.executeEdits('croco-ai', [{ range: model.getFullModelRange(), text: code, forceMoveMarkers: true }])
    } else {
      const sel = editor.getSelection()
      editor.executeEdits('croco-ai', [{ range: sel, text: code, forceMoveMarkers: true }])
    }
    editor.pushUndoStop()
    editor.focus()
    toast.success(how === 'replace' ? 'File replaced' : 'Code inserted', 'Ctrl+Z to undo, Ctrl+S to save.')
  }, [activeRel, toast])

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* File tree */}
      <div style={{
        width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column',
        borderRight: '1px solid var(--border)', background: 'var(--sidebar-bg)',
        backdropFilter: 'var(--panel-blur)', WebkitBackdropFilter: 'var(--panel-blur)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 6px', flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Explorer</span>
          <button
            onClick={() => loadTree(false)}
            title="Refresh file tree"
            style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', padding: 2, borderRadius: 'var(--r-sm)', transition: 'color var(--transition-fast)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--dim)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--dimmer)'}
          ><RefreshIcon size={12} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
          {loadingTree ? (
            <div style={{ padding: '4px 12px', fontSize: 12, color: 'var(--dimmer)' }}>Loading…</div>
          ) : !tree?.length ? (
            <div style={{ padding: '4px 12px', fontSize: 12, color: 'var(--dimmer)' }}>No files</div>
          ) : tree.map(node => (
            <TreeNode key={node.rel} node={node} depth={0} openPath={activeRel} onOpenFile={openFile} expanded={expanded} toggleExpanded={toggleExpanded} />
          ))}
        </div>
      </div>

      {/* Editor + tabs */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {tabs.length > 0 && (
          <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--border)', flexShrink: 0, gap: 2, padding: '4px 4px 0' }}>
            {tabs.map(t => {
              const isActive = t.rel === activeRel
              return (
                <div
                  key={t.rel}
                  onClick={() => setActiveRel(t.rel)}
                  className="ide-tab"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px 7px 12px',
                    fontSize: 12, cursor: 'pointer', flexShrink: 0,
                    borderRadius: 'var(--r-sm) var(--r-sm) 0 0',
                    color: isActive ? 'var(--text)' : 'var(--dim)',
                    background: isActive ? 'var(--card)' : 'transparent',
                    borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                    transition: 'background var(--transition-fast), color var(--transition-fast)',
                  }}
                >
                  <span style={{ display: 'flex', color: iconColorForExt(t.ext) }}><FileIcon size={12} /></span>
                  <span>{t.name}</span>
                  {t.dirty && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
                  <span
                    onClick={(e) => closeTab(t.rel, e)}
                    title="Close"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 16, height: 16, borderRadius: 'var(--r-sm)', color: 'var(--dimmer)',
                      fontSize: 13, lineHeight: 1, transition: 'background var(--transition-fast), color var(--transition-fast)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--dimmer)' }}
                  >×</span>
                </div>
              )
            })}
          </div>
        )}

        {activeTab ? (
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
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--dimmer)' }}>
            <FileIcon size={28} />
            <span style={{ fontSize: 13 }}>Select a file to start editing</span>
          </div>
        )}

        {activeTab && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '4px 12px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--dimmer)', flexShrink: 0 }}>
            <span style={{ fontFamily: 'Geist Mono, monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeTab.rel}</span>
            {aiEnabled && (
              <span
                onClick={() => setAiOpen(o => !o)}
                title={aiOpen ? 'Hide the AI panel' : 'Ask the AI about this file'}
                style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: aiOpen ? 'var(--accent)' : 'var(--dimmer)', transition: 'color var(--transition-fast)' }}
              >
                <SparkleIcon size={11} /> {aiOpen ? 'AI' : 'Ask AI'}
              </span>
            )}
            <span
              onClick={() => saveTab(activeTab.rel)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: activeTab.dirty ? 'pointer' : 'default', color: activeTab.dirty ? 'var(--accent)' : 'var(--dimmer)', transition: 'color var(--transition-fast)' }}
            >
              <SaveIcon size={11} /> {activeTab.dirty ? 'Save (Ctrl+S)' : 'Saved'}
            </span>
          </div>
        )}
      </div>

      {/* Ask AI side panel — one conversation per project+file so switching
          files switches threads. The open file is sent as context on every
          message; fenced code in replies gets Insert / Replace buttons. */}
      {aiEnabled && aiOpen && activeTab && (
        <div style={{
          width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', minWidth: 0,
          borderLeft: '1px solid var(--border)', background: 'var(--sidebar-bg)',
          backdropFilter: 'var(--panel-blur)', WebkitBackdropFilter: 'var(--panel-blur)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 6px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <SparkleIcon size={11} /> Ask AI · {activeTab.name}
            </span>
            <button
              onClick={() => setAiOpen(false)}
              title="Close"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', fontSize: 14, lineHeight: 1, padding: 2 }}
            >×</button>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ChatPanel
              key={`${projectId}:${activeTab.rel}`}
              mode="code"
              provider={aiProvider}
              projectId={projectId}
              conversationKey={`ide:${projectId}:${activeTab.rel}`}
              fileContext={fileContextFor}
              onApplyCode={applyCode}
              compact
            />
          </div>
        </div>
      )}
    </div>
  )
}

function SparkleIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5l1.6 4.1L13.7 7l-4.1 1.4L8 12.5 6.4 8.4 2.3 7l4.1-1.4z" />
      <path d="M13 11.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" />
    </svg>
  )
}
