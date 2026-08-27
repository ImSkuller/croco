import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon, StarIcon, IdeLogoIcon, FolderOpenIcon, GithubIcon,
  PlayIcon, StopIcon,
  DownloadIcon, RefreshIcon, AlertTriangleIcon, ExternalLinkIcon,
} from '../constants/SimpleSvgExports'
import { CardBtn } from '../components/Projects/Exports'
import { useToast } from '../components/Toast/useToast.js'
import { useKeyboard } from '../hooks/useKeyboard'
import { renderMarkdown, applyTermText, SHELL_OPTS_WIN, SHELL_OPTS_UNIX } from '../lib/projectDetailHelpers'
import { isTodoLocked } from '../lib/todoPriorities'
import VisBadge from '../components/ProjectDetail/VisBadge'
import MetaItem from '../components/ProjectDetail/MetaItem'
import StatCard from '../components/ProjectDetail/StatCard'
import InfoSection from '../components/ProjectDetail/InfoSection'
import Spinner from '../components/ProjectDetail/Spinner'
import DangerRow from '../components/ProjectDetail/DangerRow'
import DepsBtn from '../components/ProjectDetail/DepsBtn'
import FileTreeNodes from '../components/ProjectDetail/FileTreeNodes'
import TerminalPanel from '../components/ProjectDetail/TerminalPanel'
import GitPanel from '../components/ProjectDetail/GitPanel'
import ConfirmModal from '../components/ProjectDetail/ConfirmModal'

