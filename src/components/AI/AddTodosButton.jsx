import { useState } from 'react'
import { patchData } from '../../lib/store'
import { useToast } from '../Toast/useToast.js'
import { CheckCircleIcon } from '../../constants/SimpleSvgExports'

// Turns a detected list (see lib/listItems.js) inside an AI reply into real
// todos with one click — bridges "the AI just broke this down into steps"
// into Croco's existing Todo system rather than making the user retype
// each item by hand. Reuses window.api.todos.create() exactly as Todo.jsx's
// own "add task" flow does, one call per item (no bulk-create command
// exists, and these lists are typically a handful of items).
export default function AddTodosButton({ items, projectId }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  if (!items?.length) return null

  const add = async () => {
    if (busy || done || !window.api) return
    setBusy(true)
    try {
      const created = []
      for (const title of items) {
        const todo = await window.api.todos.create({ title, projectId: projectId || null, priority: 'med' }).catch(() => null)
        if (todo) created.push(todo)
      }
      if (created.length) {
        patchData('todos', prev => [...created, ...(prev || [])])
        toast.success(`Added ${created.length} todo${created.length === 1 ? '' : 's'}`)
        setDone(true)
      } else {
        toast.error('Could not add todos', 'None of the items were saved.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={add}
      disabled={busy || done}
      title={done ? undefined : items.join('\n')}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6,
        padding: '4px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
        background: done ? 'var(--accent-dim)' : 'transparent', color: done ? 'var(--accent)' : 'var(--dim)',
        fontSize: 11, fontWeight: 600, cursor: (busy || done) ? 'default' : 'pointer',
        fontFamily: 'Geist, sans-serif', transition: 'all var(--transition-fast)',
      }}
    >
      <CheckCircleIcon size={11} />
      {done ? `Added ${items.length} todo${items.length === 1 ? '' : 's'}` : busy ? 'Adding…' : `Add ${items.length} as Todos`}
    </button>
  )
}
