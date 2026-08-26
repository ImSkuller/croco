import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PlusIcon,
  GridIcon,
  ListViewIcon,
  SortIcon,
} from '../constants/SimpleSvgExports.jsx'
import { ProjectCardGrid, ProjectCardList, SearchBox, FilterTab, IconBtn, ViewBtn, TopBtn } from '../components/Projects/Exports.jsx'
import { useToast } from '../components/Toast/useToast.js'
import { useKeyboard } from '../hooks/useKeyboard'
import { useData, patchData, refreshData, EMPTY_LIST } from '../lib/store'

const FILTERS = ['All', 'Public', 'Hidden', 'Favourites', 'Running', 'Archived']
const SORTS   = ['Last Opened', 'Name', 'Last Commit', 'Status']

function sortProjects(projects, sort) {
  const arr = [...projects]
  switch (sort) {
    case 'Name':
      return arr.sort((a, b) => a.name.localeCompare(b.name))
    case 'Last Commit':
      return arr.sort((a, b) => new Date(b.meta?.lastCommitAt || 0) - new Date(a.meta?.lastCommitAt || 0))
    case 'Status':
      return arr.sort((a, b) => (b.status === 'running' ? 1 : 0) - (a.status === 'running' ? 1 : 0))
    default: // 'Last Opened'
      return arr.sort((a, b) => new Date(b.meta?.lastOpenedAt || 0) - new Date(a.meta?.lastOpenedAt || 0))
  }
}

