import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IDEIcon, FolderIcon,
  GridIcon, ListViewIcon, SearchIcon,
  StarIcon, DragIcon, TrendIcon, ClockIcon,
} from '../constants/SimpleSvgExports'
import { CardBtn, ViewBtn } from '../components/Projects/Exports'
import { useData, patchData, refreshData } from '../lib/store'

export default function Favourites() {
  const navigate  = useNavigate()
  const [search,     setSearch]     = useState('')
  const [view,       setView]       = useState('grid')
  const [dragId,     setDragId]     = useState(null)
  const [dragOverId, setDragOverId] = useState(null)

  // Instant render from the shared cache; refreshes in the background
  const projects = useData('projects')
  const loading  = projects === null
  const favourites = useMemo(() => {
    const favs = (projects || []).filter(p => p.favourite)
    // stable sort: ranked favourites first (by favouriteRank), unranked keep their incoming order
    return [...favs].sort((a, b) => {
      const ra = a.favouriteRank ?? Number.MAX_SAFE_INTEGER
      const rb = b.favouriteRank ?? Number.MAX_SAFE_INTEGER
      return ra - rb
    })
  }, [projects])

  const removeFav = async (id) => {
    if (!window.api) return
    patchData('projects', prev => (prev || []).map(p => p.id === id ? { ...p, favourite: false } : p))
    await window.api.projects.toggleFavorite(id)
      .catch(err => { console.error(err); refreshData('projects') })
  }

  const filtered = favourites.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))
  )

  const mostOpened = [...favourites].sort((a, b) => (b.openCount || 0) - (a.openCount || 0))[0]
  const lastAccessed = favourites.length > 0 ? favourites[0]?.time : '—'

  const persistOrder = async (orderedIds) => {
    const ranks = Object.fromEntries(orderedIds.map((id, i) => [id, i]))
    patchData('projects', prev => (prev || []).map(p => ranks[p.id] !== undefined ? { ...p, favouriteRank: ranks[p.id] } : p))
    if (!window.api) return
    try {
      await Promise.all(orderedIds.map((id, i) => window.api.projects.edit(id, { favouriteRank: i })))
    } catch (err) {
      console.error(err)
      refreshData('projects')
    }
  }

  const onDragStart = (id) => setDragId(id)
  const onDragOver  = (e, id) => { e.preventDefault(); setDragOverId(id) }
  const onDrop      = (targetId) => {
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return }
    const arr   = favourites.map(f => f.id)
    const fromI = arr.indexOf(dragId)
    const toI   = arr.indexOf(targetId)
    if (fromI !== -1 && toI !== -1) {
      arr.splice(fromI, 1)
      arr.splice(toI, 0, dragId)
      persistOrder(arr)
    }
    setDragId(null); setDragOverId(null)
  }
  const onDragEnd = () => { setDragId(null); setDragOverId(null) }

  const dragProps = (id) => ({
    draggable: true,
    onDragStart: () => onDragStart(id),
    onDragOver:  (e) => onDragOver(e, id),
    onDrop:      () => onDrop(id),
    onDragEnd,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 28px', height: 54, flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--dim)' }}>Favourites</span>
        <span style={{ color: 'var(--dimmer)' }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Pinned Projects</span>
        <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', background: 'var(--border)', padding: '2px 8px', borderRadius: 20 }}>
          {favourites.length}
        </span>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 28px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <FavSearchBox value={search} onChange={setSearch} />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>drag to reorder</span>
          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
          <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--border)', borderRadius: 7 }}>
            <ViewBtn active={view === 'grid'} onClick={() => setView('grid')}><GridIcon /></ViewBtn>
            <ViewBtn active={view === 'list'} onClick={() => setView('list')}><ListViewIcon /></ViewBtn>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div className="pm-page" style={{ padding: 28 }}>

          {/* Stats row */}
          <div className="pm-grid-3" style={{ gap: 10, marginBottom: 24 }}>
            <MiniStat icon={<StarIcon filled />}  label="Pinned Projects" value={favourites.length}              color="#ffd700" />
            <MiniStat icon={<TrendIcon />}         label="Most Opened"    value={mostOpened?.name || '—'}        color="var(--blue)"   small />
            <MiniStat icon={<ClockIcon />}         label="Last Accessed"  value={lastAccessed || '—'}            color="var(--orange)" small />
          </div>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 10 }}>
              <div style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--orange)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              <span style={{ fontSize: 13, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Loading favourites...</span>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 12 }}>
              <div style={{ fontSize: 36 }}>⭐</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--dim)' }}>No favourites yet</div>
              <div style={{ fontSize: 12, color: 'var(--dimmer)', textAlign: 'center' }}>
                {search ? 'No favourites match your search' : 'Star a project to pin it here for quick access'}
              </div>
            </div>
          )}

          {view === 'grid' && !loading && filtered.length > 0 && (
            <div className="pm-grid-2">
              {filtered.map(p => (
                <FavCard key={p.id} project={p} onRemove={removeFav} onOpen={() => navigate(`/projects/${p.id}`)}
                  dragging={dragId === p.id} dragOver={dragOverId === p.id}
                  {...dragProps(p.id)}
                />
              ))}
            </div>
          )}

          {view === 'list' && !loading && filtered.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filtered.map((p, i) => (
                <FavListRow key={p.id} project={p} index={i} onRemove={removeFav} onOpen={() => navigate(`/projects/${p.id}`)}
                  dragging={dragId === p.id} dragOver={dragOverId === p.id}
                  {...dragProps(p.id)}
                />
              ))}
            </div>
          )}

        </div>
      </div>

    </div>
  )
}

