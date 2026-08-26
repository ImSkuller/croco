import { useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusIcon, GridIcon, ListViewIcon, SearchIcon, StarIcon, TrashIcon } from '../constants/SimpleSvgExports'
import { ViewBtn } from '../components/Projects/Exports'
import { useKeyboard } from '../hooks/useKeyboard'
import { useData, patchData, refreshData, EMPTY_LIST } from '../lib/store'

const FILTERS = ['All', 'Starred', 'Archived']

export default function Notes() {
  const navigate  = useNavigate()
  const searchRef = useRef(null)
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('All')
  const [project,  setProject]  = useState('All')

  useKeyboard({
    '/':      () => searchRef.current?.focus(),
    'ctrl+n': () => navigate('/note-editor'),
  })
  const [view,     setView]     = useState('grid')

  // Instant render from the shared cache; refreshes in the background
  const rawNotes = useData('notes')
  const projects = useData('projects') || EMPTY_LIST
  const loading  = rawNotes === null

  const notes = useMemo(() => {
    const projById = Object.fromEntries(projects.map(p => [p.id, p]))
    return (rawNotes || []).map(note => ({
      ...note,
      project: note.projectId ? (projById[note.projectId]?.name || null) : null,
    }))
  }, [rawNotes, projects])

  const toggleStar = async (id) => {
    const note = notes.find(n => n.id === id)
    if (!note || !window.api) return
    patchData('notes', prev => (prev || []).map(n => n.id === id ? { ...n, starred: !note.starred } : n))
    await window.api.notes.update(id, { starred: !note.starred })
      .catch(err => { console.error(err); refreshData('notes') })
  }

  const toggleArchive = async (id) => {
    const note = notes.find(n => n.id === id)
    if (!note || !window.api) return
    patchData('notes', prev => (prev || []).map(n => n.id === id ? { ...n, archived: !note.archived } : n))
    await window.api.notes.update(id, { archived: !note.archived })
      .catch(err => { console.error(err); refreshData('notes') })
  }

  const deleteNote = async (id) => {
    if (!window.api) return
    patchData('notes', prev => (prev || []).filter(n => n.id !== id))
    await window.api.notes.delete(id).catch(err => { console.error(err); refreshData('notes') })
  }

  const [isDragOver,  setIsDragOver]  = useState(false)

  const handleDrop = async (e) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file || !file.name.endsWith('.md')) return
    try {
      const text  = await file.text()
      const lines = text.split('\n')
      const title = lines[0].replace(/^#+\s*/, '').trim() || file.name.replace('.md', '')
      const body  = lines.slice(1).join('\n').trim()
      const note  = await window.api.notes.create({ title, content: body, tags: [], starred: false })
      navigate(`/note-editor/${note.id}`, { state: { viewMode: 'preview' } })
    } catch (err) {
      console.error('Drop import failed:', err)
    }
  }

  const projectOptions = [{ id: 'All', name: 'All Projects' }, ...projects.map(p => ({ id: p.id, name: p.name }))]

  const filtered = useMemo(() => notes.filter(n => {
    const matchSearch  = n.title.toLowerCase().includes(search.toLowerCase()) ||
                         (n.preview || '').toLowerCase().includes(search.toLowerCase()) ||
                         (n.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))
    const matchFilter  = filter === 'Archived'
      ? n.archived
      : filter === 'Starred'
        ? n.starred && !n.archived
        : !n.archived
    const matchProject = project === 'All' ? true : n.projectId === project
    return matchSearch && matchFilter && matchProject
  }), [notes, search, filter, project])

  const counts = useMemo(() => ({
    All:      notes.filter(n => !n.archived).length,
    Starred:  notes.filter(n => n.starred && !n.archived).length,
    Archived: notes.filter(n => n.archived).length,
  }), [notes])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 28px', height: 54, flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--dim)' }}>Notes</span>
        <span style={{ color: 'var(--dimmer)' }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{filter === 'All' ? 'All Notes' : filter === 'Starred' ? 'Starred' : 'Archived'}</span>
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={() => navigate('/note-editor')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)',
              background: 'var(--card)', color: 'var(--text)', fontSize: 12, cursor: 'pointer',
              fontFamily: 'Geist, sans-serif', transition: 'all 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-bright)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <PlusIcon /> New Note
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 28px', borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap' }}>
        <NoteSearchBox value={search} onChange={setSearch} inputRef={searchRef} />

        <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--border)', borderRadius: 8 }}>
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 12, fontFamily: 'Geist, sans-serif',
                background: filter === f ? 'var(--card)'  : 'transparent',
                color:      filter === f ? 'var(--text)'  : 'var(--dimmer)',
                transition: 'all 0.12s',
              }}
            >
              {f}
              <span style={{ marginLeft: 5, fontSize: 10, fontFamily: 'Geist Mono, monospace', color: filter === f ? 'var(--dim)' : 'var(--dimmer)' }}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={project}
            onChange={e => setProject(e.target.value)}
            style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              color: 'var(--dim)', borderRadius: 7, padding: '6px 10px',
              fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: 'pointer', outline: 'none',
            }}
          >
            {projectOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--border)', borderRadius: 7 }}>
            <ViewBtn active={view === 'grid'} onClick={() => setView('grid')}><GridIcon /></ViewBtn>
            <ViewBtn active={view === 'list'} onClick={() => setView('list')}><ListViewIcon /></ViewBtn>
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false) }}
        onDrop={handleDrop}
      >
        {isDragOver && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 20,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
            background: 'rgba(11,15,26,0.85)', backdropFilter: 'blur(4px)',
            border: '2px dashed var(--accent)', borderRadius: 12, margin: 12,
            pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 36 }}>📄</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Drop .md file to import</div>
            <div style={{ fontSize: 12, color: 'var(--dimmer)' }}>First line becomes the title</div>
          </div>
        )}
        <div className="pm-page" style={{ padding: 28 }}>

          <div style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', marginBottom: 16 }}>
            {!loading && (
              <>
                {filtered.length} {filtered.length === 1 ? 'note' : 'notes'}
                {search && <span> matching <span style={{ color: 'var(--accent)' }}>"{search}"</span></span>}
              </>
            )}
          </div>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 10 }}>
              <div style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              <span style={{ fontSize: 13, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Loading notes...</span>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', gap: 14 }}>
              <div style={{
                width: 72, height: 72, borderRadius: 20,
                background: 'var(--card)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, marginBottom: 4,
              }}>
                {filter === 'Starred' ? '⭐' : filter === 'Archived' ? '📦' : search ? '🔍' : '📝'}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', letterSpacing: -0.3 }}>
                {filter === 'Archived' ? 'No archived notes' : filter === 'Starred' ? 'No starred notes' : search ? 'No notes found' : 'No notes yet'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--dim)', textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
                {search
                  ? 'Try a different search term or change your filter.'
                  : filter === 'Archived'
                    ? 'Archived notes will appear here.'
                    : filter === 'Starred'
                      ? 'Star a note to pin it here for quick access.'
                      : 'Start capturing your thoughts, ideas, and project notes.'}
              </div>
              {!search && filter === 'All' && (
                <button
                  onClick={() => navigate('/note-editor')}
                  style={{ marginTop: 4, padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#000', fontSize: 13, fontWeight: 600, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}
                >
                  Write First Note
                </button>
              )}
            </div>
          )}

          {view === 'grid' && !loading && filtered.length > 0 && (
            <div className="pm-grid-3">
              {filtered.map(n => (
                <NoteCard key={n.id} note={n} onToggleStar={toggleStar} onDelete={deleteNote} onToggleArchive={toggleArchive} onOpen={() => navigate(`/note-editor/${n.id}`)} />
              ))}
              {filter !== 'Archived' && <NewNoteCard onClick={() => navigate('/note-editor')} />}
            </div>
          )}

          {view === 'list' && !loading && filtered.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filtered.map((n, i) => (
                <NoteRow key={n.id} note={n} index={i} onToggleStar={toggleStar} onDelete={deleteNote} onToggleArchive={toggleArchive} onOpen={() => navigate(`/note-editor/${n.id}`)} />
              ))}
            </div>
          )}

        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '10px 28px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{notes.length}</span> total
        </span>
        <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
          <span style={{ color: '#ffd700', fontWeight: 600 }}>{counts.Starred}</span> starred
        </span>
        <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>
            {notes.filter(n => !n.archived).reduce((acc, n) => acc + (n.wordCount || 0), 0).toLocaleString()}
          </span> words total
        </span>
      </div>

    </div>
  )
}

