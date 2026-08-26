import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshIcon, TrashIcon, ActivityIcon, GithubIcon, PlayIcon, StopIcon, FolderIcon, IDEIcon, CheckCircleIcon, NoteIcon2, PaletteIcon, ClockIcon } from '../constants/SimpleSvgExports'

// Group-based filter — each group maps to one or more event types
const FILTER_GROUPS = [
  { label: 'All',      icon: '⚡', types: null },
  { label: 'Projects', icon: '📁', types: ['project.created', 'project.imported', 'project.updated', 'project.deleted'] },
  { label: 'Git',      icon: '⑂',  types: ['git.committed', 'git.tag_created', 'github.release_created'] },
  { label: 'Runs',     icon: '▶',  types: ['run.started', 'run.finished', 'ide.opened'] },
  { label: 'Todos',    icon: '✓',  types: ['todo.created', 'todo.completed', 'todo.reverted', 'todo.deleted', 'todo.edited'] },
  { label: 'Schedules', icon: '🕐', types: ['schedule.created', 'schedule.completed', 'schedule.reverted', 'schedule.deleted', 'schedule.edited'] },
  { label: 'Notes',    icon: '📝', types: ['note.created', 'note.deleted', 'note.archived', 'note.unarchived'] },
  { label: 'Settings', icon: '⚙',  types: ['setting.github', 'setting.profile'] },
]

const EVENT_META = {
  'project.created':  { label: 'Created project',   color: '#4a9eff', bg: 'rgba(74,158,255,0.08)',  icon: <FolderIcon /> },
  'project.imported': { label: 'Imported project',  color: '#a855f7', bg: 'rgba(168,85,247,0.08)',  icon: <FolderIcon /> },
  'project.updated':  { label: 'Project updated',   color: '#4a9eff', bg: 'rgba(74,158,255,0.06)',  icon: <FolderIcon /> },
  'project.deleted':  { label: 'Project deleted',   color: '#ff4444', bg: 'rgba(255,68,68,0.08)',   icon: <FolderIcon /> },
  'git.committed':    { label: 'Committed',          color: '#4aff91', bg: 'rgba(74,255,145,0.08)',  icon: <GithubIcon /> },
  'git.tag_created':  { label: 'Tag created',         color: '#4a9eff', bg: 'rgba(74,158,255,0.08)',  icon: <GithubIcon /> },
  'github.release_created': { label: 'Release published', color: '#a855f7', bg: 'rgba(168,85,247,0.08)', icon: <GithubIcon /> },
  'run.started':      { label: 'Process started',    color: '#ff6b35', bg: 'rgba(255,107,53,0.08)',  icon: <PlayIcon />   },
  'run.finished':     { label: 'Process finished',   color: '#ffd700', bg: 'rgba(255,215,0,0.08)',   icon: <StopIcon />   },
  'ide.opened':       { label: 'Opened in IDE',      color: '#4a9eff', bg: 'rgba(74,158,255,0.08)',  icon: <IDEIcon />    },
  'todo.created':     { label: 'Todo created',       color: '#4aff91', bg: 'rgba(74,255,145,0.08)',  icon: <CheckCircleIcon /> },
  'todo.completed':   { label: 'Todo completed',     color: '#ffd700', bg: 'rgba(255,215,0,0.08)',   icon: <CheckCircleIcon /> },
  'todo.reverted':    { label: 'Todo un-completed',  color: '#ff9944', bg: 'rgba(255,153,68,0.08)',  icon: <CheckCircleIcon /> },
  'todo.deleted':     { label: 'Todo deleted',       color: '#ff4444', bg: 'rgba(255,68,68,0.08)',   icon: <CheckCircleIcon /> },
  'todo.edited':      { label: 'Todo edited',        color: '#888888', bg: 'rgba(136,136,136,0.08)', icon: <CheckCircleIcon /> },
  'schedule.created':   { label: 'Schedule created',   color: '#4aff91', bg: 'rgba(74,255,145,0.08)',  icon: <ClockIcon /> },
  'schedule.completed': { label: 'Schedule completed', color: '#ffd700', bg: 'rgba(255,215,0,0.08)',   icon: <ClockIcon /> },
  'schedule.reverted':  { label: 'Schedule un-completed', color: '#ff9944', bg: 'rgba(255,153,68,0.08)', icon: <ClockIcon /> },
  'schedule.deleted':   { label: 'Schedule deleted',   color: '#ff4444', bg: 'rgba(255,68,68,0.08)',   icon: <ClockIcon /> },
  'schedule.edited':    { label: 'Schedule edited',    color: '#888888', bg: 'rgba(136,136,136,0.08)', icon: <ClockIcon /> },
  'note.created':     { label: 'Note created',       color: '#a855f7', bg: 'rgba(168,85,247,0.08)',  icon: <NoteIcon2 />  },
  'note.deleted':     { label: 'Note deleted',       color: '#ff4444', bg: 'rgba(255,68,68,0.08)',   icon: <NoteIcon2 />  },
  'note.archived':    { label: 'Note archived',      color: '#888888', bg: 'rgba(136,136,136,0.08)', icon: <NoteIcon2 />  },
  'note.unarchived':  { label: 'Note unarchived',    color: '#4aff91', bg: 'rgba(74,255,145,0.08)',  icon: <NoteIcon2 />  },
  'setting.github':   { label: 'GitHub updated',     color: '#888888', bg: 'rgba(136,136,136,0.08)', icon: <PaletteIcon /> },
  'setting.profile':  { label: 'Profile updated',    color: '#888888', bg: 'rgba(136,136,136,0.08)', icon: <PaletteIcon /> },
}