function FavCard({ project, onRemove, onOpen, dragging, dragOver, ...dragProps }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      {...dragProps}
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:   dragging ? 'var(--surface)' : hovered ? 'var(--card-hover)' : 'var(--card)',
        border:       `1px solid ${dragOver ? 'var(--orange)' : hovered ? 'var(--border-bright)' : 'var(--border)'}`,
        borderRadius: 12, padding: 20, cursor: 'pointer',
        transform:    dragging ? 'scale(0.98) rotate(1deg)' : hovered ? 'translateY(-1px)' : 'none',
        opacity:      dragging ? 0.6 : 1,
        transition:   'all 0.15s', position: 'relative', overflow: 'hidden',
        boxShadow:    dragOver ? '0 0 0 2px var(--orange)' : 'none',
      }}
    >
      {hovered && !dragging && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, var(--border-bright), transparent)' }} />
      )}
      <div style={{ position: 'absolute', top: 10, right: 10, color: 'var(--dimmer)', opacity: hovered ? 0.6 : 0, transition: 'opacity 0.15s' }}>
        <DragIcon />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 11, background: project.emojiColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
          {project.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', letterSpacing: -0.2 }}>{project.name}</span>
            <VisBadge visibility={project.visibility} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--dim)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {project.description}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onRemove(project.id) }}
          title="Remove from favourites"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ffd700', padding: 2, flexShrink: 0, opacity: hovered ? 1 : 0.7, transition: 'opacity 0.15s' }}
        >
          <StarIcon filled />
        </button>
      </div>

      {(project.languages || []).length > 0 && (
        <div style={{ height: 3, background: 'var(--border)', borderRadius: 10, overflow: 'hidden', display: 'flex', marginBottom: 12 }}>
          {project.languages.map((l, i) => (
            <div key={i} style={{ width: `${l.pct}%`, background: l.color, height: '100%' }} />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
        {(project.tags || []).map(tag => (
          <span key={tag} style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, background: 'var(--border)', color: 'var(--dim)', padding: '3px 7px', borderRadius: 4 }}>
            {tag}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
        <span>IDE: <span style={{ color: 'var(--dim)' }}>{project.ide}</span></span>
        <span>commit: <span style={{ color: 'var(--dim)' }}>{project.lastCommit || 'never'}</span></span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: project.status === 'running' ? '#4aff91' : 'var(--dimmer)',
            boxShadow:  project.status === 'running' ? '0 0 0 3px rgba(74,255,145,0.15)' : 'none',
            animation:  project.status === 'running' ? 'pmPulse 2s infinite' : 'none',
          }} />
          <span style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', color: project.status === 'running' ? '#4aff91' : 'var(--dimmer)' }}>
            {project.status === 'running' ? 'running' : project.time}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, opacity: hovered ? 1 : 0, transition: 'opacity 0.12s' }}>
          <CardBtn title="Open in IDE"    onClick={e => { e.stopPropagation(); window.api?.projects.openInIDE(project.id) }}><IDEIcon /></CardBtn>
          <CardBtn title="Open Folder"    onClick={e => { e.stopPropagation(); window.api?.projects.openFolder(project.id) }}><FolderIcon /></CardBtn>
        </div>
      </div>
    </div>
  )
}

