import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Editor from '@monaco-editor/react'
import { setMonacoColorTheme } from '../../lib/monacoSetup' // self-hosts Monaco locally instead of the default CDN loader — see that file
import { FolderIcon, FolderOpenIcon, FileIcon, SaveIcon, RefreshIcon } from '../../constants/SimpleSvgExports'
import FileTypeIcon from './FileTypeIcon'
import ClaudeCodePanel from './ClaudeCodePanel'
import { useToast } from '../Toast/useToast.js'
import { useData, patchData } from '../../lib/store'
import useDiscordPresence from '../../hooks/useDiscordPresence'
import useSideSwapFlip from '../../hooks/useSideSwapFlip'
import ChatPanel from '../AI/ChatPanel'

const DEFAULT_EDITOR_PREFS = {
  fontSize: 13, tabSize: 2, insertSpaces: true, wordWrap: 'off',
  minimap: false, lineNumbers: 'on', renderWhitespace: 'none',
  cursorBlinking: 'blink', formatOnSave: false, colorTheme: 'catppuccin-mocha',
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
        {isOpen && (
          <div className="pm-tab-content">
            {node.children?.map(child => (
              <TreeNode key={child.rel} node={child} depth={depth + 1} openPath={openPath} onOpenFile={onOpenFile} expanded={expanded} toggleExpanded={toggleExpanded} />
            ))}
          </div>
        )}
      </div>
    )
  }
  const active = node.rel === openPath
  return (
    <TreeRow depth={depth} active={active} onClick={() => onOpenFile(node)}>
      <FileTypeIcon name={node.name} ext={node.ext} size={13} />
      <span style={{ color: active ? 'var(--text)' : 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
    </TreeRow>
  )
}

// Flattens the tree into a plain file list for the quick-open palette
// (Ctrl/Cmd+P) — directories/ignored subtrees excluded.
function flattenFiles(nodes, out = []) {
  for (const node of nodes || []) {
    if (node.type === 'dir') { if (!node.ignored) flattenFiles(node.children, out) }
    else out.push(node)
  }
  return out
}

function fuzzyScore(q, text) {
  if (!q) return 1
  const t = (text || '').toLowerCase()
  if (!t) return 0
  const idx = t.indexOf(q)
  if (idx === 0) return 100
  if (idx > 0) return 80 - Math.min(idx, 20)
  let ti = 0, score = 0, prev = -2
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi]
    const found = t.indexOf(c, ti)
    if (found === -1) return 0
    score += 2
    if (found === prev + 1) score += 3
    prev = found
    ti = found + 1
  }
  return Math.min(score, 60)
}

