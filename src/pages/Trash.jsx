import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrashIcon, AlertTriangleIcon, FolderIcon, NoteIcon2, CheckCircleIcon, UndoIcon } from '../constants/SimpleSvgExports'
import { useData, patchData, refreshData, EMPTY_LIST } from '../lib/store'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { Button } from '../components/ui/Button.jsx'
import ConfirmModal from '../components/ProjectDetail/ConfirmModal'
import useDiscordPresence from '../hooks/useDiscordPresence'

// Must match TRASH_RETENTION_DAYS in src-tauri/src/main.rs — there is no
// single source of truth shared between Rust and JS for a plain constant
// like this, so keep the two in sync by hand if it ever changes.
const TRASH_RETENTION_DAYS = 30

const TYPE_META = {
  project: { label: 'Project', icon: <FolderIcon />,      restore: 'projects', navigateTo: id => `/projects/${id}` },
  note:    { label: 'Note',    icon: <NoteIcon2 />,       restore: 'notes',    navigateTo: null },
  todo:    { label: 'Todo',    icon: <CheckCircleIcon />, restore: 'todos',    navigateTo: null },
}

function daysLeft(trashedAt) {
  const trashedMs = new Date(trashedAt).getTime()
  if (Number.isNaN(trashedMs)) return TRASH_RETENTION_DAYS
  const elapsedDays = (Date.now() - trashedMs) / (1000 * 60 * 60 * 24)
  return Math.max(0, Math.ceil(TRASH_RETENTION_DAYS - elapsedDays))
}