function FavListRow({ project, index, onRemove, onOpen, dragging, dragOver, ...dragProps }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      {...dragProps}
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
        background:   dragging ? 'var(--surface)' : hovered ? 'var(--card-hover)' : index % 2 === 0 ? 'var(--card)' : 'transparent',
        border:       `1px solid ${dragOver ? 'var(--orange)' : hovered ? 'var(--border-bright)' : 'transparent'}`,
        borderRadius: 10, cursor: 'pointer',
        opacity:      dragging ? 0.5 : 1,
        transform:    dragging ? 'scale(0.99)' : 'none',
        transition:   'all 0.12s',
        boxShadow:    dragOver ? '0 0 0 2px var(--orange)' : 'none',
      }}
    >
      <div style={{ width: 24, textAlign: 'center', fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', flexShrink: 0 }}>{index + 1}</div>
      <div style={{ color: 'var(--dimmer)', opacity: hovered ? 1 : 0, transition: 'opacity 0.12s', flexShrink: 0 }}><DragIcon /></div>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: project.emojiColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
        {project.emoji}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{project.name}</span>
          <VisBadge visibility={project.visibility} />
          {project.status === 'running' && (
            <span style={{ fontSize: 9, fontFamily: 'Geist Mono, monospace', padding: '2px 6px', borderRadius: 20, background: 'rgba(74,255,145,0.1)', color: '#4aff91' }}>running</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--dimmer)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{project.description}</div>
      </div>

      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {(project.tags || []).slice(0, 2).map(tag => (
          <span key={tag} style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, background: 'var(--border)', color: 'var(--dim)', padding: '2px 6px', borderRadius: 3 }}>{tag}</span>
        ))}
      </div>

      {(project.languages || []).length > 0 && (
        <div style={{ width: 50, height: 4, background: 'var(--border)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexShrink: 0 }}>
          {project.languages.map((l, i) => <div key={i} style={{ width: `${l.pct}%`, background: l.color, height: '100%' }} />)}
        </div>
      )}

      <div style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', width: 76, textAlign: 'right', flexShrink: 0 }}>{project.lastCommit || 'never'}</div>
      <div style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', width: 56, flexShrink: 0 }}>{project.ide}</div>

      <div style={{ display: 'flex', gap: 3, opacity: hovered ? 1 : 0, transition: 'opacity 0.12s', flexShrink: 0 }}>
        <CardBtn title="Open in IDE" onClick={e => { e.stopPropagation(); window.api?.projects.openInIDE(project.id) }}><IDEIcon /></CardBtn>
        <CardBtn title="Open Folder" onClick={e => { e.stopPropagation(); window.api?.projects.openFolder(project.id) }}><FolderIcon /></CardBtn>
        <button
          onClick={e => { e.stopPropagation(); onRemove(project.id) }}
          title="Remove from favourites"
          style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, border: 'none', cursor: 'pointer', background: 'rgba(255,215,0,0.1)', color: '#ffd700', transition: 'all 0.12s' }}
        >
          <StarIcon filled />
        </button>
      </div>
    </div>
  )
}

function MiniStat({ icon, label, value, color, small }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: small ? 13 : 22, fontWeight: 600, color, fontFamily: small ? 'Geist, sans-serif' : 'Geist Mono, monospace', letterSpacing: small ? -0.2 : -0.5, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value}
        </div>
      </div>
    </div>
  )
}

function VisBadge({ visibility }) {
  if (!visibility) return null
  return (
    <span style={{
      fontSize: 9, fontFamily: 'Geist Mono, monospace', padding: '2px 5px', borderRadius: 3,
      textTransform: 'uppercase', letterSpacing: '0.06em',
      background: visibility === 'hidden' ? 'rgba(168,85,247,0.1)' : 'rgba(74,158,255,0.1)',
      color:      visibility === 'hidden' ? '#a855f7'              : '#4a9eff',
    }}>
      {visibility}
    </span>
  )
}

function FavSearchBox({ value, onChange }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'var(--card)',
      border: `1px solid ${focused ? 'var(--border-bright)' : 'var(--border)'}`,
      borderRadius: 8, padding: '7px 12px',
      flex: 1, maxWidth: 280, transition: 'border-color 0.15s',
    }}>
      <span style={{ color: 'var(--dimmer)', display: 'flex', flexShrink: 0 }}><SearchIcon /></span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search favourites..."
        style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text)', flex: 1, fontFamily: 'Geist, sans-serif' }}
      />
      {value && (
        <button onClick={() => onChange('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
      )}
    </div>
  )
}
