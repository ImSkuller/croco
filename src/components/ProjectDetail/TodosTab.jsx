import { TagIcon, CheckCircleIcon, LinkIcon, CheckIcon } from '../../constants/SimpleSvgExports'
import { isTodoLocked } from '../../lib/todoPriorities'
import { EmptyState } from '../ui/EmptyState'

export default function TodosTab({ addingTodo, emojiPickerOpen, linkingTodoId, navigate, project, projectNotes, projectTodos, setAddingTodo, setEmojiPickerOpen, setLinkingTodoId, setProjectTodos, setTodoEmoji, setTodoInput, setTodoNoteId, setTodoNotePicker, setTodoPriority, todoEmoji, todoInput, todoNoteId, todoNotePicker, todoPriority }) {
  return (
    <div>
      {/* Add todo inline */}
      <div style={{ background: addingTodo ? 'var(--card)' : 'transparent', border: `1px solid ${addingTodo ? 'var(--orange)' : 'var(--border)'}`, borderRadius: 'var(--r-lg)', padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 14, height: 14, borderRadius: 'var(--r-sm)', border: '1px solid var(--border-bright)', flexShrink: 0 }} />
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
                style={{ width: 22, height: 22, borderRadius: 'var(--r-sm)', border: `1px solid ${todoEmoji ? 'var(--border-bright)' : 'transparent'}`, background: todoEmoji ? 'var(--border)' : 'transparent', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, color: 'var(--dimmer)' }}>
                {todoEmoji || <TagIcon size={13} />}
              </button>
              {emojiPickerOpen && (
                <div style={{ position: 'absolute', right: 0, top: '120%', zIndex: 60, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 8, display: 'flex', flexWrap: 'wrap', gap: 3, width: 184, boxShadow: '0 8px 28px rgba(0,0,0,0.45)' }}>
                  {['','✅','🐛','⚡','💡','🔥','📌','🔗','🎯','⚙️','🧪','📊','🔐','🌐','📱','🎨','🛠️','💬','🚀','📝'].map(e => (
                    <button key={e || 'none'} onClick={() => { setTodoEmoji(e); setEmojiPickerOpen(false) }}
                      style={{ width: 26, height: 26, borderRadius: 'var(--r-sm)', border: `1px solid ${todoEmoji === e ? 'var(--border-bright)' : 'transparent'}`, background: todoEmoji === e ? 'var(--border)' : 'transparent', cursor: 'pointer', fontSize: e ? 14 : 10, color: e ? undefined : 'var(--dimmer)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      {e || '—'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {[['high','#ff4444'],['med','#ffd700'],['low','#4aff91']].map(([p, color]) => (
              <button key={p} onClick={() => setTodoPriority(p)} title={p}
                style={{ width: 22, height: 22, borderRadius: 'var(--r-sm)', border: `1px solid ${todoPriority === p ? 'var(--border-bright)' : 'transparent'}`, background: todoPriority === p ? 'var(--border)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
              </button>
            ))}
            {/* Note link picker */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                title={todoNoteId ? `Linked: ${projectNotes.find(n => n.id === todoNoteId)?.title}` : 'Link to a note'}
                onClick={() => setTodoNotePicker(p => !p)}
                style={{ padding: '2px 7px', borderRadius: 'var(--r-sm)', border: `1px solid ${todoNoteId ? 'rgba(74,158,255,0.4)' : 'transparent'}`, background: todoNoteId ? 'rgba(74,158,255,0.1)' : 'transparent', cursor: 'pointer', display: 'flex', color: todoNoteId ? '#4a9eff' : 'var(--dimmer)' }}
              ><LinkIcon size={12} /></button>
              {todoNotePicker && (
                <div style={{ position: 'absolute', right: 0, top: '120%', zIndex: 50, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 6, minWidth: 200, boxShadow: '0 8px 28px rgba(0,0,0,0.45)' }}>
                  {[{ id: null, title: '— None', emoji: '' }, ...projectNotes].map(n => (
                    <button key={n.id || 'none'} onClick={() => { setTodoNoteId(n.id); setTodoNotePicker(false) }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 'var(--r-md)', border: 'none', background: todoNoteId === n.id ? 'var(--card)' : 'transparent', cursor: 'pointer', color: 'var(--text)', fontSize: 11, fontFamily: 'Geist, sans-serif' }}>
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
            style={{ padding: '4px 10px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--accent)', color: '#000', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Geist, sans-serif', flexShrink: 0 }}
          >
            Add
          </button>
        )}
      </div>

      {projectTodos.length === 0 ? (
        <EmptyState compact icon={<CheckCircleIcon size={24} />} title="No tasks for this project yet" body="Type above to add one." />
      ) : (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
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
                style={{ width: 16, height: 16, borderRadius: 'var(--r-sm)', flexShrink: 0, border: todo.completed ? 'none' : '1px solid var(--border-bright)', background: todo.completed ? '#4aff91' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.65 : 1, fontSize: 9, color: '#000', transition: 'all var(--transition-base)' }}
              >
                {todo.completed && <CheckIcon />}
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
                    style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', padding: '2px 7px', borderRadius: 'var(--r-sm)', background: 'rgba(74,158,255,0.1)', color: '#4a9eff', border: '1px solid rgba(74,158,255,0.2)', cursor: 'pointer', flexShrink: 0, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <LinkIcon size={9} /> {ln.title}
                  </button>
                ) : null
              })()}
              <span style={{ fontSize: 9, fontFamily: 'Geist Mono, monospace', padding: '2px 5px', borderRadius: 'var(--r-sm)', background: todo.priority === 'high' ? 'rgba(255,68,68,0.12)' : todo.priority === 'med' ? 'rgba(255,215,0,0.1)' : 'rgba(74,255,145,0.1)', color: todo.priority === 'high' ? '#ff4444' : todo.priority === 'med' ? '#ffd700' : '#4aff91' }}>{todo.priority}</span>
              {/* Link to note button */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  title="Link to a note"
                  onClick={() => setLinkingTodoId(linkingTodoId === todo.id ? null : todo.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: todo.linkedNoteId ? '#4a9eff' : 'var(--dimmer)', display: 'flex', padding: '0 2px', opacity: 0.7, transition: 'opacity var(--transition-fast)' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                  onMouseLeave={e => e.currentTarget.style.opacity = 0.7}
                ><LinkIcon size={12} /></button>
                {linkingTodoId === todo.id && (
                  <div style={{ position: 'absolute', right: 0, top: '120%', zIndex: 50, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 6, minWidth: 200, boxShadow: '0 8px 28px rgba(0,0,0,0.45)' }}>
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
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 'var(--r-md)', cursor: 'pointer', fontSize: 12, color: todo.linkedNoteId === n.id ? '#4a9eff' : 'var(--text)', background: todo.linkedNoteId === n.id ? 'rgba(74,158,255,0.08)' : 'transparent', transition: 'background var(--transition-fast)' }}
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
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', fontSize: 13, lineHeight: 1, padding: '0 2px', flexShrink: 0, opacity: 0.5, transition: 'opacity var(--transition-fast)' }}
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
  )
}