function NoteCard({ note, onToggleStar, onDelete, onToggleArchive, onOpen }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="glass-card"
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:   hovered ? 'var(--card-hover)' : 'var(--card)',
        border:       `1px solid ${hovered ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 12, padding: 20, cursor: 'pointer',
        transform:    hovered ? 'translateY(-2px)' : 'none',
        transition:   'all 0.15s',
        position: 'relative', overflow: 'hidden',
        boxShadow: hovered ? 'var(--shadow-md)' : 'var(--shadow-sm)',
      }}
    >
      {hovered && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, var(--border-bright), transparent)' }} />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{note.emoji || '📝'}</span>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', letterSpacing: -0.2, lineHeight: 1.3, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.title}</span>
            <span style={{ display: 'block', fontSize: 9, fontFamily: 'Geist Mono, monospace', color: 'var(--dimmer)', marginTop: 1 }}>
              {note.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'untitled'}.md
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0, marginLeft: 6 }}>
          <button
            onClick={e => { e.stopPropagation(); onToggleStar(note.id) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: note.starred || hovered ? 1 : 0, transition: 'opacity 0.15s' }}
          >
            <StarIcon filled={note.starred} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onToggleArchive(note.id) }}
            title={note.archived ? 'Unarchive' : 'Archive'}
            style={{
              background: hovered ? 'var(--border)' : 'none',
              border: hovered ? '1px solid var(--border-bright)' : '1px solid transparent',
              borderRadius: 4,
              cursor: 'pointer', padding: '2px 5px',
              opacity: hovered ? 1 : 0.45,
              fontSize: 11,
              color: note.archived ? 'var(--accent)' : 'var(--dim)',
              display: 'flex', alignItems: 'center',
              transition: 'all 0.15s',
            }}
          >
            {note.archived ? '↩' : '📥'}
          </button>
          {hovered && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(note.id) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#ff4444', display: 'flex', alignItems: 'center' }}
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 14 }}>
        {note.preview || 'Empty note — click to edit'}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
        {(note.tags || []).map(tag => (
          <span key={tag} style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, background: 'var(--border)', color: 'var(--dimmer)', padding: '2px 6px', borderRadius: 3 }}>
            #{tag}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        <div>
          {note.project ? (
            <span style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', background: 'var(--border)', color: 'var(--dim)', padding: '2px 7px', borderRadius: 4 }}>
              {note.project}
            </span>
          ) : (
            <span style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>no project</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>{note.wordCount || 0}w</span>
          <span style={{ fontSize: 10, color: 'var(--dimmer)' }}>{note.time}</span>
        </div>
      </div>
    </div>
  )
}

function NoteRow({ note, index, onToggleStar, onDelete, onToggleArchive, onOpen }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
        background:   hovered ? 'var(--card-hover)' : index % 2 === 0 ? 'var(--card)' : 'transparent',
        border:       `1px solid ${hovered ? 'var(--border-bright)' : 'transparent'}`,
        borderRadius: 10, cursor: 'pointer', transition: 'all 0.12s',
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{note.emoji || '📝'}</span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{note.title}</span>
          {note.starred && <StarIcon filled />}
        </div>
        <div style={{ fontSize: 11, color: 'var(--dimmer)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {note.preview || 'Empty note'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {(note.tags || []).slice(0, 2).map(tag => (
          <span key={tag} style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, background: 'var(--border)', color: 'var(--dimmer)', padding: '2px 6px', borderRadius: 3 }}>
            #{tag}
          </span>
        ))}
      </div>

      {note.project && (
        <span style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', background: 'var(--border)', color: 'var(--dim)', padding: '2px 7px', borderRadius: 4, flexShrink: 0 }}>
          {note.project}
        </span>
      )}

      <span style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', width: 40, textAlign: 'right', flexShrink: 0 }}>{note.wordCount || 0}w</span>
      <span style={{ fontSize: 10, color: 'var(--dimmer)', width: 76, textAlign: 'right', flexShrink: 0 }}>{note.time}</span>

      <div style={{ display: 'flex', gap: 2, flexShrink: 0, alignItems: 'center' }}>
        <button
          onClick={e => { e.stopPropagation(); onToggleStar(note.id) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: note.starred || hovered ? 1 : 0, transition: 'opacity 0.15s' }}
        >
          <StarIcon filled={note.starred} />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onToggleArchive(note.id) }}
          title={note.archived ? 'Unarchive' : 'Archive'}
          style={{
            background: hovered ? 'var(--border)' : 'none',
            border: hovered ? '1px solid var(--border-bright)' : '1px solid transparent',
            borderRadius: 4,
            cursor: 'pointer', padding: '2px 5px',
            opacity: hovered ? 1 : 0.4,
            fontSize: 11,
            color: note.archived ? 'var(--accent)' : 'var(--dim)',
            display: 'flex', alignItems: 'center',
            transition: 'all 0.15s',
          }}
        >
          {note.archived ? '↩' : '📥'}
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(note.id) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#ff4444', display: 'flex', alignItems: 'center', opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}

function NewNoteCard({ onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--accent-dim)' : 'transparent',
        border: `1px dashed ${hovered ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 12, padding: 20, cursor: 'pointer',
        transition: 'all 0.15s', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 150,
        boxShadow: hovered ? 'var(--shadow-sm)' : 'none',
      }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, background: hovered ? 'var(--accent-dim)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
        <span style={{ fontSize: 18, color: hovered ? 'var(--accent)' : 'var(--dimmer)', fontWeight: 300, transition: 'color 0.15s' }}>+</span>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: hovered ? 'var(--accent)' : 'var(--dim)', transition: 'color 0.15s' }}>New Note</div>
        <div style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', marginTop: 3 }}>untitled.md</div>
      </div>
    </div>
  )
}

function NoteSearchBox({ value, onChange, inputRef }) {
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
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search notes..."
        style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text)', flex: 1, fontFamily: 'Geist, sans-serif' }}
      />
      {value && (
        <button onClick={() => onChange('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
      )}
    </div>
  )
}