function QuickOpen({ files, onPick, onClose }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  const q = query.trim().toLowerCase()
  const results = useMemo(() => {
    const scored = files
      .map(f => ({ f, score: Math.max(fuzzyScore(q, f.name), fuzzyScore(q, f.rel) * 0.8) }))
      .filter(r => !q || r.score > 0)
      .sort((a, b) => b.score - a.score)
    return scored.slice(0, 60).map(r => r.f)
  }, [files, q])
  // Reset the selection whenever the query changes — adjusted during render
  // (React's own recommended pattern for this) rather than in an effect, to
  // avoid an extra cascading render on every keystroke.
  const [prevQuery, setPrevQuery] = useState(query)
  if (query !== prevQuery) { setPrevQuery(query); setSelected(0) }
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter') { if (results[selected]) onPick(results[selected]) }
    else if (e.key === 'Escape') onClose()
  }
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 60 }}>
      <div onClick={e => e.stopPropagation()} className="pm-scale-in" style={{ width: 460, maxWidth: '90%', background: 'var(--surface)', border: '1px solid var(--border-bright)', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
        <input
          ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKey}
          placeholder="Go to file…"
          style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', outline: 'none', color: 'var(--text)', fontSize: 13, fontFamily: 'Geist, sans-serif' }}
        />
        <div style={{ maxHeight: 320, overflowY: 'auto', padding: '4px 0' }}>
          {results.length === 0 ? (
            <div style={{ padding: '18px 14px', fontSize: 12, color: 'var(--dimmer)', textAlign: 'center' }}>No matching files</div>
          ) : results.map((f, i) => (
            <div
              key={f.rel} onClick={() => onPick(f)} onMouseEnter={() => setSelected(i)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', cursor: 'pointer', background: selected === i ? 'var(--card)' : 'transparent' }}
            >
              <FileTypeIcon name={f.name} ext={f.ext} size={12} />
              <span style={{ fontSize: 12.5, color: 'var(--text)' }}>{f.name}</span>
              <span style={{ fontSize: 10.5, color: 'var(--dimmer)', marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.rel}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Embedded lightweight editor (Monaco — the engine VS Code itself is built
// on), not real VS Code — no extensions, no debugger. Shared between the
// standalone /ide page and ProjectDetail's "Code" tab.
export default function CodeEditor({ projectId, projectName, projectGithubUrl }) {
  const toast = useToast()
  const settings = useData('settings')
  const [tree, setTree] = useState(null)
  const [treeError, setTreeError] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [tabs, setTabs] = useState([]) // [{ rel, name, ext, content, savedContent, dirty }]
  const [activeRel, setActiveRel] = useState(null)
  const [loadingTree, setLoadingTree] = useState(true)
  const [quickOpen, setQuickOpen] = useState(false)
  const [panelTab, setPanelTab] = useState(() => { try { return localStorage.getItem(`croco:ide:panelTab:${projectId}`) || 'ai' } catch { return 'ai' } })
  const [panelOpen, setPanelOpen] = useState(() => { try { return localStorage.getItem(`croco:ide:panelOpen:${projectId}`) === '1' } catch { return false } })
  const tabsRef = useRef(tabs)
  useEffect(() => { tabsRef.current = tabs }, [tabs])
  // Scoped per-project (not global) — opening the AI/Claude panel in one
  // project used to force it open in every other project too.
  useEffect(() => { try { localStorage.setItem(`croco:ide:panelOpen:${projectId}`, panelOpen ? '1' : '0') } catch { /* private mode */ } }, [panelOpen, projectId])
  useEffect(() => { try { localStorage.setItem(`croco:ide:panelTab:${projectId}`, panelTab) } catch { /* private mode */ } }, [panelTab, projectId])

  const prefs = { ...DEFAULT_EDITOR_PREFS, ...(settings?.modules?.ide?.editor || {}) }
  const aiEnabled = !!settings?.modules?.ai?.enabled
  const aiProvider = settings?.modules?.ai?.provider || 'anthropic'
  const claudeCodeEnabled = !!settings?.modules?.ide?.claudeCode?.enabled
  const settingsPermissionMode = settings?.modules?.ide?.claudeCode?.permissionMode || 'plan'
  const [claudePermissionMode, setClaudePermissionMode] = useState(settingsPermissionMode)
  const [prevSettingsPermissionMode, setPrevSettingsPermissionMode] = useState(settingsPermissionMode)
  if (settingsPermissionMode !== prevSettingsPermissionMode) {
    setPrevSettingsPermissionMode(settingsPermissionMode)
    setClaudePermissionMode(settingsPermissionMode)
  }
  const onPermissionModeChange = (mode) => {
    setClaudePermissionMode(mode)
    window.api?.settings.update({ modules: { ide: { claudeCode: { permissionMode: mode } } } }).catch(() => {})
  }

  const explorerSide = settings?.modules?.ide?.layout?.explorerSide === 'right' ? 'right' : 'left'
  const shellRef = useRef(null)
  useSideSwapFlip(shellRef, explorerSide)

  // Tells AppShell.jsx an explorer is actually on screen right now, so the
  // app sidebar can follow its side — this component mounts from two
  // different places (the dedicated /ide page, and a project's own "Code"
  // tab in ProjectDetail.jsx, whose tab selection is local state and not
  // visible in the URL), so a plain mount/unmount broadcast is the only
  // reliable signal regardless of which one rendered it.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('croco:ide-explorer-visible', { detail: { visible: true } }))
    return () => window.dispatchEvent(new CustomEvent('croco:ide-explorer-visible', { detail: { visible: false } }))
  }, [])

  // Quick in-panel flip — same setting as Settings → Modules → IDE →
  // Explorer Position, just reachable without leaving the page. Patches the
  // store optimistically so the swap (and the app sidebar following it,
  // see AppShell.jsx) animates immediately on click, not after the store's
  // next revalidation.
  const toggleExplorerSide = () => {
    const next = explorerSide === 'right' ? 'left' : 'right'
    patchData('settings', prev => prev ? { ...prev, modules: { ...prev.modules, ide: { ...prev.modules?.ide, layout: { ...prev.modules?.ide?.layout, explorerSide: next } } } } : prev)
    window.api?.settings.update({ modules: { ide: { layout: { explorerSide: next } } } }).catch(() => {})
  }

  // Re-theme whenever the color-theme choice or (for the 'croco' variant
  // only) the app's own theme/accent changes.
  useEffect(() => {
    setMonacoColorTheme(prefs.colorTheme)
  }, [prefs.colorTheme, settings?.appearance?.theme, settings?.appearance?.accentColor, settings?.appearance?.glass])

  const loadTree = useCallback((showSpinner) => {
    if (!projectId || !window.api) return
    if (showSpinner) setLoadingTree(true)
    setTreeError(null)
    window.api.projects.getFileTree(projectId)
      .then(setTree)
      .catch(e => { setTree([]); setTreeError(e?.message || 'Could not load this project’s files.') })
      .finally(() => setLoadingTree(false))
  }, [projectId])

  // Callers key this component by projectId (see IDE.jsx / ProjectDetail.jsx)
  // so a project switch remounts fresh — tree/tabs/activeRel all start at
  // their initial values automatically, no manual reset needed here.
  useEffect(() => { Promise.resolve().then(() => loadTree(true)) }, [loadTree])

  const toggleExpanded = useCallback((rel) => {
    setExpanded(prev => ({ ...prev, [rel]: !prev[rel] }))
  }, [])

  // Only moves the selection once the file has actually loaded (or was
  // already open) — previously activeRel was set optimistically before the
  // read resolved, so a failed open (permission error, deleted file,
  // rejected binary) left activeRel pointing at a tab that never existed,
  // silently falling back to the "select a file" empty state with only an
  // easy-to-miss toast as any indication something went wrong.
  const openFile = useCallback(async (node) => {
    if (tabsRef.current.some(t => t.rel === node.rel)) { setActiveRel(node.rel); return }
    try {
      const content = await window.api.ide.readFile(projectId, node.rel)
      setTabs(prev => [...prev, { rel: node.rel, name: node.name, ext: node.ext, content, savedContent: content, dirty: false }])
      setActiveRel(node.rel)
    } catch (e) {
      toast.error('Could not open file', e.message)
    }
  }, [projectId, toast])

  const activeTab = tabs.find(t => t.rel === activeRel) || null

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

  const allFiles = useMemo(() => flattenFiles(tree), [tree])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && activeRel) {
        e.preventDefault()
        saveTab(activeRel)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'p' && !e.shiftKey) {
        e.preventDefault()
        setQuickOpen(o => !o)
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

  const fileContextFor = useCallback(() => {
    const tab = tabsRef.current.find(t => t.rel === activeRel)
    if (!tab) return null
    return `File: ${tab.rel}\n\n\`\`\`${langForExt(tab.ext)}\n${tab.content}\n\`\`\``
  }, [activeRel])

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

  const motionOn = settings?.appearance?.smoothAnimations !== false
  const rowReverse = explorerSide === 'right'
  const explorerBorderSide = rowReverse ? 'borderLeft' : 'borderRight'
  const panelBorderSide = rowReverse ? 'borderRight' : 'borderLeft'
  const panelVisible = panelOpen && activeTab && ((panelTab === 'ai' && aiEnabled) || (panelTab === 'claude' && claudeCodeEnabled))

  return (
    <div ref={shellRef} style={{ display: 'flex', flexDirection: rowReverse ? 'row-reverse' : 'row', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* File tree */}
      <div style={{
        width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column',
        [explorerBorderSide]: '1px solid var(--border)', background: 'var(--sidebar-bg)',
        backdropFilter: 'var(--panel-blur)', WebkitBackdropFilter: 'var(--panel-blur)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 6px', flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Explorer</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={toggleExplorerSide}
              title={explorerSide === 'right' ? 'Move explorer to the left' : 'Move explorer to the right'}
              style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', padding: 2, borderRadius: 'var(--r-sm)', transition: 'color var(--transition-fast)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--dim)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--dimmer)'}
            ><FlipSideIcon size={12} flipped={explorerSide === 'right'} /></button>
            <button
              onClick={() => loadTree(false)}
              title="Refresh file tree"
              style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', padding: 2, borderRadius: 'var(--r-sm)', transition: 'color var(--transition-fast)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--dim)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--dimmer)'}
            ><RefreshIcon size={12} /></button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
          {loadingTree ? (
            <div style={{ padding: '4px 12px', fontSize: 12, color: 'var(--dimmer)' }}>Loading…</div>
          ) : treeError ? (
            <div style={{ padding: '4px 12px', fontSize: 12, color: '#ff6b6b', lineHeight: 1.5 }}>{treeError}</div>
          ) : !tree?.length ? (
            <div style={{ padding: '4px 12px', fontSize: 12, color: 'var(--dimmer)' }}>No files</div>
          ) : tree.map(node => (
            <TreeNode key={node.rel} node={node} depth={0} openPath={activeRel} onOpenFile={openFile} expanded={expanded} toggleExpanded={toggleExpanded} />
          ))}
        </div>
      </div>

      {/* Editor + tabs */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
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
                  <FileTypeIcon name={t.name} ext={t.ext} size={12} />
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
          <div key={activeTab.rel} className="pm-tab-content" style={{ flex: 1, minHeight: 0 }}>
            <Editor
              height="100%"
              language={langForExt(activeTab.ext)}
              value={activeTab.content}
              theme={prefs.colorTheme === 'croco' ? 'croco' : 'catppuccin-mocha'}
              onChange={handleChange}
              onMount={(editor) => { editorRef.current = editor; setMonacoColorTheme(prefs.colorTheme) }}
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
                smoothScrolling: motionOn,
                cursorSmoothCaretAnimation: motionOn ? 'on' : 'off',
                stickyScroll: { enabled: true },
                bracketPairColorization: { enabled: true },
                guides: { bracketPairs: true, indentation: true },
                folding: true,
                matchBrackets: 'always',
                padding: { top: 10 },
              }}
            />
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--dimmer)' }}>
            <FileIcon size={28} />
            <span style={{ fontSize: 13 }}>Select a file to start editing</span>
            <span style={{ fontSize: 11, fontFamily: 'Geist Mono, monospace' }}>Ctrl+P to quick-open a file</span>
          </div>
        )}

        {activeTab && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '4px 12px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--dimmer)', flexShrink: 0 }}>
            <span style={{ fontFamily: 'Geist Mono, monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeTab.rel}</span>
            {aiEnabled && (
              <span
                onClick={() => { setPanelTab('ai'); setPanelOpen(o => panelTab === 'ai' ? !o : true) }}
                title="Ask the AI about this file"
                style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: (panelOpen && panelTab === 'ai') ? 'var(--accent)' : 'var(--dimmer)', transition: 'color var(--transition-fast)' }}
              >
                <SparkleIcon size={11} /> Ask AI
              </span>
            )}
            {claudeCodeEnabled && (
              <span
                onClick={() => { setPanelTab('claude'); setPanelOpen(o => panelTab === 'claude' ? !o : true) }}
                title="Ask Claude Code about this project"
                style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: (panelOpen && panelTab === 'claude') ? 'var(--accent)' : 'var(--dimmer)', transition: 'color var(--transition-fast)' }}
              >
                <ClaudeGlyph size={11} /> Claude Code
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

        {quickOpen && (
          <QuickOpen
            files={allFiles}
            onClose={() => setQuickOpen(false)}
            onPick={(f) => { setQuickOpen(false); openFile(f) }}
          />
        )}
      </div>

      {/* Ask AI / Claude Code side panel — one conversation per project+file
          for Ask AI (ChatPanel), one per-project CLI session for Claude Code. */}
      {panelVisible && (
        <div style={{
          width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', minWidth: 0,
          [panelBorderSide]: '1px solid var(--border)', background: 'var(--sidebar-bg)',
          backdropFilter: 'var(--panel-blur)', WebkitBackdropFilter: 'var(--panel-blur)',
        }}>
          {panelTab === 'claude' ? (
            <ClaudeCodePanel
              projectId={projectId}
              permissionMode={claudePermissionMode}
              onPermissionModeChange={onPermissionModeChange}
              onClose={() => setPanelOpen(false)}
            />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 6px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <SparkleIcon size={11} /> Ask AI · {activeTab?.name}
                </span>
                <button
                  onClick={() => setPanelOpen(false)}
                  title="Close"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', fontSize: 14, lineHeight: 1, padding: 2 }}
                >×</button>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ChatPanel
                  key={`${projectId}:${activeTab?.rel}`}
                  mode="code"
                  provider={aiProvider}
                  projectId={projectId}
                  conversationKey={`ide:${projectId}:${activeTab?.rel}`}
                  fileContext={fileContextFor}
                  onApplyCode={applyCode}
                  compact
                />
              </div>
            </>
          )}
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

function ClaudeGlyph({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3l2 2" />
    </svg>
  )
}

function FlipSideIcon({ size = 12, flipped = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: flipped ? 'scaleX(-1)' : 'none', transition: 'transform var(--transition-fast)' }}>
      <rect x="1.5" y="2.5" width="5" height="11" rx="1" />
      <rect x="9.5" y="2.5" width="5" height="11" rx="1" opacity="0.4" />
      <path d="M9.5 8h4M11.5 6l2 2-2 2" />
    </svg>
  )
}
