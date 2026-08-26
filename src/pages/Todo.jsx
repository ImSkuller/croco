import { useState, useRef, useEffect, useMemo } from 'react'
import { PlusIcon, ClockIcon } from '../constants/SimpleSvgExports'
import { TodoRow, TodoGroup, TopBtn, SearchBox, FilterTab, PriorityTab } from '../components/Todo/Exports'
import PriorityManagerModal from '../components/Todo/PriorityManagerModal'
import { ScheduleRow, ScheduleModal } from '../components/Schedules/Exports'
import { useKeyboard } from '../hooks/useKeyboard'
import { useData, patchData, refreshData, EMPTY_LIST } from '../lib/store'
import { normalizePriorities, hexToRgba, slugifyPriorityId } from '../lib/todoPriorities'

const FILTERS = ['All', 'Active', 'Completed']
const SCHEDULE_FILTERS = ['Upcoming', 'Overdue', 'Completed', 'All']

function scheduleDueMs(s) {
  if (!s.dueDate) return null
  return new Date(s.dueTime ? `${s.dueDate}T${s.dueTime}` : s.dueDate).getTime()
}

export default function Todo() {
  const [search,      setSearch]      = useState('')
  const [filter,      setFilter]      = useState('All')
  const [priority,    setPriority]    = useState('All')
  const [project,     setProject]     = useState('All Projects')
  const [editingId,   setEditingId]   = useState(null)
  const [editText,    setEditText]    = useState('')
  const [adding,      setAdding]      = useState(false)
  const [newText,     setNewText]     = useState('')
  const [newPriority, setNewPriority] = useState('med')
  const [newProjectId,setNewProjectId]= useState(null)
  const [newDueDate,  setNewDueDate]  = useState('')
  const [managingPriorities, setManagingPriorities] = useState(false)
  const [section,        setSection]        = useState('tasks') // 'tasks' | 'schedules'
  const [scheduleFilter, setScheduleFilter]  = useState('Upcoming')
  const [scheduleModal,  setScheduleModal]   = useState(null) // null = closed, 'new' = create, object = edit
  const addInputRef  = useRef(null)
  const editInputRef = useRef(null)
  const searchRef    = useRef(null)

  // Instant render from the shared cache; refreshes in the background
  const rawTodos    = useData('todos')
  const rawSchedules = useData('schedules')
  const projects    = useData('projects') || EMPTY_LIST
  const notes       = useData('notes') || EMPTY_LIST
  const settingsData = useData('settings')
  const loading  = rawTodos === null
  const schedulesLoading = rawSchedules === null

  const notesById = useMemo(() => Object.fromEntries(notes.map(n => [n.id, n])), [notes])

  const priorities = useMemo(() => normalizePriorities(settingsData?.todos?.priorities), [settingsData])

  // Falls back to a sensible default if the priority manager renamed/deleted
  // the id `newPriority` was initialized with — computed at render instead
  // of synced via effect, so there's no setState-during-effect cascade.
  const effectiveNewPriority = priorities.some(p => p.id === newPriority)
    ? newPriority
    : (priorities[Math.min(1, priorities.length - 1)]?.id || priorities[0]?.id)

  const todos = useMemo(() => {
    const projById = Object.fromEntries(projects.map(p => [p.id, p]))
    return (rawTodos || []).map(todo => ({
      ...todo,
      project: todo.projectId ? (projById[todo.projectId]?.name || null) : null,
    }))
  }, [rawTodos, projects])

  const schedules = useMemo(() => {
    const projById = Object.fromEntries(projects.map(p => [p.id, p]))
    return (rawSchedules || []).map(s => ({
      ...s,
      project: s.projectId ? (projById[s.projectId]?.name || null) : null,
    }))
  }, [rawSchedules, projects])

  useKeyboard({
    '/':      () => searchRef.current?.focus(),
    'ctrl+n': () => { setAdding(true); setTimeout(() => addInputRef.current?.focus(), 50) },
  })

  useEffect(() => { if (adding && addInputRef.current)    addInputRef.current.focus()  }, [adding])
  useEffect(() => { if (editingId && editInputRef.current) editInputRef.current.focus() }, [editingId])

  const toggle = async (id) => {
    if (!window.api) return
    // Optimistic — flips instantly
    patchData('todos', prev => (prev || []).map(t => t.id === id ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : null } : t))
    const updated = await window.api.todos.toggle(id).catch(err => { console.error(err); refreshData('todos'); return null })
    if (updated) patchData('todos', prev => (prev || []).map(t => t.id === id ? { ...t, ...updated } : t))
  }

  const remove = async (id) => {
    if (!window.api) return
    patchData('todos', prev => (prev || []).filter(t => t.id !== id))
    await window.api.todos.delete(id).catch(err => { console.error(err); refreshData('todos') })
  }

  const startEdit = (todo) => { setEditingId(todo.id); setEditText(todo.title) }

  const saveEdit = async (id) => {
    if (editText.trim() && window.api) {
      const title = editText.trim()
      patchData('todos', prev => (prev || []).map(t => t.id === id ? { ...t, title } : t))
      const updated = await window.api.todos.update(id, { title }).catch(err => { console.error(err); refreshData('todos'); return null })
      if (updated) patchData('todos', prev => (prev || []).map(t => t.id === id ? { ...t, ...updated } : t))
    }
    setEditingId(null); setEditText('')
  }

  const addTodo = async () => {
    if (!newText.trim() || !window.api) return
    const created = await window.api.todos.create({
      title:     newText.trim(),
      priority:  effectiveNewPriority,
      projectId: newProjectId,
      dueDate:   newDueDate || null,
    }).catch(console.error)
    if (created) {
      patchData('todos', prev => [created, ...(prev || [])])
    }
    setNewText(''); setAdding(false); setNewProjectId(null); setNewDueDate('')
  }

  // ── Schedules & deadlines CRUD — same optimistic-patch pattern as todos above ──
  const toggleSchedule = async (id) => {
    if (!window.api) return
    patchData('schedules', prev => (prev || []).map(s => s.id === id ? { ...s, completed: !s.completed, completedAt: !s.completed ? new Date().toISOString() : null } : s))
    const updated = await window.api.schedules.toggle(id).catch(err => { console.error(err); refreshData('schedules'); return null })
    if (updated) patchData('schedules', prev => (prev || []).map(s => s.id === id ? { ...s, ...updated } : s))
  }

  const removeSchedule = async (id) => {
    if (!window.api) return
    patchData('schedules', prev => (prev || []).filter(s => s.id !== id))
    await window.api.schedules.delete(id).catch(err => { console.error(err); refreshData('schedules') })
  }

  const saveSchedule = async (data) => {
    if (!window.api) return
    const editing = scheduleModal && scheduleModal !== 'new' ? scheduleModal : null
    if (editing) {
      patchData('schedules', prev => (prev || []).map(s => s.id === editing.id ? { ...s, ...data } : s))
      const updated = await window.api.schedules.update(editing.id, data).catch(err => { console.error(err); refreshData('schedules'); return null })
      if (updated) patchData('schedules', prev => (prev || []).map(s => s.id === editing.id ? { ...s, ...updated } : s))
    } else {
      const created = await window.api.schedules.create(data).catch(console.error)
      if (created) patchData('schedules', prev => [created, ...(prev || [])])
    }
    setScheduleModal(null)
  }

  // Priority CRUD — priorities live at settings.todos.priorities. Patched
  // optimistically into the shared 'settings' cache, then persisted; on
  // failure the store re-fetches to roll back, same pattern as todos above.
  const savePriorities = async (next) => {
    patchData('settings', prev => ({ ...(prev || {}), todos: { ...(prev?.todos || {}), priorities: next } }))
    await window.api?.settings.update({ todos: { priorities: next } }).catch(err => { console.error(err); refreshData('settings') })
  }

  const addPriority = (label, color) => {
    const id = slugifyPriorityId(label, priorities)
    savePriorities([...priorities, { id, label: label.trim() || 'Priority', color }])
  }

  const editPriority = (id, patch) => {
    savePriorities(priorities.map(p => (p.id === id ? { ...p, ...patch } : p)))
  }

  const reorderPriority = (fromId, toId) => {
    if (!fromId || fromId === toId) return
    const next = [...priorities]
    const fromI = next.findIndex(p => p.id === fromId)
    const toI = next.findIndex(p => p.id === toId)
    if (fromI === -1 || toI === -1) return
    const [moved] = next.splice(fromI, 1)
    next.splice(toI, 0, moved)
    savePriorities(next)
  }

  const deletePriority = async (id) => {
    if (priorities.length <= 1) return
    const fallback = priorities.find(p => p.id !== id)?.id
    await savePriorities(priorities.filter(p => p.id !== id))
    const affected = (rawTodos || []).filter(t => t.priority === id)
    for (const t of affected) {
      patchData('todos', prev => (prev || []).map(x => (x.id === t.id ? { ...x, priority: fallback } : x)))
      await window.api?.todos.update(t.id, { priority: fallback }).catch(() => refreshData('todos'))
    }
    // Schedules share the same customizable priority list — reassign those too.
    const affectedSchedules = (rawSchedules || []).filter(s => s.priority === id)
    for (const s of affectedSchedules) {
      patchData('schedules', prev => (prev || []).map(x => (x.id === s.id ? { ...x, priority: fallback } : x)))
      await window.api?.schedules.update(s.id, { priority: fallback }).catch(() => refreshData('schedules'))
    }
    if (priority === id) setPriority('All')
  }

  const projectNames = ['All Projects', ...projects.map(p => p.name)]

  const filtered = todos.filter(t => {
    const matchSearch   = t.title.toLowerCase().includes(search.toLowerCase())
    const matchFilter   = filter === 'All' ? true : filter === 'Active' ? !t.completed : t.completed
    const matchPriority = priority === 'All' ? true : t.priority === priority
    const matchProject  = project === 'All Projects' ? true : projects.find(p => p.id === t.projectId)?.name === project
    return matchSearch && matchFilter && matchPriority && matchProject
  })

  const counts = {
    All:       todos.length,
    Active:    todos.filter(t => !t.completed).length,
    Completed: todos.filter(t => t.completed).length,
  }

  const filteredSchedules = schedules.filter(s => {
    const matchSearch  = s.title.toLowerCase().includes(search.toLowerCase())
    const matchProject = project === 'All Projects' ? true : projects.find(p => p.id === s.projectId)?.name === project
    const dueMs = scheduleDueMs(s)
    const isOverdue = dueMs !== null && !s.completed && dueMs < new Date()
    const matchFilter =
      scheduleFilter === 'All'       ? true :
      scheduleFilter === 'Completed' ? s.completed :
      scheduleFilter === 'Overdue'   ? (!s.completed && isOverdue) :
      /* Upcoming */                   (!s.completed && !isOverdue)
    return matchSearch && matchProject && matchFilter
  })

  const scheduleCounts = {
    Upcoming:  schedules.filter(s => !s.completed && !(scheduleDueMs(s) !== null && scheduleDueMs(s) < new Date())).length,
    Overdue:   schedules.filter(s => !s.completed && scheduleDueMs(s) !== null && scheduleDueMs(s) < new Date()).length,
    Completed: schedules.filter(s => s.completed).length,
    All:       schedules.length,
  }

  // Grouped in the order priorities are configured — reordering a priority
  // in the manager moves its section in this list too.
  const groupedByPriority = priorities.map(p => ({
    priority: p,
    todos: filtered.filter(t => t.priority === p.id && !t.completed),
  }))

  const completedTodos = filtered.filter(t => t.completed)
  const completedByDate = {}
  for (const t of completedTodos) {
    const dateKey = t.completedAt
      ? new Date(t.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Unknown date'
    if (!completedByDate[dateKey]) completedByDate[dateKey] = []
    completedByDate[dateKey].push(t)
  }
  const completedGroups = Object.entries(completedByDate).sort((a, b) => {
    const da = a[1][0]?.completedAt
    const db = b[1][0]?.completedAt
    return new Date(db || 0) - new Date(da || 0)
  })

  const showGrouped = filter === 'All' && priority === 'All' && !search

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Topbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 28px', height: 54, flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--dim)' }}>Todo</span>
        <span style={{ color: 'var(--dimmer)' }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
          {section === 'tasks' ? `${filter} Tasks` : `${scheduleFilter} Schedules`}
        </span>

        <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--border)', borderRadius: 8, marginLeft: 8 }}>
          <button
            onClick={() => setSection('tasks')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 6, border: 'none',
              background: section === 'tasks' ? 'var(--card)' : 'transparent',
              color: section === 'tasks' ? 'var(--text)' : 'var(--dimmer)',
              fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'Geist, sans-serif',
            }}
          >
            Tasks
          </button>
          <button
            onClick={() => setSection('schedules')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 6, border: 'none',
              background: section === 'schedules' ? 'var(--card)' : 'transparent',
              color: section === 'schedules' ? 'var(--text)' : 'var(--dimmer)',
              fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'Geist, sans-serif',
            }}
          >
            <ClockIcon /> Schedules{scheduleCounts.All > 0 ? ` (${scheduleCounts.All})` : ''}
          </button>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {section === 'tasks' ? (
            <TopBtn onClick={() => setAdding(true)}>
              <PlusIcon /> New Task
            </TopBtn>
          ) : (
            <TopBtn onClick={() => setScheduleModal('new')}>
              <PlusIcon /> New Schedule
            </TopBtn>
          )}
        </div>
      </div>

      {/* ── Toolbar ── */}
      {section === 'tasks' ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 28px', borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap' }}>
        <SearchBox ref={searchRef} value={search} onChange={setSearch} />

        <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--border)', borderRadius: 8 }}>
          {FILTERS.map(f => (
            <FilterTab key={f} label={f} count={counts[f]} active={filter === f} onClick={() => setFilter(f)} />
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--border)', borderRadius: 8 }}>
            <PriorityTab label="All" active={priority === 'All'} onClick={() => setPriority('All')} />
            {priorities.map(p => (
              <PriorityTab key={p.id} label={p.label} color={p.color} bg={hexToRgba(p.color)} active={priority === p.id} onClick={() => setPriority(p.id)} />
            ))}
          </div>

          <button
            onClick={() => setManagingPriorities(true)}
            title="Manage priorities"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 7, flexShrink: 0,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--dimmer)', cursor: 'pointer', fontSize: 13,
            }}
          >
            ⚙
          </button>

          <select
            value={project}
            onChange={e => setProject(e.target.value)}
            style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              color: 'var(--dim)', borderRadius: 7, padding: '6px 10px',
              fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: 'pointer', outline: 'none',
            }}
          >
            {projectNames.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      ) : (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 28px', borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap' }}>
        <SearchBox ref={searchRef} value={search} onChange={setSearch} />

        <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--border)', borderRadius: 8 }}>
          {SCHEDULE_FILTERS.map(f => (
            <FilterTab key={f} label={f} count={scheduleCounts[f]} active={scheduleFilter === f} onClick={() => setScheduleFilter(f)} />
          ))}
        </div>

        <div style={{ marginLeft: 'auto' }}>
          <select
            value={project}
            onChange={e => setProject(e.target.value)}
            style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              color: 'var(--dim)', borderRadius: 7, padding: '6px 10px',
              fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: 'pointer', outline: 'none',
            }}
          >
            {projectNames.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      )}

      {/* ── Content ── */}
      {section === 'tasks' ? (
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div className="pm-page" style={{ maxWidth: 800, margin: '0 auto', padding: '24px 28px' }}>

          {/* Add new task inline */}
          {adding && (
            <div className="anim-scale-in" style={{ background: 'var(--card)', border: '1px solid var(--accent)', borderRadius: 10, padding: '14px 16px', marginBottom: 20, boxShadow: '0 0 0 1px var(--accent-dim)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 16, height: 16, borderRadius: 4,
                  border: '1px solid var(--accent)',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }} />
                <input
                  ref={addInputRef}
                  value={newText}
                  onChange={e => setNewText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addTodo(); if (e.key === 'Escape') { setAdding(false); setNewText('') } }}
                  placeholder="Task title..."
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)', fontFamily: 'Geist, sans-serif' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 26 }}>
                {priorities.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setNewPriority(p.id)}
                    style={{
                      padding: '3px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
                      fontSize: 10, fontFamily: 'Geist Mono, monospace',
                      background: effectiveNewPriority === p.id ? hexToRgba(p.color) : 'var(--border)',
                      color:      effectiveNewPriority === p.id ? p.color : 'var(--dimmer)',
                      outline:    effectiveNewPriority === p.id ? `1px solid ${p.color}40` : 'none',
                      transition: 'all 0.12s',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
                <select
                  value={newProjectId || ''}
                  onChange={e => setNewProjectId(e.target.value || null)}
                  style={{ background: 'var(--border)', border: 'none', color: 'var(--dim)', borderRadius: 4, padding: '3px 8px', fontSize: 10, fontFamily: 'Geist Mono, monospace', cursor: 'pointer', outline: 'none' }}
                >
                  <option value="">no project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={e => setNewDueDate(e.target.value)}
                  title="Due date (optional)"
                  style={{ background: 'var(--border)', border: 'none', color: newDueDate ? 'var(--text)' : 'var(--dimmer)', borderRadius: 4, padding: '2px 8px', fontSize: 10, fontFamily: 'Geist Mono, monospace', cursor: 'pointer', outline: 'none', colorScheme: 'dark' }}
                />
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <button onClick={() => { setAdding(false); setNewText('') }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
                    Cancel
                  </button>
                  <button onClick={addTodo} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#000', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
                    Add Task
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 10 }}>
              <div style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              <span style={{ fontSize: 13, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Loading tasks...</span>
            </div>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', gap: 14 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 18,
                background: 'var(--card)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, marginBottom: 4,
              }}>
                {filter === 'Completed' ? '📋' : '✅'}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', letterSpacing: -0.3 }}>
                {filter === 'Completed' ? 'No completed tasks yet' : search ? 'No tasks found' : 'All clear!'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--dim)', textAlign: 'center', maxWidth: 260, lineHeight: 1.5 }}>
                {search
                  ? 'Try a different search term'
                  : filter === 'Completed'
                    ? 'Complete a task and it will appear here.'
                    : 'Your todo list is empty. Add a task to get started.'}
              </div>
              {!search && filter !== 'Completed' && (
                <button
                  onClick={() => { setAdding(true); setTimeout(() => addInputRef.current?.focus(), 50) }}
                  style={{ marginTop: 4, padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#000', fontSize: 13, fontWeight: 600, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}
                >
                  Add First Task
                </button>
              )}
            </div>
          )}

          {/* Grouped view */}
          {!loading && showGrouped && filtered.length > 0 && (
            <>
              {groupedByPriority.map(({ priority: p, todos: pTodos }) => pTodos.length > 0 && (
                <TodoGroup key={p.id} label={`${p.label} Priority`} color={p.color} todos={pTodos} priorities={priorities} onToggle={toggle} onDelete={remove} onEdit={startEdit} editingId={editingId} editText={editText} setEditText={setEditText} onSaveEdit={saveEdit} editInputRef={editInputRef} />
              ))}
              {completedGroups.map(([dateLabel, dateTodos]) => (
                <TodoGroup key={dateLabel} label={`Completed · ${dateLabel}`} color="#444" todos={dateTodos} priorities={priorities} onToggle={toggle} onDelete={remove} onEdit={startEdit} editingId={editingId} editText={editText} setEditText={setEditText} onSaveEdit={saveEdit} editInputRef={editInputRef} done />
              ))}
            </>
          )}

          {/* Flat view */}
          {!loading && !showGrouped && filtered.length > 0 && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {filtered.map((todo, i) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  last={i === filtered.length - 1}
                  priorities={priorities}
                  onToggle={toggle}
                  onDelete={remove}
                  onEdit={startEdit}
                  editingId={editingId}
                  editText={editText}
                  setEditText={setEditText}
                  onSaveEdit={saveEdit}
                  editInputRef={editInputRef}
                />
              ))}
            </div>
          )}

        </div>
      </div>
      ) : (
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div className="pm-page" style={{ maxWidth: 800, margin: '0 auto', padding: '24px 28px' }}>

          {/* Loading */}
          {schedulesLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 10 }}>
              <div style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              <span style={{ fontSize: 13, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Loading schedules...</span>
            </div>
          )}

          {/* Empty state */}
          {!schedulesLoading && filteredSchedules.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', gap: 14 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 18,
                background: 'var(--card)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, marginBottom: 4,
              }}>
                🕐
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', letterSpacing: -0.3 }}>
                {search ? 'No schedules found' : 'Nothing scheduled'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--dim)', textAlign: 'center', maxWidth: 300, lineHeight: 1.5 }}>
                {search
                  ? 'Try a different search term'
                  : 'Schedules are dated commitments with a description and expiry — separate from your quick task list.'}
              </div>
              {!search && (
                <button
                  onClick={() => setScheduleModal('new')}
                  style={{ marginTop: 4, padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#000', fontSize: 13, fontWeight: 600, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}
                >
                  Add First Schedule
                </button>
              )}
            </div>
          )}

          {!schedulesLoading && filteredSchedules.length > 0 && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {filteredSchedules.map((s, i) => (
                <ScheduleRow
                  key={s.id}
                  schedule={s}
                  last={i === filteredSchedules.length - 1}
                  priorities={priorities}
                  notesById={notesById}
                  onToggle={toggleSchedule}
                  onDelete={removeSchedule}
                  onEdit={setScheduleModal}
                />
              ))}
            </div>
          )}

        </div>
      </div>
      )}

      {managingPriorities && (
        <PriorityManagerModal
          priorities={priorities}
          todos={rawTodos || []}
          onAdd={addPriority}
          onEdit={editPriority}
          onReorder={reorderPriority}
          onDelete={deletePriority}
          onClose={() => setManagingPriorities(false)}
        />
      )}

      {scheduleModal && (
        <ScheduleModal
          schedule={scheduleModal === 'new' ? null : scheduleModal}
          priorities={priorities}
          projects={projects}
          notes={notes}
          onSave={saveSchedule}
          onClose={() => setScheduleModal(null)}
        />
      )}

      {/* ── Stats footer ── */}
      {section === 'tasks' ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '10px 28px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{counts.Active}</span> active
        </span>
        <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
          <span style={{ color: '#4aff91', fontWeight: 600 }}>{counts.Completed}</span> completed
        </span>
        <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{counts.All}</span> total
        </span>
        {counts.All > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 100, height: 4, background: 'var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round((counts.Completed / counts.All) * 100)}%`, height: '100%', background: 'var(--green)', borderRadius: 10, transition: 'width 0.3s ease' }} />
            </div>
            <span style={{ fontSize: 11, color: 'var(--dim)', fontFamily: 'Geist Mono, monospace' }}>
              {Math.round((counts.Completed / counts.All) * 100)}%
            </span>
          </div>
        )}
      </div>
      ) : (
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '10px 28px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
          <span style={{ color: '#ff4444', fontWeight: 600 }}>{scheduleCounts.Overdue}</span> overdue
        </span>
        <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{scheduleCounts.Upcoming}</span> upcoming
        </span>
        <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
          <span style={{ color: '#4aff91', fontWeight: 600 }}>{scheduleCounts.Completed}</span> completed
        </span>
        <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{scheduleCounts.All}</span> total
        </span>
      </div>
      )}

    </div>
  )
}