export default function Projects() {
  const navigate = useNavigate()
  const toast    = useToast()

  const [search,      setSearch]      = useState('')
  const [filter,      setFilter]      = useState('All')
  const [sort,        setSort]        = useState('Last Opened')
  const [view,        setView]        = useState('grid')
  const [sortOpen,    setSortOpen]    = useState(false)
  const [runningIds,  setRunningIds]  = useState(new Set())
  const [selectedTag, setSelectedTag] = useState(null)
  const [archivedOpen, setArchivedOpen] = useState(false)
  const searchRef  = useRef(null)

  // Instant render from the shared cache; refreshes in the background
  const projects = useData('projects') || EMPTY_LIST
  const loading  = useData('projects') === null

  useKeyboard({
    '/':       () => searchRef.current?.focus(),
    'ctrl+n':  () => navigate('/projects/new'),
  })

  useEffect(() => {
    if (!window.api) return
    // Seed running state from current processes
    window.api.run.getRunning().then(ids => setRunningIds(new Set(ids))).catch(() => {})

    const unsubStart  = window.api.run.onStarted?.(({ projectId }) =>
      setRunningIds(prev => new Set([...prev, projectId])))
    const unsubFinish = window.api.run.onFinished?.(({ projectId }) =>
      setRunningIds(prev => { const n = new Set(prev); n.delete(projectId); return n }))

    // Reconcile "Last commit" from real git logs so sorting/labels reflect
    // commits made anywhere, not just through Croco's own commit UI.
    window.api.git.syncAllLastCommitDates()
      .then(r => { if (r?.synced > 0) refreshData('projects') })
      .catch(() => {})

    return () => { unsubStart?.(); unsubFinish?.() }
  }, [])

  const toggleFav = async (id) => {
    if (!window.api) return
    // Optimistic — star flips instantly everywhere
    patchData('projects', prev => (prev || []).map(p => p.id === id ? { ...p, favourite: !p.favourite } : p))
    const updated = await window.api.projects.toggleFavorite(id).catch(err => {
      console.error(err)
      refreshData('projects')
      return null
    })
    if (updated) patchData('projects', prev => (prev || []).map(p => p.id === id ? updated : p))
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

  const allTags = [...new Set(projects.flatMap(p => p.tags || []))].sort()

  const filtered = useMemo(() => sortProjects(
    projects.filter(p => {
      const q = search.toLowerCase()
      const matchSearch = !q
        || p.name.toLowerCase().includes(q)
        || (p.tags || []).some(t => t.toLowerCase().includes(q))
        || (p.description || '').toLowerCase().includes(q)
      const matchFilter =
        filter === 'Archived'   ? !!p.archived :
        filter === 'All'        ? !p.archived :
        filter === 'Public'     ? !p.archived && p.visibility === 'public' :
        filter === 'Hidden'     ? !p.archived && p.visibility === 'hidden' :
        filter === 'Favourites' ? !p.archived && p.favourite :
        filter === 'Running'    ? !p.archived && runningIds.has(p.id) : !p.archived
      const matchTag = !selectedTag || (p.tags || []).includes(selectedTag)
      return matchSearch && matchFilter && matchTag
    }),
    sort
  ), [projects, search, filter, sort, selectedTag, runningIds])

  // Archived projects, shown as a collapsible dropdown under the "All" tab
  // instead of forcing a separate tab switch to find them.
  const archivedProjects = useMemo(() => sortProjects(
    projects.filter(p => {
      if (!p.archived) return false
      const q = search.toLowerCase()
      const matchSearch = !q
        || p.name.toLowerCase().includes(q)
        || (p.tags || []).some(t => t.toLowerCase().includes(q))
        || (p.description || '').toLowerCase().includes(q)
      const matchTag = !selectedTag || (p.tags || []).includes(selectedTag)
      return matchSearch && matchTag
    }),
    sort
  ), [projects, search, sort, selectedTag])

  const counts = useMemo(() => ({
    All:        projects.filter(p => !p.archived).length,
    Public:     projects.filter(p => !p.archived && p.visibility === 'public').length,
    Hidden:     projects.filter(p => !p.archived && p.visibility === 'hidden').length,
    Favourites: projects.filter(p => !p.archived && p.favourite).length,
    Running:    projects.filter(p => !p.archived && runningIds.has(p.id)).length,
    Archived:   projects.filter(p => p.archived).length,
  }), [projects, runningIds])

  const projectLabel = filter === 'Favourites' ? '' : 'Projects'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Topbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '0 28px', height: 54, flexShrink: 0,
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--dim)' }}>Projects</span>
        <span style={{ color: 'var(--dimmer)' }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{filter} {projectLabel}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <TopBtn onClick={() => navigate('/ideas')}>
            💡 Ideas
          </TopBtn>
          <TopBtn onClick={handleImport}>
            Import
          </TopBtn>
          <TopBtn primary onClick={() => navigate('/projects/new')}>
            <PlusIcon color="#000" /> New Project
          </TopBtn>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 28px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>

        {/* Search */}
        <SearchBox ref={searchRef} value={search} onChange={setSearch} />

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--border)', borderRadius: 8, flexShrink: 0 }}>
          {FILTERS.map(f => (
            <FilterTab key={f} label={f} count={counts[f]} active={filter === f} onClick={() => setFilter(f)} />
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Sort */}
          <div style={{ position: 'relative' }}>
            <IconBtn onClick={() => setSortOpen(o => !o)} active={sortOpen}>
              <SortIcon />
              <span style={{ fontSize: 12, color: 'var(--dim)', marginLeft: 4 }}>{sort}</span>
            </IconBtn>
            {sortOpen && (
              <div style={{
                position: 'absolute', top: '110%', right: 0, zIndex: 50,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 8, padding: 4, minWidth: 140,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                {SORTS.map(s => (
                  <div
                    key={s}
                    onClick={() => { setSort(s); setSortOpen(false) }}
                    style={{
                      padding: '8px 12px', borderRadius: 5, fontSize: 12,
                      color: sort === s ? 'var(--accent)' : 'var(--dim)',
                      background: sort === s ? 'var(--accent-dim)' : 'transparent',
                      cursor: 'pointer', transition: 'all 0.1s',
                    }}
                    onMouseEnter={e => { if (sort !== s) e.currentTarget.style.background = 'var(--card)' }}
                    onMouseLeave={e => { if (sort !== s) e.currentTarget.style.background = 'transparent' }}
                  >
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* View toggle */}
          <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--border)', borderRadius: 7 }}>
            <ViewBtn active={view === 'grid'} onClick={() => setView('grid')}><GridIcon /></ViewBtn>
            <ViewBtn active={view === 'list'} onClick={() => setView('list')}><ListViewIcon /></ViewBtn>
          </div>
        </div>
      </div>

      {/* Tag filter row */}
      {allTags.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 28px', borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', marginRight: 2 }}>tag:</span>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              style={{
                padding: '2px 9px', borderRadius: 20, fontSize: 11, fontFamily: 'Geist, sans-serif',
                border: `1px solid ${selectedTag === tag ? 'var(--accent)' : 'var(--border)'}`,
                background: selectedTag === tag ? 'var(--accent-dim)' : 'transparent',
                color: selectedTag === tag ? 'var(--accent)' : 'var(--dim)',
                cursor: 'pointer', transition: 'all 0.12s',
              }}
            >
              {tag}
            </button>
          ))}
          {selectedTag && (
            <button
              onClick={() => setSelectedTag(null)}
              style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontFamily: 'Geist, sans-serif', border: '1px solid transparent', background: 'transparent', color: 'var(--dimmer)', cursor: 'pointer' }}
            >
              ✕ clear
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div className="pm-page" style={{ padding: 28 }}>

          {/* Result count */}
          <div style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', marginBottom: 16 }}>
            {filtered.length} {filtered.length === 1 ? 'project' : 'projects'}
            {search && <span> matching <span style={{ color: 'var(--orange)' }}>"{search}"</span></span>}
          </div>

          {/* Loading state */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 10 }}>
              <div style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              <span style={{ fontSize: 13, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Loading projects...</span>
            </div>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', gap: 14 }}>
              <div style={{
                width: 72, height: 72, borderRadius: 20,
                background: 'var(--card)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, marginBottom: 4,
              }}>
                {projects.length === 0 ? '📁' : '🔍'}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', letterSpacing: -0.3 }}>
                {projects.length === 0 ? 'No projects yet' : 'No projects found'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--dim)', textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
                {projects.length === 0
                  ? 'Import an existing folder or create a new project to get started.'
                  : 'Try adjusting your search or switching the active filter.'}
              </div>
              {projects.length === 0 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button
                    onClick={() => navigate('/projects/new')}
                    className="pm-btn-primary"
                    style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#000', fontSize: 13, fontWeight: 600, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}
                  >
                    New Project
                  </button>
                  <button
                    onClick={handleImport}
                    style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 13, fontWeight: 500, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}
                  >
                    Import Folder
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Grid view */}
          {view === 'grid' && filtered.length > 0 && (
            <div className="pm-grid-3">
              {filtered.map(p => (
                <ProjectCardGrid key={p.id} project={p} isRunning={runningIds.has(p.id)} onToggleFav={toggleFav} onClick={() => navigate(`/projects/${p.id}`)} />
              ))}
            </div>
          )}

          {/* List view */}
          {view === 'list' && filtered.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filtered.map((p, i) => (
                <ProjectCardList key={p.id} project={p} isRunning={runningIds.has(p.id)} onToggleFav={toggleFav} index={i} onClick={() => navigate(`/projects/${p.id}`)} />
              ))}
            </div>
          )}

          {/* Archived dropdown — only on the "All" tab, so archived projects
              are one click away instead of requiring a separate tab switch */}
          {filter === 'All' && archivedProjects.length > 0 && (
            <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <button
                onClick={() => setArchivedOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                  fontFamily: 'Geist, sans-serif',
                }}
              >
                <span style={{
                  fontSize: 10, color: 'var(--dimmer)', transition: 'transform var(--transition-fast)',
                  transform: archivedOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block',
                }}>▸</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--dim)' }}>Archived</span>
                <span style={{
                  fontSize: 10, fontFamily: 'Geist Mono, monospace', color: 'var(--dimmer)',
                  background: 'var(--border)', padding: '1px 6px', borderRadius: 10,
                }}>{archivedProjects.length}</span>
              </button>

              {archivedOpen && (
                <div style={{ marginTop: 14, opacity: 0.85 }}>
                  {view === 'grid' ? (
                    <div className="pm-grid-3">
                      {archivedProjects.map(p => (
                        <ProjectCardGrid key={p.id} project={p} isRunning={runningIds.has(p.id)} onToggleFav={toggleFav} onClick={() => navigate(`/projects/${p.id}`)} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {archivedProjects.map((p, i) => (
                        <ProjectCardList key={p.id} project={p} isRunning={runningIds.has(p.id)} onToggleFav={toggleFav} index={i} onClick={() => navigate(`/projects/${p.id}`)} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

    </div>
  )
}