export default function Trash() {
  useDiscordPresence('Browsing Croco', 'Trash')
  const navigate = useNavigate()
  const [modal,       setModal]       = useState(null) // { type, id, title } | 'empty-all' | null
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError,   setModalError]   = useState(null)

  const rawProjects = useData('projects')
  const rawNotes    = useData('notes')
  const rawTodos     = useData('todos')
  const loading = rawProjects === null && rawNotes === null && rawTodos === null

  const items = useMemo(() => {
    const projects = (rawProjects || EMPTY_LIST).filter(p => p.trashedAt).map(p => ({ id: p.id, type: 'project', title: p.name, trashedAt: p.trashedAt }))
    const notes    = (rawNotes    || EMPTY_LIST).filter(n => n.trashedAt).map(n => ({ id: n.id, type: 'note',    title: n.title, trashedAt: n.trashedAt }))
    const todos     = (rawTodos    || EMPTY_LIST).filter(t => t.trashedAt).map(t => ({ id: t.id, type: 'todo',    title: t.title, trashedAt: t.trashedAt }))
    return [...projects, ...notes, ...todos].sort((a, b) => new Date(b.trashedAt) - new Date(a.trashedAt))
  }, [rawProjects, rawNotes, rawTodos])

  const restore = async (type, id) => {
    if (!window.api) return
    const cacheKey = TYPE_META[type].restore
    patchData(cacheKey, prev => (prev || []).map(x => x.id === id ? { ...x, trashedAt: null } : x))
    try {
      await window.api[cacheKey].restore(id)
      window.dispatchEvent(new CustomEvent('croco:data-changed'))
    } catch (err) {
      console.error(err)
      refreshData(cacheKey)
    }
  }

  const deleteForever = async (type, id) => {
    if (!window.api) return
    const cacheKey = TYPE_META[type].restore
    await window.api[cacheKey].deletePermanently(id)
    patchData(cacheKey, prev => (prev || []).filter(x => x.id !== id))
    window.dispatchEvent(new CustomEvent('croco:data-changed'))
  }

  const runModal = async () => {
    if (!modal) return
    setModalLoading(true); setModalError(null)
    try {
      if (modal === 'empty-all') {
        for (const item of items) await deleteForever(item.type, item.id)
      } else {
        await deleteForever(modal.type, modal.id)
      }
      setModal(null)
    } catch (err) {
      setModalError(err.message || 'Something went wrong')
    } finally {
      setModalLoading(false)
    }
  }

  const modalProps = modal === 'empty-all'
    ? { title: 'Empty Trash?', desc: `This permanently deletes all ${items.length} item${items.length === 1 ? '' : 's'} in Trash. Project entries removed this way do not touch local files or any linked GitHub repository — only the Croco tracking record.`, warning: 'THIS ACTION CANNOT BE UNDONE.', confirmLabel: 'Empty Trash', confirmRed: true }
    : modal
      ? { title: `Delete "${modal.title}" Forever?`, desc: 'This permanently removes it. It cannot be restored after this.', warning: 'THIS ACTION CANNOT BE UNDONE.', confirmLabel: 'Delete Forever', confirmRed: true }
      : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 28px', height: 54, flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--dim)' }}>Trash</span>
        <span style={{ color: 'var(--dimmer)' }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{items.length} item{items.length === 1 ? '' : 's'}</span>
        {items.length > 0 && (
          <div style={{ marginLeft: 'auto' }}>
            <Button variant="danger" size="sm" onClick={() => setModal('empty-all')}>Empty Trash</Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div className="pm-page" style={{ padding: 28 }}>

          {!loading && items.length === 0 && (
            <EmptyState
              icon={<TrashIcon size={32} />}
              title="Trash is empty"
              body={`Projects, notes, and todos you delete stay recoverable here for ${TRASH_RETENTION_DAYS} days before they're removed automatically.`}
            />
          )}

          {items.length > 0 && (
            <div style={{
              fontSize: 11, color: 'var(--dim)', background: 'var(--card)',
              border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
              padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertTriangleIcon />
              Items are removed automatically {TRASH_RETENTION_DAYS} days after being trashed.
            </div>
          )}

          {items.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {items.map((item, i) => (
                <TrashRow
                  key={`${item.type}-${item.id}`}
                  item={item}
                  index={i}
                  onRestore={() => restore(item.type, item.id)}
                  onDeleteForever={() => setModal({ type: item.type, id: item.id, title: item.title })}
                  onOpen={() => {
                    const to = TYPE_META[item.type].navigateTo?.(item.id)
                    if (to) navigate(to)
                  }}
                />
              ))}
            </div>
          )}

        </div>
      </div>

      {modal && (
        <ConfirmModal
          modal={modalProps}
          input=""
          onInput={() => {}}
          loading={modalLoading}
          error={modalError}
          onConfirm={runModal}
          onCancel={() => { if (!modalLoading) { setModal(null); setModalError(null) } }}
        />
      )}
    </div>
  )
}

function TrashRow({ item, index, onRestore, onDeleteForever, onOpen }) {
  const [hovered, setHovered] = useState(false)
  const meta = TYPE_META[item.type]
  const left = daysLeft(item.trashedAt)
  const canOpen = !!meta.navigateTo

  return (
    <div
      onClick={canOpen ? onOpen : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
        background: hovered ? 'var(--card-hover)' : index % 2 === 0 ? 'var(--card)' : 'transparent',
        border: '1px solid transparent', borderRadius: 'var(--r-lg)',
        cursor: canOpen ? 'pointer' : 'default', transition: 'all var(--transition-fast)',
      }}
    >
      <div style={{ width: 34, height: 34, borderRadius: 'var(--r-md)', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dim)', flexShrink: 0 }}>
        {meta.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title || '(untitled)'}</span>
          <span style={{
            fontSize: 9, fontFamily: 'Geist Mono, monospace', padding: '2px 6px', borderRadius: 'var(--r-sm)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            background: 'var(--border)', color: 'var(--dim)', flexShrink: 0,
          }}>
            {meta.label}
          </span>
        </div>
        <div style={{ fontSize: 11, color: left <= 3 ? 'var(--orange)' : 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
          {left === 0 ? 'removed automatically today' : `${left} day${left === 1 ? '' : 's'} left`}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={e => { e.stopPropagation(); onRestore() }}
          title="Restore"
          style={{ padding: '6px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 11, fontWeight: 500, fontFamily: 'Geist, sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
        >
          <UndoIcon size={12} /> Restore
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDeleteForever() }}
          title="Delete forever"
          style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-md)', border: 'none', cursor: 'pointer', background: 'rgba(255,68,68,0.1)', color: '#ff5555' }}
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}