function formatTs(ts) {
  const d = new Date(ts)
  const now = new Date()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60)   return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function groupByDay(entries) {
  const groups = {}
  for (const e of entries) {
    const day = new Date(e.timestamp).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    if (!groups[day]) groups[day] = []
    groups[day].push(e)
  }
  return Object.entries(groups)
}

export default function Activity() {
  const navigate = useNavigate()
  const [entries,  setEntries]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [clearing, setClearing] = useState(false)
  const [filter,   setFilter]   = useState('All')


  const load = () => {
    if (!window.api) { setLoading(false); return }
    setLoading(true)
    window.api.activity.getAll(200)
      .then(data => setEntries(data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { Promise.resolve().then(load) }, [])

  const handleClear = async () => {
    if (!window.api || !window.confirm('Clear all activity? This cannot be undone.')) return
    setClearing(true)
    await window.api.activity.clear().catch(console.error)
    setEntries([])
    setClearing(false)
  }

  const activeGroup = FILTER_GROUPS.find(g => g.label === filter) || FILTER_GROUPS[0]
  const filtered    = activeGroup.types ? entries.filter(e => activeGroup.types.includes(e.type)) : entries
  const grouped     = groupByDay(filtered)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 28px', height: 54, flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--dim)' }}>Activity</span>
        <span style={{ color: 'var(--dimmer)' }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Log</span>
        <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', background: 'var(--border)', padding: '2px 8px', borderRadius: 20 }}>
          {entries.length}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
            <RefreshIcon /> Refresh
          </button>
          {entries.length > 0 && (
            <button onClick={handleClear} disabled={clearing} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(255,68,68,0.3)', background: 'rgba(255,68,68,0.06)', color: '#ff6b6b', fontSize: 12, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
              <TrashIcon /> Clear All
            </button>
          )}
        </div>
      </div>

      {/* Filter bar — responsive grouped pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0, overflowX: 'auto' }}>
        {FILTER_GROUPS.map(g => {
          const count = g.types ? entries.filter(e => g.types.includes(e.type)).length : entries.length
          const active = filter === g.label
          return (
            <button key={g.label} onClick={() => setFilter(g.label)} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 20, border: `1px solid ${active ? 'var(--accent)' : 'transparent'}`,
              background: active ? 'rgba(74,158,255,0.10)' : 'var(--border)',
              color: active ? 'var(--accent)' : 'var(--dim)',
              fontSize: 11, fontFamily: 'Geist, sans-serif', cursor: 'pointer',
              transition: 'all 0.12s', flexShrink: 0, whiteSpace: 'nowrap',
            }}>
              <span style={{ fontSize: 10 }}>{g.icon}</span>
              {g.label}
              <span style={{ fontSize: 9, fontFamily: 'Geist Mono, monospace', opacity: 0.7 }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div className="pm-page" style={{ maxWidth: 680, padding: '24px 28px' }}>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 10 }}>
              <div style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--orange)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              <span style={{ fontSize: 13, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Loading activity…</span>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 12 }}>
              <div style={{ color: 'var(--dimmer)', opacity: 0.4 }}><ActivityIcon /></div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--dim)' }}>No activity yet</div>
              <div style={{ fontSize: 12, color: 'var(--dimmer)' }}>Create a project, make a commit, or run a process to see events here.</div>
            </div>
          )}

          {!loading && grouped.map(([day, dayEntries]) => (
            <div key={day} style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                {day}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {dayEntries.map(entry => {
                  const meta = EVENT_META[entry.type] || { label: entry.type, color: 'var(--dimmer)', bg: 'var(--card)', icon: <ActivityIcon /> }
                  const projectName = entry.projectName || '—'
                  const detail = entry.type === 'git.committed'    ? entry.message
                               : entry.type === 'run.started'      ? entry.command
                               : entry.type === 'run.finished'     ? `exit ${entry.exitCode ?? '?'}`
                               : entry.type === 'project.imported' ? entry.folderPath
                               : entry.type === 'todo.created'     ? entry.title
                               : entry.type === 'todo.completed'   ? entry.title
                               : entry.type === 'schedule.created'   ? entry.title
                               : entry.type === 'schedule.completed' ? entry.title
                               : entry.type === 'note.created'     ? entry.title
                               : null

                  return (
                    <div key={entry.id} style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '11px 14px',
                      background: 'transparent', borderRadius: 8, transition: 'background 0.1s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--card)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Type icon */}
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {meta.icon}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{meta.label}</span>
                          <span
                            style={{ fontSize: 11, color: 'var(--blue)', fontFamily: 'Geist Mono, monospace', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}
                            onClick={() => entry.projectId && navigate(`/projects/${entry.projectId}`)}
                          >
                            {projectName}
                          </span>
                        </div>
                        {detail && (
                          <div style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {detail}
                          </div>
                        )}
                      </div>

                      <span style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', flexShrink: 0 }}>
                        {formatTs(entry.timestamp)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

        </div>
      </div>
    </div>
  )
}
