import { useState, useEffect } from 'react'
import { useNavigate, NavLink } from 'react-router-dom'
import { PlusIcon, FolderIcon, CheckCircleIcon, NoteIcon2 } from '../constants/SimpleSvgExports.jsx'
import { StatCard, SectionHeader, ProjectCard, TodoItem, NoteItem, TopBtn, FavChip, SuggestionsCard } from '../components/Dashboard/Exports.jsx'
import { useToast } from '../components/Toast/useToast.js'
import { useData, patchData, refreshData, EMPTY_LIST } from '../lib/store'
import { applyStyle } from '../lib/appearanceStyle.js'
import { Button } from '../components/ui/Button.jsx'
import useDiscordPresence from '../hooks/useDiscordPresence'

export default function Dashboard() {
  const navigate = useNavigate()
  const toast    = useToast()
  const [recentCommits,  setRecentCommits]  = useState([])

  useDiscordPresence('Browsing Croco', 'Dashboard')

  // Instant render from the shared cache; refreshes in the background
  const projects = useData('projects') || EMPTY_LIST
  const todos    = useData('todos')    || EMPTY_LIST
  const notes    = useData('notes')    || EMPTY_LIST
  const settings = useData('settings')
  const profile  = useData('personality')
  const loading  = useData('projects') === null

  useEffect(() => {
    if (!window.api) return
    // Recent commits load asynchronously — never blocks the main render
    window.api.git.getAllRecentCommits(6)
      .then(commits => setRecentCommits(commits || []))
      .catch(() => {})
    // Reconcile "Last commit" across all projects from real git logs, so it
    // reflects commits made anywhere (terminal, another IDE), not just ones
    // made through Croco's own commit UI.
    window.api.git.syncAllLastCommitDates()
      .then(r => { if (r?.synced > 0) refreshData('projects') })
      .catch(() => {})
  }, [])

  const toggleTodo = async (id) => {
    if (!window.api) return
    // Optimistic — flips instantly, syncs in the background
    patchData('todos', prev => (prev || []).map(t => t.id === id ? { ...t, completed: !t.completed } : t))
    const updated = await window.api.todos.toggle(id).catch(err => {
      console.error(err)
      refreshData('todos') // roll back to server truth on failure
      return null
    })
    if (updated) patchData('todos', prev => (prev || []).map(t => t.id === id ? { ...t, ...updated } : t))
  }

  const handleImport = async () => {
    if (!window.api) return
    const folderPath = await window.api.system.showFolderPicker()
    if (!folderPath) return
    try {
      const project = await window.api.projects.import(folderPath)
      refreshData('projects')
      navigate(`/projects/${project.id}`)
    } catch (e) {
      toast.error('Import failed', e.message)
    }
  }

  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const dateStr  = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', year: 'numeric' })

  const userName    = settings?.user?.name || 'there'
  // Trashed and archived items are excluded from every Dashboard widget —
  // Trash is a dedicated recovery view, archived projects live under the
  // Projects page's collapsible section — and hidden (private-path)
  // projects stay off the home page unless explicitly opted in (Settings →
  // Behaviour → "Show hidden projects on the Dashboard").
  const showHidden = !!settings?.app?.showHiddenOnDashboard
  const liveProjects = projects.filter(p => !p.trashedAt && !p.archived && (showHidden || p.visibility !== 'hidden'))
  const liveTodos     = todos.filter(t => !t.trashedAt)
  const recents     = liveProjects.slice(0, 5)
  const favourites  = liveProjects.filter(p => p.favourite)
  const openTodos   = liveTodos.filter(t => !t.completed).slice(0, 5)
  const projectMap  = Object.fromEntries(projects.map(p => [p.id, p.name]))
  const recentNotes = notes.filter(n => !n.trashedAt).slice(0, 4).map(n => ({ ...n, project: n.projectId ? projectMap[n.projectId] : null }))

  // Aggregate language breakdown from all (non-trashed) projects
  const langMap = {}
  for (const p of liveProjects) {
    for (const lang of (p.languages || [])) {
      if (!lang.name) continue
      langMap[lang.name] = langMap[lang.name] || { name: lang.name, color: lang.color, total: 0 }
      langMap[lang.name].total += lang.pct
    }
  }
  const langTotal  = Object.values(langMap).reduce((s, l) => s + l.total, 0) || 1
  // Every language is kept (they sum to 100% by construction) — the old
  // top-5 cap silently dropped languages. Anything under 1% is folded into
  // a single "Other" entry so the legend stays readable.
  const rankedLangs = Object.values(langMap)
    .sort((a, b) => b.total - a.total)
    .map(l => ({ ...l, pct: Math.round((l.total / langTotal) * 100) }))
  const bigLangs   = rankedLangs.filter(l => l.pct >= 1)
  const otherTotal = rankedLangs.filter(l => l.pct < 1).reduce((s, l) => s + l.total, 0)
  const languages  = otherTotal > 0
    ? [...bigLangs, { name: 'Other', color: 'var(--dimmer)', total: otherTotal, pct: Math.max(1, Math.round((otherTotal / langTotal) * 100)) }]
    : bigLangs

  const publicCount  = liveProjects.filter(p => p.visibility === 'public').length
  const hiddenCount  = liveProjects.filter(p => p.visibility === 'hidden').length
  const activeCount  = liveTodos.filter(t => !t.completed).length

  const latestCommit = recentCommits[0] || null

  const topLang = languages[0]

  const stats = [
    {
      label: 'Total Projects', value: String(liveProjects.length),
      sub: `${publicCount} public · ${hiddenCount} hidden`, dot: '#4a9eff',
    },
    {
      label: 'Open Todos', value: String(activeCount),
      sub: `${liveTodos.filter(t => t.completed).length} completed`, dot: '#ff6b35',
      valueColor: activeCount > 0 ? '#ff6b35' : '#4aff91',
    },
    {
      label: 'Last Commit', value: latestCommit ? latestCommit.date : 'never',
      sub: latestCommit ? `${latestCommit.projectName} · ${latestCommit.message.slice(0, 40)}${latestCommit.message.length > 40 ? '…' : ''}` : '—',
      dot: '#ff6b35', valueSize: 14,
    },
    {
      label: 'Top Language', value: topLang?.name || '—',
      sub: topLang ? `${topLang.pct}% of tracked files` : 'no languages detected',
      dot: topLang?.color || '#555', valueSize: 16, mono: true,
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>

      {/* Topbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '0 28px', height: 54, flexShrink: 0,
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--dim)' }}>Dashboard</span>
        <span style={{ color: 'var(--dimmer)' }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Home</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <TopBtn onClick={handleImport}>
            Import Folder
          </TopBtn>
          <TopBtn primary onClick={() => navigate('/projects/new')}>
            <PlusIcon color="#000" /> New Project
          </TopBtn>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div className="pm-page" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* One-time "try the new Minimal style" prompt — only for
              existing installs upgrading in (new installs start on
              'minimal' already, see settings.rs::default_settings) */}
          {settings && settings.appearance?.style !== 'minimal' && !settings.appearance?.minimalStylePromptShown && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 18px', borderRadius: 'var(--r-lg)',
              border: '1px solid var(--border)', background: 'var(--card)',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>Try the new Minimal style?</div>
                <div style={{ fontSize: 12, color: 'var(--dim)' }}>Near-zero radius, no shadows or glow, a narrower sidebar, motion capped at 150ms. You can switch back anytime in Settings → Appearance.</div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={async () => {
                  applyStyle('minimal')
                  await window.api?.settings.update({ appearance: { style: 'minimal', minimalStylePromptShown: true } }).catch(() => {})
                  patchData('settings', s => ({ ...s, appearance: { ...s.appearance, style: 'minimal', minimalStylePromptShown: true } }))
                }}
              >
                Switch
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await window.api?.settings.update({ appearance: { minimalStylePromptShown: true } }).catch(() => {})
                  patchData('settings', s => ({ ...s, appearance: { ...s.appearance, minimalStylePromptShown: true } }))
                }}
              >
                Dismiss
              </Button>
            </div>
          )}

          {/* Greeting */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'start' }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                {dateStr}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, letterSpacing: -1, marginBottom: 8 }}>
                {greeting}, <span style={{ color: 'var(--accent)' }}>{userName}</span>.
              </div>
              <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>
                {loading
                  ? 'Loading your workspace…'
                  : `You have ${activeCount > 0 ? activeCount : 'no'} open ${activeCount === 1 ? 'task' : 'tasks'} and ${liveProjects.length} project${liveProjects.length === 1 ? '' : 's'} tracked.`
                }
              </div>
            </div>
            <div style={{
              background: 'var(--dash-accent-card-bg)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: '18px 22px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              minWidth: 160,
              flexShrink: 0,
              boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{ width: 36, height: 36, background: 'var(--accent-dim)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                <FolderIcon size={16} />
              </div>
              <div>
                <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--accent)', fontFamily: 'Geist Mono, monospace', lineHeight: 1, letterSpacing: -1 }}>{liveProjects.length}</div>
                <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 3 }}>projects tracked</div>
              </div>
            </div>
          </div>

          <SuggestionsCard profile={profile} projects={projects} todos={todos} />

          {/* Stat cards */}
          <div className="pm-grid-4">
            {stats.map(stat => <StatCard key={stat.label} stat={stat} />)}
          </div>

          {/* Language bar */}
          {languages.length > 0 && (
            <div>
              <SectionHeader title="Language Breakdown" action="All projects ›" link="/projects" />
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ height: 8, background: 'var(--border)', borderRadius: 20, overflow: 'hidden', display: 'flex', marginBottom: 18, gap: 1 }}>
                  {languages.map((lang, i) => (
                    <div key={lang.name} style={{
                      width: `${lang.pct}%`, height: '100%', background: lang.color, flexShrink: 0,
                      borderRadius: i === 0 ? '20px 0 0 20px' : i === languages.length - 1 ? '0 20px 20px 0' : 0,
                      transition: 'width 0.3s ease',
                    }} />
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px' }}>
                  {languages.map(lang => (
                    <div key={lang.name} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--dim)' }}>
                      <div style={{ width: 9, height: 9, borderRadius: '50%', background: lang.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 500 }}>{lang.name}</span>
                      <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'var(--dimmer)' }}>{lang.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Favourites */}
          {favourites.length > 0 && (
            <div>
              <SectionHeader title="Favourites" action="Manage ›" link="/favourites" />
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                {favourites.map(fav => (
                  <FavChip key={fav.id} fav={fav} />
                ))}
              </div>
            </div>
          )}

          {/* Recent projects */}
          {recents.length > 0 && (
            <div>
              <SectionHeader title="Recent Projects" action={`View all ${liveProjects.length} ›`} link="/projects" />
              <div className="pm-grid-3">
                {recents.slice(0, 3).map(p => <ProjectCard key={p.id} project={p} />)}
              </div>
            </div>
          )}

          {/* Todos + Notes */}
          <div className="pm-grid-2" style={{ gap: 16 }}>
            <div className="glass-card" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--dim)', fontFamily: 'Geist Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Open Todos
                  {activeCount > 0 && <span style={{ marginLeft: 6, fontSize: 10, background: 'var(--accent-dim)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 8 }}>{activeCount}</span>}
                </span>
                <NavLink to="/todos" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 10, fontFamily: 'Geist Mono, monospace' }}>View all ›</NavLink>
              </div>
              {openTodos.length === 0 ? (
                <div style={{ padding: '32px 18px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--dimmer)', marginBottom: 8 }}><CheckCircleIcon size={24} /></div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--dim)', marginBottom: 4 }}>{loading ? 'Loading…' : 'All clear!'}</div>
                  {!loading && <div style={{ fontSize: 11, color: 'var(--dimmer)' }}>No open tasks</div>}
                </div>
              ) : (
                openTodos.map(t => <TodoItem key={t.id} item={{ ...t, done: t.completed, text: t.title }} onToggle={toggleTodo} />)
              )}
            </div>

            <div className="glass-card" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--dim)', fontFamily: 'Geist Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recent Notes</span>
                <NavLink to="/note-editor" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 10, fontFamily: 'Geist Mono, monospace' }}>New note ›</NavLink>
              </div>
              {recentNotes.length === 0 ? (
                <div style={{ padding: '32px 18px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--dimmer)', marginBottom: 8 }}><NoteIcon2 size={24} /></div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--dim)', marginBottom: 4 }}>{loading ? 'Loading…' : 'No notes yet'}</div>
                  {!loading && <div style={{ fontSize: 11, color: 'var(--dimmer)' }}>Start capturing your thoughts</div>}
                </div>
              ) : (
                recentNotes.map(n => <NoteItem key={n.id} note={n} />)
              )}
            </div>
          </div>

          {/* Recent Commits across all projects */}
          {recentCommits.length > 0 && (
            <div>
              <SectionHeader title="Recent Commits" action="All Projects ›" link="/projects" />
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                {recentCommits.map((c, i) => (
                  <div
                    key={c.hash + i}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 18px',
                      borderBottom: i < recentCommits.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: 15, flexShrink: 0 }}>{c.projectEmoji || '📁'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.message}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', marginTop: 2 }}>
                        {c.projectName} · {c.author}
                      </div>
                    </div>
                    <span style={{ fontSize: 9, fontFamily: 'Geist Mono, monospace', color: 'var(--dimmer)', flexShrink: 0 }}>{c.date}</span>
                    <span style={{ fontSize: 9, fontFamily: 'Geist Mono, monospace', color: 'var(--accent)', background: 'var(--accent-dim)', padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>{c.hash}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