// ── Main ─────────────────────────────────────────────────────
export default function ProjectDetail() {
  const { projectId } = useParams()
  const navigate      = useNavigate()
  const toast         = useToast()

  const [project,     setProject]     = useState(null)
  const [languages,   setLanguages]   = useState([])
  const [gitStatus,   setGitStatus]   = useState(null)
  const [gitLog,      setGitLog]      = useState([])
  const [branches,    setBranches]    = useState([])
  const [aheadBehind, setAheadBehind] = useState(null)
  const [isRepo,      setIsRepo]      = useState(false)
  const [openDiff,    setOpenDiff]    = useState(null)  // "type:file" of the currently expanded diff
  const [diffText,    setDiffText]    = useState({})    // "type:file" -> diff string
  const [diffLoading, setDiffLoading] = useState(null)  // "type:file" currently fetching

  const [loading,      setLoading]      = useState(true)
  const [platform,     setPlatform]     = useState('win32')
  const [gitLoading,   setGitLoading]   = useState(false)
  const [syncLoading,  setSyncLoading]  = useState(false)
  const [pulling,      setPulling]      = useState(false)
  const [committing,   setCommitting]   = useState(false)

  const [tab,          setTab]          = useState('overview')
  const [showCommit,   setShowCommit]   = useState(false)
  const [commitMsg,    setCommitMsg]    = useState('')
  const [commitResult, setCommitResult] = useState(null)

  const [deps,         setDeps]         = useState(null)
  const [depsLoading,  setDepsLoading]  = useState(false)
  const [depsOp,       setDepsOp]       = useState(null)  // 'install'|'update'|'add'|{name}
  const [depsOutput,   setDepsOutput]   = useState('')
  const [addPkgInput,  setAddPkgInput]  = useState('')
  const [addPkgDev,    setAddPkgDev]    = useState(false)

  const [fileTree,     setFileTree]     = useState(null)
  const [fileLoading,  setFileLoading]  = useState(false)
  const [expanded,     setExpanded]     = useState({})

  const [isRunning,    setIsRunning]    = useState(false)
  const [termOutput,   setTermOutput]   = useState([])  // [{type, text}]
  const [termCmd,      setTermCmd]      = useState('')

  const [pushing,      setPushing]      = useState(false)
  const [branchOpen,   setBranchOpen]   = useState(false)
  const [newBranch,    setNewBranch]    = useState('')
  const [branchOp,     setBranchOp]     = useState(null) // 'switching'|'creating'

  const [readme,       setReadme]       = useState(null)  // null|{content,filename}|false
  const [readmeLoading, setReadmeLoading] = useState(false)

  const [allScripts,   setAllScripts]   = useState([])   // [{name, command}] from package.json
  const [runEnv,       setRunEnv]       = useState('development')

  const [runMenuOpen,  setRunMenuOpen]  = useState(false)
  const [modal,        setModal]        = useState(null)
  const [modalInput,   setModalInput]   = useState('')
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError,   setModalError]   = useState('')

  const [initingRepo,    setInitingRepo]    = useState(false)
  const [publishModal,   setPublishModal]   = useState(false)
  const [publishName,    setPublishName]    = useState('')
  const [publishDesc,    setPublishDesc]    = useState('')
  const [publishPrivate, setPublishPrivate] = useState(false)
  const [publishLoading, setPublishLoading] = useState(false)
  const [publishError,   setPublishError]   = useState('')
  const [ctxMenu,        setCtxMenu]        = useState(null) // { x, y, path, name }

  const [projectNotes,    setProjectNotes]    = useState([])
  const [pinnedNoteIds,   setPinnedNoteIds]   = useState(() => {
    try { return JSON.parse(localStorage.getItem(`croco:pinned-notes:${projectId}`) || '[]') } catch { return [] }
  })
  const [projectTodos, setProjectTodos] = useState([])
  const [todoInput,    setTodoInput]    = useState('')
  const [addingTodo,   setAddingTodo]   = useState(false)
  const [todoPriority, setTodoPriority] = useState('med')
  const [todoEmoji,    setTodoEmoji]    = useState('')
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [linkingTodoId, setLinkingTodoId] = useState(null)
  const [todoNoteId,    setTodoNoteId]    = useState(null)
  const [todoNotePicker, setTodoNotePicker] = useState(false)

  // Settings tab edit draft
  const [editDraft,  setEditDraft]  = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const [tagInput,   setTagInput]   = useState('')

  useEffect(() => {
    try { setPinnedNoteIds(JSON.parse(localStorage.getItem(`croco:pinned-notes:${projectId}`) || '[]')) } catch { setPinnedNoteIds([]) }
  }, [projectId])

  const togglePinNote = (noteId) => {
    setPinnedNoteIds(prev => {
      const next = prev.includes(noteId) ? prev.filter(id => id !== noteId) : [...prev, noteId]
      localStorage.setItem(`croco:pinned-notes:${projectId}`, JSON.stringify(next))
      return next
    })
  }

  useEffect(() => {
    setTab('overview')
    setGitStatus(null); setGitLog([]); setAheadBehind(null); setIsRepo(false)
    setProjectNotes([]); setProjectTodos([])
    setDeps(null); setFileTree(null); setExpanded({}); setDepsOutput('')
    setIsRunning(false)
    setTermOutput([])
    setTermCmd('')
    setAllScripts([])
    load()
    if (window.api) {
      window.api.run.isRunning(projectId).then(r => setIsRunning(!!r)).catch(() => {})
    }
  }, [projectId])

  async function load() {
    if (!window.api) { setLoading(false); return }
    setLoading(true)
    try {
      const [p, langs, pNotes, pTodos, plat] = await Promise.all([
        window.api.projects.getById(projectId),
        window.api.projects.detectLanguages(projectId).catch(() => []),
        window.api.notes.getAll(projectId).catch(() => []),
        window.api.todos.getAll(projectId).catch(() => []),
        window.api.system.platform().catch(() => 'win32'),
      ])
      if (plat) setPlatform(plat)
      setProjectNotes(pNotes || [])
      setProjectTodos(pTodos || [])
      if (!p) { setLoading(false); return }
      setProject(p)
      setLanguages(langs || [])
      window.api.projects.getScripts(p.id).then(s => setAllScripts(s || [])).catch(() => {})

      const root = p.paths?.projectRoot || ''
      if (!root) { setLoading(false); return }
      const repo = await window.api.git.isRepo(root).catch(() => false)
      setIsRepo(repo)
      if (repo) {
        setGitLoading(true)
        const [st, log, brs] = await Promise.all([
          window.api.git.status(projectId).catch(() => null),
          window.api.git.getLog(projectId, 30).catch(() => []),
          window.api.git.getBranches(projectId).catch(() => []),
        ])
        setGitStatus(st)
        setGitLog(log)
        setBranches(brs)
        setGitLoading(false)
        checkRemote()
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (tab === 'deps'     && deps    === null && !depsLoading   && project) loadDeps()
    if (tab === 'files'    && fileTree === null && !fileLoading   && project) loadFiles()
    if (tab === 'readme'   && readme   === null && !readmeLoading && project) loadReadme()
    if (tab === 'settings' && project && !editDraft) {
      setEditDraft({
        name:        project.name        || '',
        description: project.description || '',
        emoji:       project.emoji       || '📁',
        ide:         project.ide         || '',
        shell:       project.shell       || '',
        visibility:  project.visibility  || 'public',
        tags:        [...(project.tags   || [])],
        github:      project.github      || '',
        commands: {
          dev:   project.commands?.dev   || '',
          build: project.commands?.build || '',
          start: project.commands?.start || '',
          test:  project.commands?.test  || '',
        },
      })
    }
    if (tab !== 'settings') setEditDraft(null)
  }, [tab, project])

  async function loadReadme() {
    if (!window.api || !project) return
    setReadmeLoading(true)
    try {
      const r = await window.api.git.getReadme(project.id)
      setReadme(r.ok ? r : false)
    } catch { setReadme(false) }
    finally { setReadmeLoading(false) }
  }

  useEffect(() => {
    if (!window.api) return
    const unsubOutput = window.api.run.onOutput(({ projectId: pid, type, text }) => {
      if (pid !== projectId) return
      setTermOutput(prev => applyTermText(prev, type, text).slice(-2000))
    })
    const unsubFinished = window.api.run.onFinished(({ projectId: pid, exitCode }) => {
      if (pid !== projectId) return
      setIsRunning(false)
      setTermOutput(prev => [...prev, { type: 'system', text: `\nProcess exited with code ${exitCode}\n` }])
    })
    return () => { unsubOutput(); unsubFinished() }
  }, [projectId])

  async function checkRemote() {
    if (!window.api) return
    setSyncLoading(true)
    try {
      const ab = await window.api.git.getAheadBehind(projectId)
      setAheadBehind(ab)
    } catch { /* no remote configured, silently ignore */ }
    finally { setSyncLoading(false) }
  }

  async function handleToggleFav() {
    if (!window.api || !project) return
    const u = await window.api.projects.toggleFavorite(project.id).catch(console.error)
    if (u) setProject(u)
  }

  async function handleCommit() {
    if (!commitMsg.trim() || !window.api) return
    setCommitting(true); setCommitResult(null)
    try {
      const r = await window.api.git.commit(project.id, commitMsg)
      setCommitResult(r)
      if (r.ok) {
        setCommitMsg(''); setShowCommit(false)
        const [st, log] = await Promise.all([
          window.api.git.status(project.id).catch(() => null),
          window.api.git.getLog(project.id, 30).catch(() => []),
        ])
        setGitStatus(st); setGitLog(log); checkRemote()
      }
    } catch (e) {
      setCommitResult({ ok: false, message: e.message })
    } finally { setCommitting(false) }
  }

  async function refreshGitStatus() {
    const st = await window.api.git.status(project.id).catch(() => null)
    setGitStatus(st)
  }

  async function handleStageFiles(paths) {
    if (!window.api) return
    await window.api.git.stageFiles(project.id, paths).catch(e => toast.error('Stage failed', e.message))
    refreshGitStatus()
  }

  async function handleUnstageFiles(paths) {
    if (!window.api) return
    await window.api.git.unstageFiles(project.id, paths).catch(e => toast.error('Unstage failed', e.message))
    refreshGitStatus()
  }

  async function toggleDiff(type, f) {
    const key = `${type}:${f}`
    if (openDiff === key) { setOpenDiff(null); return }
    setOpenDiff(key)
    if (diffText[key] === undefined && window.api) {
      setDiffLoading(key)
      try {
        const r = await window.api.git.diffFile(project.id, f, type)
        setDiffText(prev => ({ ...prev, [key]: r.diff }))
      } catch (e) {
        setDiffText(prev => ({ ...prev, [key]: `Failed to load diff: ${e.message}` }))
      } finally {
        setDiffLoading(null)
      }
    }
  }

  async function handlePull() {
    if (!window.api) return
    setPulling(true)
    try {
      await window.api.git.pull(project.id)
      const [st, log] = await Promise.all([
        window.api.git.status(project.id).catch(() => null),
        window.api.git.getLog(project.id, 30).catch(() => []),
      ])
      setGitStatus(st); setGitLog(log)
      setAheadBehind(prev => ({ ...(prev || {}), behind: 0 }))
    } catch (e) {
      toast.error('Pull failed', e.message)
    } finally { setPulling(false) }
  }

  async function handlePush() {
    if (!window.api) return
    setPushing(true)
    try {
      const r = await window.api.git.push(project.id)
      if (r.ok) {
        setAheadBehind(prev => ({ ...(prev || {}), ahead: 0 }))
      } else {
        toast.error('Push failed', r.message)
      }
    } catch (e) {
      toast.error('Push failed', e.message)
    } finally { setPushing(false) }
  }

  async function handleSwitchBranch(branchName) {
    if (!window.api || branchOp) return
    setBranchOp('switching')
    try {
      await window.api.git.switchBranch(project.id, branchName)
      const [st, log, brs] = await Promise.all([
        window.api.git.status(project.id).catch(() => null),
        window.api.git.getLog(project.id, 30).catch(() => []),
        window.api.git.getBranches(project.id).catch(() => []),
      ])
      setGitStatus(st); setGitLog(log); setBranches(brs)
      setBranchOpen(false)
      toast.success('Switched branch', branchName)
    } catch (e) {
      toast.error('Branch switch failed', e.message)
    } finally { setBranchOp(null) }
  }

  async function handleCreateBranch() {
    if (!window.api || !newBranch.trim() || branchOp) return
    setBranchOp('creating')
    try {
      await window.api.git.createBranch(project.id, newBranch.trim())
      const [st, brs] = await Promise.all([
        window.api.git.status(project.id).catch(() => null),
        window.api.git.getBranches(project.id).catch(() => []),
      ])
      setGitStatus(st); setBranches(brs)
      setNewBranch(''); setBranchOpen(false)
      toast.success('Created branch', newBranch.trim())
    } catch (e) {
      toast.error('Create branch failed', e.message)
    } finally { setBranchOp(null) }
  }

  function applyRunStarted(result, commandType) {
    setIsRunning(true)
    setTermCmd(result.command || commandType)
    const envTag = runEnv !== 'development' ? ` [NODE_ENV=${runEnv}]` : ''
    setTermOutput(prev => [...prev, { type: 'system', text: `$ ${result.command || commandType}${envTag}\n` }])
    if (tab !== 'terminal') setTab('terminal')
  }

  async function handleRun(commandType = 'dev') {
    if (!window.api || !project) return
    if (isRunning) {
      await window.api.run.stop(project.id).catch(console.error)
      setIsRunning(false)
      setTermOutput(prev => [...prev, { type: 'system', text: '\nProcess stopped by user.\n' }])
    } else {
      try {
        const env = runEnv !== 'development' ? { NODE_ENV: runEnv } : {}
        const result = await window.api.run.start(project.id, commandType, env)
        if (result?.needsConfirmation) {
          // Commands auto-detected from an imported project's own files
          // (e.g. package.json scripts) get one explicit confirmation
          // before their first run — a hostile cloned repo could otherwise
          // get its suggested command run with zero user intent.
          openModal({
            title: 'Run this command?',
            desc: `This project's command was auto-detected from its files and hasn't been run before:\n\n${result.command}\n\nOnly continue if you trust where this project's code came from.`,
            confirmLabel: 'Run Command',
            onConfirm: async () => {
              const confirmedResult = await window.api.run.start(project.id, commandType, env, true)
              applyRunStarted(confirmedResult, commandType)
            },
          })
          return
        }
        applyRunStarted(result, commandType)
      } catch (e) {
        toast.error('Run failed', e.message)
      }
    }
  }

  function openModal(cfg) {
    setModal(cfg); setModalInput(''); setModalError('')
  }

  async function runModal() {
    setModalLoading(true); setModalError('')
    try {
      await modal.onConfirm()
      setModal(null)
    } catch (e) {
      setModalError(e.message)
    } finally { setModalLoading(false) }
  }

  useKeyboard({
    'ctrl+r':     () => handleRun(),
    'ctrl+enter': () => { if (showCommit && commitMsg.trim() && !committing) handleCommit() },
    'o':          () => { if (project) window.api?.projects.openInIDE(project.id) },
    '1': () => setTab('overview'),
    '2': () => setTab('git'),
    '3': () => setTab('terminal'),
    '4': () => setTab('readme'),
    '5': () => setTab('deps'),
    '6': () => setTab('files'),
    '7': () => setTab('todos'),
    '8': () => setTab('notes'),
    '9': () => setTab('danger'),
  })

  // ── Loading / not found ──────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10 }}>
      <div style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--orange)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <span style={{ fontSize: 13, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Loading project...</span>
    </div>
  )

  if (!project) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
      <div style={{ fontSize: 32 }}>🔍</div>
      <div style={{ fontSize: 14, color: 'var(--dim)' }}>Project not found</div>
      <button onClick={() => navigate('/projects')} style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--dim)', cursor: 'pointer', fontSize: 12, fontFamily: 'Geist, sans-serif' }}>
        Back to Projects
      </button>
    </div>
  )

  const behindCount = aheadBehind?.behind || 0
  const aheadCount  = aheadBehind?.ahead  || 0

  async function loadDeps() {
    if (!window.api || !project) return
    setDepsLoading(true)
    try {
      const d = await window.api.projects.getDependencies(project.id)
      setDeps(d)
    } catch { setDeps(null) }
    finally { setDepsLoading(false) }
  }

  async function loadFiles() {
    if (!window.api || !project) return
    setFileLoading(true)
    try {
      const tree = await window.api.projects.getFileTree(project.id)
      setFileTree(tree)
    } catch { setFileTree([]) }
    finally { setFileLoading(false) }
  }

  async function runDepsOp(label, fn) {
    setDepsOp(label); setDepsOutput('')
    try {
      const r = await fn()
      setDepsOutput(r.output || 'Done.')
      await loadDeps()
    } catch (e) {
      setDepsOutput(`Error: ${e.message}`)
    } finally { setDepsOp(null) }
  }

  const TABS = [
    { id: 'overview',  label: 'Overview' },
    { id: 'git',       label: 'Git', badge: gitStatus && !gitStatus.clean ? gitStatus.total : null },
    { id: 'terminal',  label: 'Terminal', badge: isRunning ? '●' : null, badgeStyle: 'green' },
    { id: 'readme',    label: 'README' },
    { id: 'deps',      label: 'Deps' },
    { id: 'files',     label: 'Files' },
    { id: 'todos',     label: 'Todos' },
    { id: 'notes',     label: 'Notes' },
    { id: 'settings',  label: 'Settings' },
    { id: 'danger',    label: 'Danger', danger: true },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Topbar ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', height: 52, flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => navigate('/projects')}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)', fontSize: 12, fontFamily: 'Geist, sans-serif', padding: '4px 8px', borderRadius: 6, transition: 'all 0.12s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--dim)' }}
        ><ArrowLeftIcon /> Projects</button>
        <span style={{ color: 'var(--border)' }}>/</span>
        <span style={{ fontSize: 14 }}>{project.emoji}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', letterSpacing: -0.2 }}>{project.name}</span>

        {isRunning && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4aff91', boxShadow: '0 0 0 3px rgba(74,255,145,0.15)', animation: 'pmPulse 2s infinite' }} />
            <span style={{ fontSize: 9, color: '#4aff91', fontFamily: 'Geist Mono, monospace' }}>running</span>
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={handleToggleFav}
            title={project.favourite ? 'Remove from favourites' : 'Add to favourites'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, opacity: project.favourite ? 1 : 0.3, transition: 'opacity 0.15s' }}>
            <StarIcon filled={project.favourite} />
          </button>

          <CardBtn title="Open Folder" onClick={e => { e.stopPropagation(); window.api?.projects.openFolder(project.id) }}><FolderOpenIcon /></CardBtn>
          {project.github && (
            <CardBtn title={`github.com/${project.github}`} onClick={e => { e.stopPropagation(); window.api?.system.openExternal(`https://github.com/${project.github}`) }}>
              <GithubIcon />
            </CardBtn>
          )}

          {/* Open in IDE — visible button like Run */}
          <button
            onClick={() => window.api?.projects.openInIDE(project.id)}
            title={`Open in ${project.ide || 'VS Code'} (O)`}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12,
              fontWeight: 500, fontFamily: 'Geist, sans-serif',
              background: 'rgba(74,158,255,0.10)', color: '#4a9eff',
              transition: 'all 0.15s',
            }}>
            <IdeLogoIcon ide={project.ide || 'vscode'} /> Open IDE
          </button>

          {/* Pull button */}
          {isRepo && (
            <button
              onClick={handlePull}
              disabled={behindCount === 0 || pulling || syncLoading}
              title={syncLoading ? 'Checking remote…' : behindCount > 0 ? `Behind by ${behindCount} commit${behindCount > 1 ? 's' : ''}` : 'Up to date with remote'}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7,
                border: `1px solid ${behindCount > 0 ? 'rgba(74,255,145,0.35)' : 'var(--border)'}`,
                background: behindCount > 0 ? 'rgba(74,255,145,0.07)' : 'transparent',
                color: syncLoading ? 'var(--dimmer)' : behindCount > 0 ? '#4aff91' : 'var(--dimmer)',
                fontSize: 11, fontFamily: 'Geist, sans-serif',
                cursor: behindCount > 0 && !pulling && !syncLoading ? 'pointer' : 'default',
                transition: 'all 0.12s', flexShrink: 0,
              }}
            >
              {pulling
                ? <><Spinner size={10} /> Pulling…</>
                : syncLoading
                ? <><RefreshIcon /> Checking</>
                : behindCount > 0
                ? <><DownloadIcon /> Pull ↓{behindCount}</>
                : <><DownloadIcon /> Synced</>
              }
            </button>
          )}

          {/* Run/Stop split button */}
          <div style={{ display: 'flex', position: 'relative' }}>
            <button
              onClick={handleRun}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                borderRadius: runMenuOpen || (!isRunning && allScripts.length > 0) ? '7px 0 0 7px' : 7,
                border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'Geist, sans-serif',
                background: isRunning ? 'rgba(255,68,68,0.12)' : 'rgba(74,255,145,0.12)',
                color:      isRunning ? '#ff4444'              : '#4aff91',
                transition: 'all 0.15s',
              }}>
              {isRunning ? <><StopIcon /> Stop</> : <><PlayIcon /> Run</>}
            </button>
            {!isRunning && allScripts.length > 0 && (
              <button
                onClick={() => setRunMenuOpen(o => !o)}
                title="Pick script"
                style={{
                  display: 'flex', alignItems: 'center', padding: '6px 7px',
                  borderRadius: '0 7px 7px 0', borderLeft: '1px solid rgba(74,255,145,0.2)',
                  border: 'none', cursor: 'pointer', fontSize: 10,
                  background: 'rgba(74,255,145,0.12)', color: '#4aff91',
                  transition: 'all 0.15s',
                }}>
                ▾
              </button>
            )}
            {runMenuOpen && !isRunning && (
              <div style={{
                position: 'absolute', top: '110%', right: 0, zIndex: 60,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 9, padding: 4, minWidth: 180,
                boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
              }}
                onMouseLeave={() => setRunMenuOpen(false)}
              >
                <div style={{ fontSize: 9, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', padding: '4px 10px 6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  package.json scripts
                </div>
                {allScripts.slice(0, 12).map(s => (
                  <div key={s.name}
                    onClick={() => { handleRun(s.command); setRunMenuOpen(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 10px', borderRadius: 6, cursor: 'pointer', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--card)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontSize: 10, color: '#4aff91', flexShrink: 0 }}><PlayIcon /></span>
                    <span style={{ fontSize: 12, fontFamily: 'Geist Mono, monospace', color: 'var(--text)', flex: 1 }}>{s.name}</span>
                    <span style={{ fontSize: 9, color: 'var(--dimmer)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.command}</span>
                  </div>
                ))}
                {allScripts.length > 12 && (
                  <div style={{ fontSize: 10, color: 'var(--dimmer)', padding: '6px 10px', textAlign: 'center', fontFamily: 'Geist Mono, monospace' }}>
                    +{allScripts.length - 12} more in Terminal tab
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Project header ───────────────────────────────── */}
      <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ width: 50, height: 50, borderRadius: 12, background: project.emojiColor || 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
            {project.emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: 0, letterSpacing: -0.4 }}>{project.name}</h1>
              <VisBadge visibility={project.visibility} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.5, margin: '0 0 10px', maxWidth: 580 }}>
              {project.description || 'No description.'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: languages.length > 0 ? 10 : 0 }}>
              {(project.tags || []).map(tag => (
                <span key={tag} style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, background: 'var(--border)', color: 'var(--dim)', padding: '2px 7px', borderRadius: 4 }}>{tag}</span>
              ))}
            </div>
            {languages.length > 0 && (
              <div>
                <div style={{ height: 4, borderRadius: 10, overflow: 'hidden', display: 'flex', maxWidth: 360, background: 'var(--border)', marginBottom: 6 }}>
                  {languages.map((l, i) => <div key={i} style={{ width: `${l.pct}%`, height: '100%', background: l.color }} />)}
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  {languages.map(l => (
                    <div key={l.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--dim)' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: l.color }} />
                      {l.name} <span style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--dimmer)' }}>{l.pct}%</span>
                    </div>
                  ))}
                  <button onClick={async () => {
                    // Force rescan: clear cached languages then re-detect
                    await window.api.projects.edit(project.id, { languages: [] }).catch(() => {})
                    const fresh = await window.api.projects.detectLanguages(project.id).catch(() => [])
                    setLanguages(fresh || [])
                  }} title="Rescan languages"
                    style={{ fontSize: 10, color: 'var(--dimmer)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', opacity: 0.5, transition: 'opacity 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0.5}>
                    ↻
                  </button>
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0, textAlign: 'right' }}>
            <MetaItem label="IDE"         value={project.ide || '—'} />
            <MetaItem label="Branch"      value={gitStatus?.branch || 'main'} mono />
            <MetaItem label="Last commit" value={project.lastCommit || 'never'} />
            <MetaItem label="Times opened" value={`${project.meta?.openCount || 0}×`} />
          </div>
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────── */}
      <div style={{ display: 'flex', padding: '0 28px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, fontFamily: 'Geist, sans-serif', fontWeight: tab === t.id ? 500 : 400,
              color: tab === t.id ? (t.danger ? '#ff4444' : 'var(--text)') : t.danger ? 'rgba(255,68,68,0.45)' : 'var(--dim)',
              borderBottom: tab === t.id ? `2px solid ${t.danger ? '#ff4444' : 'var(--orange)'}` : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.12s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            {t.label}
            {t.badge != null && (
              <span style={{ fontSize: 9, fontFamily: 'Geist Mono, monospace', background: t.badgeStyle === 'green' ? 'rgba(74,255,145,0.15)' : 'rgba(255,107,53,0.15)', color: t.badgeStyle === 'green' ? '#4aff91' : 'var(--orange)', padding: '1px 5px', borderRadius: 3 }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div key={tab} className="pm-tab-content" style={{ maxWidth: 820, padding: '24px 28px' }}>

          {/* ─ OVERVIEW ─────────────────────────────────── */}
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="pm-grid-3">
                <StatCard label="Open Todos"    value={projectTodos.filter(t => !t.completed).length} color="var(--orange)" />
                <StatCard label="Notes"         value={projectNotes.length}                               color="var(--blue)"   />
                <StatCard label="Times Opened"  value={project.meta?.openCount || 0} color="var(--text)" />
              </div>

              <InfoSection label="Project Path">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
                  <span style={{ fontSize: 11, color: 'var(--dim)', fontFamily: 'Geist Mono, monospace', flex: 1, wordBreak: 'break-all' }}>
                    {project.paths?.projectRoot || '—'}
                  </span>
                  <CardBtn title="Open Folder" onClick={() => window.api?.projects.openFolder(project.id)}><FolderOpenIcon /></CardBtn>
                </div>
              </InfoSection>

              {project.github && (
                <InfoSection label="GitHub Repository">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
                    <span style={{ color: 'var(--dim)', display: 'flex', flexShrink: 0 }}><GithubIcon /></span>
                    <span style={{ fontSize: 12, color: 'var(--blue)', fontFamily: 'Geist Mono, monospace', flex: 1 }}>
                      github.com/{project.github}
                    </span>
                    <CardBtn title="Open on GitHub" onClick={() => window.api?.system.openExternal(`https://github.com/${project.github}`)}>
                      <ExternalLinkIcon />
                    </CardBtn>
                  </div>
                </InfoSection>
              )}

              <InfoSection label="Activity">
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  {[
                    { icon: '🕐', label: 'Last opened',  value: project.time || 'never'       },
                    { icon: '📦', label: 'Last commit',  value: project.lastCommit || 'never'  },
                    { icon: '📅', label: 'Created',      value: project.meta?.createdAt ? new Date(project.meta.createdAt).toLocaleDateString() : '—' },
                    { icon: '🗂️', label: 'Slug',        value: project.slug, mono: true        },
                  ].map((row, i, arr) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>{row.icon}</span>
                      <span style={{ fontSize: 11, color: 'var(--dimmer)', width: 110, flexShrink: 0 }}>{row.label}</span>
                      <span style={{ fontSize: 12, color: 'var(--dim)', fontFamily: row.mono ? 'Geist Mono, monospace' : 'Geist, sans-serif' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </InfoSection>

              {project.commands && Object.entries(project.commands).filter(([, v]) => v && typeof v === 'string').length > 0 && (
                <InfoSection label="Commands">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {Object.entries(project.commands).filter(([, v]) => v && typeof v === 'string').map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px' }}>
                        <span style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', color: 'var(--orange)', width: 44, flexShrink: 0 }}>{k}</span>
                        <span style={{ fontSize: 11, fontFamily: 'Geist Mono, monospace', color: 'var(--dim)', flex: 1 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </InfoSection>
              )}
            </div>
          )}

          {/* ─ GIT ──────────────────────────────────────── */}
          {tab === 'git' && (
            <GitPanel
              project={project} projectId={projectId} toast={toast}
              isRepo={isRepo} setIsRepo={setIsRepo} initingRepo={initingRepo} setInitingRepo={setInitingRepo}
              gitLoading={gitLoading} gitStatus={gitStatus} setGitStatus={setGitStatus} gitLog={gitLog} setGitLog={setGitLog}
              branches={branches} setBranches={setBranches}
              syncLoading={syncLoading} aheadBehind={aheadBehind} behindCount={behindCount} aheadCount={aheadCount} checkRemote={checkRemote}
              openDiff={openDiff} diffLoading={diffLoading} diffText={diffText} toggleDiff={toggleDiff}
              handleStageFiles={handleStageFiles} handleUnstageFiles={handleUnstageFiles}
              showCommit={showCommit} setShowCommit={setShowCommit} commitMsg={commitMsg} setCommitMsg={setCommitMsg}
              commitResult={commitResult} setCommitResult={setCommitResult} committing={committing} handleCommit={handleCommit}
              pulling={pulling} handlePull={handlePull} pushing={pushing} handlePush={handlePush}
              setPublishName={setPublishName} setPublishDesc={setPublishDesc} setPublishError={setPublishError} setPublishModal={setPublishModal}
              branchOp={branchOp} branchOpen={branchOpen} setBranchOpen={setBranchOpen} newBranch={newBranch} setNewBranch={setNewBranch}
              handleCreateBranch={handleCreateBranch} handleSwitchBranch={handleSwitchBranch}
            />
          )}

          {/* ─ TERMINAL ──────────────────────────────────── */}
          {/* Always mounted so scroll pos / custom cmd survive tab switches */}
          <div style={{ display: tab === 'terminal' ? 'block' : 'none' }}>
            {project && (
              <TerminalPanel
                output={termOutput}
                command={termCmd}
                isRunning={isRunning}
                project={project}
                allScripts={allScripts}
                runEnv={runEnv}
                onEnvChange={setRunEnv}
                onClear={() => setTermOutput([])}
                onRun={handleRun}
                onRefreshScripts={() => window.api?.projects.getScripts(project.id).then(s => setAllScripts(s || [])).catch(() => {})}
              />
            )}
          </div>

          {/* ─ DEPS ──────────────────────────────────────── */}
          {tab === 'deps' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {depsLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '40px 0' }}>
                  <Spinner size={14} />
                  <span style={{ fontSize: 12, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Reading dependencies…</span>
                </div>
              ) : !deps || deps.type === 'unknown' ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>📦</div>
                  <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 4 }}>No dependency file found</div>
                  <div style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
                    Expected package.json, requirements.txt, go.mod, or Cargo.toml
                  </div>
                  <button onClick={loadDeps} style={{ marginTop: 14, padding: '7px 16px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
                    Refresh
                  </button>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', padding: '3px 7px', borderRadius: 4, background: 'rgba(74,158,255,0.1)', color: '#4a9eff' }}>
                      {deps.type}
                    </span>
                    {deps.name && <span style={{ fontSize: 11, color: 'var(--dim)', fontFamily: 'Geist Mono, monospace' }}>{deps.name}@{deps.version}</span>}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      {deps.type === 'node' && (
                        <>
                          <DepsBtn
                            loading={depsOp === 'install'}
                            onClick={() => runDepsOp('install', () => window.api.projects.installDependencies(project.id))}
                          >
                            Install All
                          </DepsBtn>
                          <DepsBtn
                            loading={depsOp === 'update'}
                            onClick={() => runDepsOp('update', () => window.api.projects.updateDependencies(project.id))}
                          >
                            Update All
                          </DepsBtn>
                        </>
                      )}
                      <button onClick={loadDeps} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 11, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
                        Refresh
                      </button>
                    </div>
                  </div>

                  {/* Add dependency (Node only) */}
                  {deps.type === 'node' && (
                    <div style={{ display: 'flex', gap: 7, alignItems: 'center', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 12px' }}>
                      <input
                        value={addPkgInput}
                        onChange={e => setAddPkgInput(e.target.value)}
                        placeholder="package-name[@version]"
                        onKeyDown={e => {
                          if (e.key === 'Enter' && addPkgInput.trim()) {
                            runDepsOp(`add:${addPkgInput}`, () => window.api.projects.addDependency(project.id, addPkgInput.trim(), addPkgDev))
                            setAddPkgInput('')
                          }
                        }}
                        style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text)', fontFamily: 'Geist Mono, monospace' }}
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--dim)', cursor: 'pointer', flexShrink: 0 }}>
                        <input type="checkbox" checked={addPkgDev} onChange={e => setAddPkgDev(e.target.checked)} style={{ accentColor: 'var(--orange)' }} />
                        dev
                      </label>
                      <button
                        disabled={!addPkgInput.trim() || !!depsOp}
                        onClick={() => {
                          if (!addPkgInput.trim()) return
                          runDepsOp(`add:${addPkgInput}`, () => window.api.projects.addDependency(project.id, addPkgInput.trim(), addPkgDev))
                          setAddPkgInput('')
                        }}
                        style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: addPkgInput.trim() ? 'var(--orange)' : 'var(--dimmer)', color: '#fff', fontSize: 11, cursor: addPkgInput.trim() ? 'pointer' : 'not-allowed', fontFamily: 'Geist, sans-serif', flexShrink: 0 }}
                      >
                        + Add
                      </button>
                    </div>
                  )}

                  {/* Output */}
                  {(depsOp || depsOutput) && (
                    <div style={{ background: '#0a0a0a', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
                      {depsOp && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: depsOutput ? 8 : 0 }}>
                          <Spinner size={11} />
                          <span style={{ fontSize: 11, color: 'var(--orange)', fontFamily: 'Geist Mono, monospace' }}>
                            Running npm {depsOp.startsWith('add:') ? `install ${depsOp.slice(4)}` : depsOp}…
                          </span>
                        </div>
                      )}
                      {depsOutput && (
                        <pre style={{ fontSize: 10, color: 'var(--dim)', fontFamily: 'Geist Mono, monospace', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 160, overflowY: 'auto' }}>
                          {depsOutput}
                        </pre>
                      )}
                    </div>
                  )}

                  {/* Dep sections */}
                  {[
                    { key: 'dependencies',     label: 'Dependencies' },
                    { key: 'devDependencies',  label: 'Dev Dependencies' },
                    { key: 'peerDependencies', label: 'Peer Dependencies' },
                  ].map(({ key, label }) => {
                    const entries = Object.entries(deps[key] || {})
                    if (!entries.length) return null
                    return (
                      <InfoSection key={key} label={`${label} (${entries.length})`}>
                        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                          {entries.map(([pkg, ver], i) => (
                            <div key={pkg} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none' }}>
                              <span style={{ fontSize: 12, color: 'var(--text)', flex: 1, fontFamily: 'Geist Mono, monospace' }}>{pkg}</span>
                              <span style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', flexShrink: 0 }}>{String(ver).slice(0, 20)}</span>
                              {deps.type === 'node' && (
                                <button
                                  disabled={!!depsOp}
                                  onClick={() => runDepsOp(`remove:${pkg}`, () => window.api.projects.removeDependency(project.id, pkg))}
                                  style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(255,68,68,0.2)', background: 'rgba(255,68,68,0.06)', color: '#ff5555', fontSize: 10, cursor: depsOp ? 'not-allowed' : 'pointer', fontFamily: 'Geist, sans-serif', flexShrink: 0, opacity: depsOp ? 0.5 : 1 }}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </InfoSection>
                    )
                  })}
                </>
              )}
            </div>
          )}

          {/* ─ FILES ─────────────────────────────────────────── */}
          {tab === 'files' && (
            <div>
              {fileLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '40px 0' }}>
                  <Spinner size={14} />
                  <span style={{ fontSize: 12, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Reading files…</span>
                </div>
              ) : !fileTree || fileTree.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>📂</div>
                  <div style={{ fontSize: 13, color: 'var(--dim)' }}>Project folder is empty</div>
                  <div style={{ fontSize: 11, color: 'var(--dimmer)', marginTop: 4, fontFamily: 'Geist Mono, monospace' }}>{project.paths?.projectRoot}</div>
                  <button onClick={loadFiles} style={{ marginTop: 14, padding: '7px 16px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>Refresh</button>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>{project.paths?.projectRoot}</span>
                    <button onClick={loadFiles} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 11, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>Refresh</button>
                  </div>
                  <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', fontFamily: 'Geist Mono, monospace' }}>
                    <FileTreeNodes nodes={fileTree} depth={0} expanded={expanded} setExpanded={setExpanded} onOpenFile={p => window.api?.system.openPath(p)} onContextMenu={(e, entry) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, entry }) }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─ TODOS ─────────────────────────────────────── */}
          {tab === 'todos' && (
            <div>
              {/* Add todo inline */}
              <div style={{ background: addingTodo ? 'var(--card)' : 'transparent', border: `1px solid ${addingTodo ? 'var(--orange)' : 'var(--border)'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 14, height: 14, borderRadius: 4, border: '1px solid var(--border-bright)', flexShrink: 0 }} />
                <input
                  value={todoInput}
                  onChange={e => setTodoInput(e.target.value)}
                  onFocus={() => setAddingTodo(true)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter' && todoInput.trim() && window.api) {
                      const created = await window.api.todos.create({ title: todoInput.trim(), projectId: project.id, priority: todoPriority, emoji: todoEmoji || undefined, noteId: todoNoteId || undefined }).catch(console.error)
                      if (created) {
                        setProjectTodos(prev => [created, ...prev])
                        window.dispatchEvent(new CustomEvent('croco:data-changed'))
                      }
                      setTodoInput(''); setTodoPriority('med'); setTodoEmoji(''); setEmojiPickerOpen(false); setAddingTodo(false); setTodoNoteId(null); setTodoNotePicker(false)
                    }
                    if (e.key === 'Escape') { setTodoInput(''); setTodoEmoji(''); setEmojiPickerOpen(false); setAddingTodo(false); setTodoNoteId(null); setTodoNotePicker(false) }
                  }}
                  placeholder="Add a task… (Enter to save)"
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)', fontFamily: 'Geist, sans-serif' }}
                />
                {addingTodo && (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                    {/* Emoji picker */}
                    <div style={{ position: 'relative' }}>
                      <button onClick={() => setEmojiPickerOpen(o => !o)} title="Add icon"
                        style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${todoEmoji ? 'var(--border-bright)' : 'transparent'}`, background: todoEmoji ? 'var(--border)' : 'transparent', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                        {todoEmoji || '🏷️'}
                      </button>
                      {emojiPickerOpen && (
                        <div style={{ position: 'absolute', right: 0, top: '120%', zIndex: 60, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: 8, display: 'flex', flexWrap: 'wrap', gap: 3, width: 184, boxShadow: '0 8px 28px rgba(0,0,0,0.45)' }}>
                          {['','✅','🐛','⚡','💡','🔥','📌','🔗','🎯','⚙️','🧪','📊','🔐','🌐','📱','🎨','🛠️','💬','🚀','📝'].map(e => (
                            <button key={e || 'none'} onClick={() => { setTodoEmoji(e); setEmojiPickerOpen(false) }}
                              style={{ width: 26, height: 26, borderRadius: 5, border: `1px solid ${todoEmoji === e ? 'var(--border-bright)' : 'transparent'}`, background: todoEmoji === e ? 'var(--border)' : 'transparent', cursor: 'pointer', fontSize: e ? 14 : 10, color: e ? undefined : 'var(--dimmer)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                              {e || '—'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {[['high','🔴'],['med','🟡'],['low','🟢']].map(([p, icon]) => (
                      <button key={p} onClick={() => setTodoPriority(p)} title={p}
                        style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${todoPriority === p ? 'var(--border-bright)' : 'transparent'}`, background: todoPriority === p ? 'var(--border)' : 'transparent', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                        {icon}
                      </button>
                    ))}
                    {/* Note link picker */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <button
                        title={todoNoteId ? `Linked: ${projectNotes.find(n => n.id === todoNoteId)?.title}` : 'Link to a note'}
                        onClick={() => setTodoNotePicker(p => !p)}
                        style={{ padding: '2px 7px', borderRadius: 5, border: `1px solid ${todoNoteId ? 'rgba(74,158,255,0.4)' : 'transparent'}`, background: todoNoteId ? 'rgba(74,158,255,0.1)' : 'transparent', cursor: 'pointer', fontSize: 12, color: todoNoteId ? '#4a9eff' : 'var(--dimmer)' }}
                      >🔗</button>
                      {todoNotePicker && (
                        <div style={{ position: 'absolute', right: 0, top: '120%', zIndex: 50, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: 6, minWidth: 200, boxShadow: '0 8px 28px rgba(0,0,0,0.45)' }}>
                          {[{ id: null, title: '— None', emoji: '' }, ...projectNotes].map(n => (
                            <button key={n.id || 'none'} onClick={() => { setTodoNoteId(n.id); setTodoNotePicker(false) }}
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 6, border: 'none', background: todoNoteId === n.id ? 'var(--card)' : 'transparent', cursor: 'pointer', color: 'var(--text)', fontSize: 11, fontFamily: 'Geist, sans-serif' }}>
                              {n.emoji && <span style={{ marginRight: 6 }}>{n.emoji}</span>}{n.title}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {addingTodo && todoInput && (
                  <button
                    onClick={async () => {
                      if (!todoInput.trim() || !window.api) return
                      const created = await window.api.todos.create({ title: todoInput.trim(), projectId: project.id, priority: todoPriority, emoji: todoEmoji || undefined, noteId: todoNoteId || undefined }).catch(console.error)
                      if (created) {
                        setProjectTodos(prev => [created, ...prev])
                        window.dispatchEvent(new CustomEvent('croco:data-changed'))
                      }
                      setTodoInput(''); setTodoPriority('med'); setTodoEmoji(''); setEmojiPickerOpen(false); setAddingTodo(false); setTodoNoteId(null); setTodoNotePicker(false)
                    }}
                    style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#000', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Geist, sans-serif', flexShrink: 0 }}
                  >
                    Add
                  </button>
                )}
              </div>

              {projectTodos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 0' }}>
                  <div style={{ fontSize: 30, marginBottom: 10 }}>✅</div>
                  <div style={{ fontSize: 13, color: 'var(--dim)' }}>No tasks for this project yet</div>
                  <div style={{ fontSize: 11, color: 'var(--dimmer)', marginTop: 4 }}>Type above to add one</div>
                </div>
              ) : (
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                  {projectTodos.map((todo, i) => {
                    const locked = isTodoLocked(todo)
                    return (
                    <div
                      key={todo.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderBottom: i === projectTodos.length - 1 ? 'none' : '1px solid var(--border)' }}
                    >
                      <button
                        onClick={async () => {
                          if (locked) return
                          const updated = await window.api.todos.toggle(todo.id).catch(console.error)
                          if (updated) {
                            setProjectTodos(prev => prev.map(t => t.id === todo.id ? updated : t))
                            window.dispatchEvent(new CustomEvent('croco:data-changed'))
                          }
                        }}
                        title={locked ? 'Completed more than 6 days ago — cannot be reversed' : undefined}
                        style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: todo.completed ? 'none' : '1px solid var(--border-bright)', background: todo.completed ? '#4aff91' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.65 : 1, fontSize: 9, color: '#000', transition: 'all 0.15s' }}
                      >
                        {todo.completed ? '✓' : ''}
                      </button>
                      <span style={{ flex: 1, fontSize: 12, color: todo.completed ? 'var(--dimmer)' : 'var(--text)', textDecoration: todo.completed ? 'line-through' : 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                        {todo.emoji && <span style={{ fontSize: 13, flexShrink: 0 }}>{todo.emoji}</span>}
                        {todo.title}
                      </span>
                      {/* Linked note chip */}
                      {todo.linkedNoteId && (() => {
                        const ln = projectNotes.find(n => n.id === todo.linkedNoteId)
                        return ln ? (
                          <button
                            onClick={() => navigate(`/note-editor/${ln.id}`)}
                            title={`Linked note: ${ln.title}`}
                            style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', padding: '2px 7px', borderRadius: 4, background: 'rgba(74,158,255,0.1)', color: '#4a9eff', border: '1px solid rgba(74,158,255,0.2)', cursor: 'pointer', flexShrink: 0, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            🔗 {ln.title}
                          </button>
                        ) : null
                      })()}
                      <span style={{ fontSize: 9, fontFamily: 'Geist Mono, monospace', padding: '2px 5px', borderRadius: 3, background: todo.priority === 'high' ? 'rgba(255,68,68,0.12)' : todo.priority === 'med' ? 'rgba(255,215,0,0.1)' : 'rgba(74,255,145,0.1)', color: todo.priority === 'high' ? '#ff4444' : todo.priority === 'med' ? '#ffd700' : '#4aff91' }}>{todo.priority}</span>
                      {/* Link to note button */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <button
                          title="Link to a note"
                          onClick={() => setLinkingTodoId(linkingTodoId === todo.id ? null : todo.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: todo.linkedNoteId ? '#4a9eff' : 'var(--dimmer)', fontSize: 12, padding: '0 2px', opacity: 0.7, transition: 'opacity 0.12s' }}
                          onMouseEnter={e => e.currentTarget.style.opacity = 1}
                          onMouseLeave={e => e.currentTarget.style.opacity = 0.7}
                        >🔗</button>
                        {linkingTodoId === todo.id && (
                          <div style={{ position: 'absolute', right: 0, top: '120%', zIndex: 50, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: 6, minWidth: 200, boxShadow: '0 8px 28px rgba(0,0,0,0.45)' }}>
                            <div style={{ fontSize: 10, color: 'var(--dimmer)', padding: '2px 6px 6px', fontFamily: 'Geist Mono, monospace' }}>Link to note</div>
                            {projectNotes.length === 0 ? (
                              <div style={{ fontSize: 11, color: 'var(--dimmer)', padding: '6px 8px' }}>No notes for this project</div>
                            ) : [{ id: null, title: '— None', emoji: '' }, ...projectNotes].map(n => (
                              <div key={n.id || 'none'}
                                onClick={async () => {
                                  const updated = await window.api.todos.update(todo.id, { linkedNoteId: n.id }).catch(console.error)
                                  if (updated) {
                                    setProjectTodos(prev => prev.map(t => t.id === todo.id ? updated : t))
                                    window.dispatchEvent(new CustomEvent('croco:data-changed'))
                                  }
                                  setLinkingTodoId(null)
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: todo.linkedNoteId === n.id ? '#4a9eff' : 'var(--text)', background: todo.linkedNoteId === n.id ? 'rgba(74,158,255,0.08)' : 'transparent', transition: 'background 0.1s' }}
                                onMouseEnter={e => { if (todo.linkedNoteId !== n.id) e.currentTarget.style.background = 'var(--card)' }}
                                onMouseLeave={e => { if (todo.linkedNoteId !== n.id) e.currentTarget.style.background = 'transparent' }}
                              >
                                <span>{n.emoji}</span>
                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={async () => {
                          await window.api.todos.delete(todo.id).catch(console.error)
                          setProjectTodos(prev => prev.filter(t => t.id !== todo.id))
                          window.dispatchEvent(new CustomEvent('croco:data-changed'))
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', fontSize: 13, lineHeight: 1, padding: '0 2px', flexShrink: 0, opacity: 0.5, transition: 'opacity 0.12s' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = 1}
                        onMouseLeave={e => e.currentTarget.style.opacity = 0.5}
                      >
                        ×
                      </button>
                    </div>
                  )})}
                </div>
              )}
            </div>
          )}

          {/* ─ NOTES ─────────────────────────────────────── */}
          {tab === 'notes' && (
            <div>
              <button
                onClick={() => navigate('/note-editor', { state: { projectId: project.id } })}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'Geist, sans-serif', marginBottom: 16, transition: 'all 0.12s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--orange)'; e.currentTarget.style.color = 'var(--orange)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--dim)' }}
              >
                + New Note for this project
              </button>

              {projectNotes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 0' }}>
                  <div style={{ fontSize: 30, marginBottom: 10 }}>📝</div>
                  <div style={{ fontSize: 13, color: 'var(--dim)' }}>No notes for this project yet</div>
                  <div style={{ fontSize: 11, color: 'var(--dimmer)', marginTop: 4 }}>Click above to create one</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[...projectNotes]
                    .sort((a, b) => {
                      const ap = pinnedNoteIds.includes(a.id) ? 0 : 1
                      const bp = pinnedNoteIds.includes(b.id) ? 0 : 1
                      return ap - bp
                    })
                    .map(note => {
                      const pinned = pinnedNoteIds.includes(note.id)
                      return (
                        <div
                          key={note.id}
                          className="note-row"
                          onClick={() => navigate(`/note-editor/${note.id}`)}
                          style={{ background: pinned ? 'rgba(74,158,255,0.05)' : 'var(--card)', border: `1px solid ${pinned ? 'rgba(74,158,255,0.2)' : 'var(--border)'}`, borderRadius: 10, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.12s', position: 'relative' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = pinned ? 'rgba(74,158,255,0.4)' : 'var(--border-bright)'; e.currentTarget.style.background = pinned ? 'rgba(74,158,255,0.08)' : 'var(--card-hover)' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = pinned ? 'rgba(74,158,255,0.2)' : 'var(--border)'; e.currentTarget.style.background = pinned ? 'rgba(74,158,255,0.05)' : 'var(--card)' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 14 }}>{note.emoji || '📝'}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.title}</span>
                            {pinned && <span style={{ fontSize: 9, color: 'var(--accent)', fontFamily: 'Geist Mono, monospace' }}>PINNED</span>}
                            <button
                              onClick={e => { e.stopPropagation(); togglePinNote(note.id) }}
                              title={pinned ? 'Unpin' : 'Pin to top'}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, opacity: pinned ? 1 : 0, padding: '0 2px', color: pinned ? 'var(--accent)' : 'var(--dimmer)', flexShrink: 0, transition: 'opacity 0.1s' }}
                              className="note-pin-btn"
                            >
                              📌
                            </button>
                            <span style={{ fontSize: 9, fontFamily: 'Geist Mono, monospace', color: 'var(--dimmer)', flexShrink: 0 }}>{note.time}</span>
                          </div>
                          {note.preview && (
                            <div style={{ fontSize: 11, color: 'var(--dimmer)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.preview}</div>
                          )}
                        </div>
                      )
                    })
                  }
                </div>
              )}
            </div>
          )}

          {/* ─ README ───────────────────────────────────── */}
          {tab === 'readme' && (
            <div>
              {readmeLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '40px 0' }}>
                  <Spinner size={14} />
                  <span style={{ fontSize: 12, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Loading README…</span>
                </div>
              ) : readme === false || !readme ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>📄</div>
                  <div style={{ fontSize: 13, color: 'var(--dim)' }}>No README found</div>
                  <div style={{ fontSize: 11, color: 'var(--dimmer)', marginTop: 4, fontFamily: 'Geist Mono, monospace' }}>Add a README.md to your project root</div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 11, fontFamily: 'Geist Mono, monospace', color: 'var(--dimmer)', background: 'var(--border)', padding: '3px 8px', borderRadius: 4 }}>
                      {readme.filename}
                    </span>
                  </div>
                  <div
                    className="markdown-body"
                    style={{
                      fontSize: 13, lineHeight: 1.7, color: 'var(--text)',
                      '--md-code-bg': 'var(--card)',
                    }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(readme.content) }}
                  />
                </div>
              )}
            </div>
          )}

          {/* ─ SETTINGS ──────────────────────────────────── */}
          {tab === 'settings' && editDraft && (() => {
            const COMMON_EMOJIS = [
              '📁','🚀','⚡','🔥','💡','🛠️','🎯','🌟','💎','🏗️','🎮','🤖',
              '🧪','📊','🔐','🌐','📱','🎨','⚙️','🧠','🔮','🏆','🦾','🌈',
              '🎵','🛡️','🔭','🧩','🌿','🦊','💀','☠️','🩵','🎁','☕','🧾',
              '🔖','📑','📗','📘','📙','🐙','🦋','🌊','❄️','🌙','🎁','🔴',
            ]
            const IDE_OPTIONS = [
              { value: 'code',      label: 'VS Code' },
              { value: 'cursor',    label: 'Cursor' },
              { value: 'webstorm',  label: 'WebStorm' },
              { value: 'idea',      label: 'IntelliJ IDEA' },
              { value: 'zed',       label: 'Zed' },
              { value: 'sublime',   label: 'Sublime Text' },
              { value: 'vim',       label: 'Vim' },
              { value: 'nvim',      label: 'Neovim' },
            ]
            const labelStyle = { fontSize: 10, fontFamily: 'Geist Mono, monospace', color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: '0.06em' }
            const inputStyle = { width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 11px', color: 'var(--text)', fontSize: 13, fontFamily: 'Geist, sans-serif', outline: 'none', transition: 'border-color 0.15s' }
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

                {/* Emoji picker */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={labelStyle}>Project Icon</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 36, width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }}>
                      {editDraft.emoji}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flex: 1 }}>
                      {COMMON_EMOJIS.map(e => (
                        <button key={e} onClick={() => setEditDraft(d => ({ ...d, emoji: e }))}
                          style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, borderRadius: 6, cursor: 'pointer', background: editDraft.emoji === e ? 'var(--border-bright)' : 'var(--card)', border: `1px solid ${editDraft.emoji === e ? 'var(--border-bright)' : 'var(--border)'}`, transition: 'background 0.1s' }}>
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Name */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={labelStyle}>Name</div>
                  <input value={editDraft.name} onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))}
                    style={inputStyle} placeholder="Project name"
                    onFocus={e => e.target.style.borderColor = 'var(--border-bright)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                </div>

                {/* Description */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={labelStyle}>Description</div>
                  <textarea value={editDraft.description} onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))}
                    rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }} placeholder="Short description"
                    onFocus={e => e.target.style.borderColor = 'var(--border-bright)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                </div>

                {/* IDE + Visibility */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={labelStyle}>Default IDE</div>
                    <select value={editDraft.ide} onChange={e => setEditDraft(d => ({ ...d, ide: e.target.value }))}
                      style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="">— None —</option>
                      {IDE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={labelStyle}>Visibility</div>
                    <select value={editDraft.visibility} onChange={e => setEditDraft(d => ({ ...d, visibility: e.target.value }))}
                      style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="public">Public</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </div>
                </div>

                {/* Shell */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={labelStyle}>Terminal Shell</div>
                  <select value={editDraft.shell || ''} onChange={e => setEditDraft(d => ({ ...d, shell: e.target.value }))}
                    style={{ ...inputStyle, cursor: 'pointer' }}>
                    {(platform === 'win32' ? SHELL_OPTS_WIN : SHELL_OPTS_UNIX).map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {/* GitHub URL */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={labelStyle}>GitHub Repository</div>
                  <input value={editDraft.github} onChange={e => setEditDraft(d => ({ ...d, github: e.target.value }))}
                    style={inputStyle} placeholder="https://github.com/user/repo"
                    onFocus={e => e.target.style.borderColor = 'var(--border-bright)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                </div>

                {/* Tags */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={labelStyle}>Tags</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                    {editDraft.tags.map(tag => (
                      <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 5, background: 'rgba(74,158,255,0.1)', border: '1px solid rgba(74,158,255,0.2)', color: '#4a9eff', fontSize: 11, fontFamily: 'Geist Mono, monospace' }}>
                        {tag}
                        <button onClick={() => setEditDraft(d => ({ ...d, tags: d.tags.filter(t => t !== tag) }))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a9eff', opacity: 0.7, fontSize: 12, lineHeight: 1, padding: 0 }}>×</button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => {
                        if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                          e.preventDefault()
                          const t = tagInput.trim().replace(/,/g, '')
                          if (t && !editDraft.tags.includes(t)) setEditDraft(d => ({ ...d, tags: [...d.tags, t] }))
                          setTagInput('')
                        }
                      }}
                      style={{ ...inputStyle, flex: 1 }} placeholder="Add tag, press Enter"
                      onFocus={e => e.target.style.borderColor = 'var(--border-bright)'}
                      onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                    <button onClick={() => {
                        const t = tagInput.trim()
                        if (t && !editDraft.tags.includes(t)) { setEditDraft(d => ({ ...d, tags: [...d.tags, t] })); setTagInput('') }
                      }}
                      style={{ padding: '8px 14px', borderRadius: 7, background: 'var(--border)', border: 'none', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}>Add</button>
                  </div>
                </div>

                {/* Commands */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={labelStyle}>NPM / Run Commands</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {['dev', 'build', 'start', 'test'].map(k => (
                      <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>{k}</div>
                        <input value={editDraft.commands[k]} onChange={e => setEditDraft(d => ({ ...d, commands: { ...d.commands, [k]: e.target.value } }))}
                          style={{ ...inputStyle, fontSize: 12, fontFamily: 'Geist Mono, monospace' }} placeholder={`npm run ${k}`}
                          onFocus={e => e.target.style.borderColor = 'var(--border-bright)'}
                          onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Save */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
                  <button
                    disabled={editSaving}
                    onClick={async () => {
                      setEditSaving(true)
                      try {
                        let updated
                        if (editDraft.name !== project.name) {
                          updated = await window.api.projects.rename(project.id, editDraft.name)
                        }
                        const rest = { ...editDraft }
                        if (editDraft.name !== project.name) delete rest.name
                        updated = await window.api.projects.edit(project.id, rest)
                        if (updated) { setProject(updated); toast.success('Project settings saved') }
                        else toast.error('Save failed')
                      } catch (err) { toast.error(err?.message || 'Save failed') }
                      finally { setEditSaving(false) }
                    }}
                    style={{ padding: '9px 22px', borderRadius: 8, background: editSaving ? 'var(--border)' : 'var(--orange)', border: 'none', color: editSaving ? 'var(--dim)' : '#fff', fontSize: 13, fontWeight: 600, cursor: editSaving ? 'default' : 'pointer', transition: 'background 0.15s' }}>
                    {editSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )
          })()}

          {/* ─ DANGER ────────────────────────────────────── */}
          {tab === 'danger' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ padding: '11px 15px', borderRadius: 8, background: 'rgba(255,68,68,0.06)', border: '1px solid rgba(255,68,68,0.18)', fontSize: 11, color: '#ff6666', fontFamily: 'Geist Mono, monospace', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangleIcon /> Actions on this page cannot be undone. Proceed carefully.
              </div>

              {/* Pull from repo — greyed when in sync */}
              {isRepo && (
                <DangerRow
                  title="Pull from Repository"
                  desc={behindCount > 0
                    ? `Your local copy is ${behindCount} commit${behindCount > 1 ? 's' : ''} behind the remote. Click to pull the latest changes.`
                    : 'Your local copy is up to date with the remote. Nothing to pull.'}
                  action={pulling ? 'Pulling…' : behindCount > 0 ? `Pull (↓ ${behindCount})` : 'Up to date'}
                  actionDisabled={behindCount === 0 || pulling}
                  color="#4aff91"
                  onClick={handlePull}
                />
              )}

              {/* Toggle visibility */}
              <DangerRow
                title={project.visibility === 'hidden' ? 'Make Project Public' : 'Make Project Private'}
                desc={project.visibility === 'hidden'
                  ? 'Change visibility to public. The project folder location on disk will not be moved.'
                  : 'Change visibility to hidden/private. The project folder location on disk will not be moved.'}
                action={project.visibility === 'hidden' ? 'Make Public' : 'Make Private'}
                color="var(--blue)"
                onClick={() => openModal({
                  title: project.visibility === 'hidden' ? 'Make Project Public?' : 'Make Project Private?',
                  desc: 'This updates the visibility metadata only. The folder on disk will not move.',
                  confirmLabel: project.visibility === 'hidden' ? 'Make Public' : 'Make Private',
                  onConfirm: async () => {
                    const newVis = project.visibility === 'public' ? 'hidden' : 'public'
                    const u = await window.api.projects.edit(project.id, { visibility: newVis })
                    setProject(u)
                  },
                })}
              />

              {/* Remove GitHub repo */}
              <DangerRow
                title="Remove GitHub Repository"
                desc={project.github
                  ? `Permanently deletes github.com/${project.github}. Your local files are unaffected. Uses your GitHub API token — 2FA is not required for token-based API calls.`
                  : 'No GitHub repository is linked to this project.'}
                action="Delete on GitHub"
                actionDisabled={!project.github}
                color="var(--red)"
                onClick={() => openModal({
                  title: 'Delete GitHub Repository?',
                  desc: `This permanently deletes github.com/${project.github} from GitHub.\n\nYour local project files will not be touched.\n\nMake sure your GitHub token (in Settings → User) has the delete_repo scope.`,
                  warning: '2FA is not required — token auth is used directly via the GitHub API.',
                  confirmLabel: 'Delete Repository',
                  confirmRed: true,
                  requireTyping: project.name,
                  onConfirm: async () => {
                    const u = await window.api.projects.deleteGithubRepo(project.id)
                    setProject(u)
                  },
                })}
              />

              {/* Remove local files */}
              <DangerRow
                title="Remove Local Files"
                desc="Deletes all project files from your drive. Your project entry is preserved here so you can pull from the repository later."
                action="Remove Files"
                color="var(--red)"
                onClick={() => openModal({
                  title: 'Remove Local Files?',
                  desc: `All files in:\n${project.paths?.projectRoot}\nwill be permanently deleted.\n\nYour project entry stays in Croco so you can pull from GitHub later.`,
                  confirmLabel: 'Remove Local Files',
                  confirmRed: true,
                  onConfirm: async () => {
                    await window.api.projects.removeLocalFiles(project.id)
                    setIsRepo(false); setGitStatus(null); setGitLog([])
                  },
                })}
              />

              {/* Archive project */}
              <DangerRow
                title={project.archived ? 'Unarchive Project' : 'Archive Project'}
                desc={project.archived
                  ? 'Restore this project to the active list. No files are moved or deleted.'
                  : 'Hide this project from the main list. It can be restored at any time from the archived view. No files are moved or deleted.'}
                action={project.archived ? 'Unarchive' : 'Archive'}
                color="var(--purple)"
                onClick={() => openModal({
                  title: project.archived ? 'Unarchive Project?' : 'Archive Project?',
                  desc: project.archived
                    ? 'This project will appear in your active project list again.'
                    : 'This project will be hidden from the main list. You can restore it anytime.',
                  confirmLabel: project.archived ? 'Unarchive' : 'Archive',
                  onConfirm: async () => {
                    const u = await window.api.projects.setArchived(project.id, !project.archived)
                    if (u) setProject(u)
                  },
                })}
              />

              {/* Remove everywhere — nuclear */}
              <DangerRow
                title="Remove Everywhere"
                desc="Permanently deletes local project files, the GitHub repository (if linked), and this project entry from Croco. This cannot be undone."
                action="Delete Everything"
                color="var(--red)"
                nuclear
                onClick={() => openModal({
                  title: 'Delete Everything?',
                  desc: `This will permanently:\n• Delete all local files at ${project.paths?.projectRoot}\n${project.github ? `• Delete github.com/${project.github}\n` : ''}• Remove this project entry from Croco`,
                  warning: 'THIS ACTION CANNOT BE UNDONE.',
                  confirmLabel: 'Delete Everything',
                  confirmRed: true,
                  requireTyping: project.name,
                  onConfirm: async () => {
                    if (project.github) await window.api.projects.deleteGithubRepo(project.id).catch(() => {})
                    await window.api.projects.removeLocalFiles(project.id).catch(() => {})
                    await window.api.projects.delete(project.id)
                    window.dispatchEvent(new CustomEvent('croco:data-changed'))
                    navigate('/projects')
                  },
                })}
              />
            </div>
          )}

        </div>
      </div>

      {/* ── Confirm modal ────────────────────────────────── */}
      {modal && (
        <ConfirmModal
          modal={modal}
          input={modalInput}
          onInput={setModalInput}
          loading={modalLoading}
          error={modalError}
          onConfirm={runModal}
          onCancel={() => setModal(null)}
        />
      )}

      {/* ── Publish to GitHub modal ──────────────────────── */}
      {publishModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget && !publishLoading) setPublishModal(false) }}
        >
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px', maxWidth: 420, width: '90%', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <GithubIcon />
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Publish to GitHub</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--dimmer)', marginBottom: 4 }}>Repository name</div>
                <input value={publishName} onChange={e => setPublishName(e.target.value)}
                  style={{ width: '100%', background: 'var(--base)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 13, color: 'var(--text)', fontFamily: 'Geist Mono, monospace', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--dimmer)', marginBottom: 4 }}>Description (optional)</div>
                <input value={publishDesc} onChange={e => setPublishDesc(e.target.value)}
                  style={{ width: '100%', background: 'var(--base)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 13, color: 'var(--text)', fontFamily: 'Geist, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="pub-priv" checked={publishPrivate} onChange={e => setPublishPrivate(e.target.checked)} />
                <label htmlFor="pub-priv" style={{ fontSize: 12, color: 'var(--dim)', cursor: 'pointer', userSelect: 'none' }}>Private repository</label>
              </div>
              {publishError && (
                <div style={{ fontSize: 11, color: '#ff5555', background: 'rgba(255,68,68,0.07)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: 6, padding: '8px 12px', fontFamily: 'Geist Mono, monospace' }}>
                  {publishError}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setPublishModal(false)} disabled={publishLoading}
                style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                disabled={!publishName.trim() || publishLoading}
                onClick={async () => {
                  setPublishLoading(true)
                  setPublishError('')
                  try {
                    const result = await window.api.projects.publishToGithub(projectId, publishName.trim(), publishDesc.trim(), publishPrivate)
                    toast.show({ title: 'Published!', body: `Repository created at ${result.url}`, type: 'success' })
                    setPublishModal(false)
                    setAheadBehind(null)
                    checkRemote()
                  } catch (e) {
                    setPublishError(e?.message || String(e))
                  } finally {
                    setPublishLoading(false)
                  }
                }}
                style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: publishName.trim() && !publishLoading ? '#24292e' : 'var(--dimmer)', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'Geist, sans-serif', cursor: publishName.trim() && !publishLoading ? 'pointer' : 'not-allowed' }}>
                {publishLoading ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── File context menu ────────────────────────────── */}
      {ctxMenu && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300 }}
          onClick={() => setCtxMenu(null)}
          onContextMenu={e => { e.preventDefault(); setCtxMenu(null) }}
        >
          <div style={{
            position: 'fixed', left: ctxMenu.x, top: ctxMenu.y,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '4px 0', minWidth: 180,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 301,
          }}>
            <button
              onClick={async () => {
                setCtxMenu(null)
                try {
                  await window.api.git.addToGitignore(projectId, ctxMenu.entry)
                  toast.show({ title: 'Added to .gitignore', body: ctxMenu.entry, type: 'success' })
                  loadFiles()
                } catch (e) {
                  toast.show({ title: 'Failed', body: e?.message || String(e), type: 'error' })
                }
              }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px',
                background: 'none', border: 'none', color: 'var(--dim)', fontSize: 12,
                fontFamily: 'Geist, sans-serif', cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              Add to .gitignore
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

