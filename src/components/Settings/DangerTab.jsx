import { useState } from 'react'
import DangerSection from './DangerSection'

const notifyDataChanged = () => window.dispatchEvent(new CustomEvent('croco:data-changed'))

// Owns the Danger Zone's confirm dialogs and the bulk-delete handlers.
// `onReset` is supplied by the Settings page because resetting also has to
// re-apply the default look app-wide.
export default function DangerTab({ onReset }) {
  const [resetConfirm,  setResetConfirm]  = useState(false)
  const [rerunConfirm,  setRerunConfirm]  = useState(false)
  const [dangerConfirm, setDangerConfirm] = useState(null) // null | 'todos' | 'notes' | 'projects'

  const handleReset = async () => {
    await onReset()
    setResetConfirm(false)
  }

  const handleRerunSetup = async () => {
    await window.api?.settings.update({ app: { onboarded: false } }).catch(console.error)
    setRerunConfirm(false)
    window.location.reload()
  }

  // Deletes every item of one kind, then tells the rest of the app to refresh.
  const clearAll = async (kind) => {
    if (!window.api) return
    setDangerConfirm(null)
    const items = await window.api[kind].getAll().catch(console.error) || []
    await Promise.all(items.map(item => window.api[kind].delete(item.id).catch(console.error)))
    notifyDataChanged()
  }

  const dangerActions = {
    todos:    { label: 'Clear all todos?',     body: 'This will permanently delete every todo across all projects. This cannot be undone.', confirm: 'Clear Todos',  fn: () => clearAll('todos') },
    notes:    { label: 'Clear all notes?',     body: 'This will permanently delete every note across all projects. This cannot be undone.', confirm: 'Clear Notes',  fn: () => clearAll('notes') },
    projects: { label: 'Delete all projects?', body: 'This removes all project metadata from the app. Your actual code folders are not deleted.', confirm: 'Delete All', fn: () => clearAll('projects') },
  }

  return (
    <DangerSection
      rerunConfirm={rerunConfirm} setRerunConfirm={setRerunConfirm} handleRerunSetup={handleRerunSetup}
      resetConfirm={resetConfirm} setResetConfirm={setResetConfirm} handleReset={handleReset}
      dangerConfirm={dangerConfirm} setDangerConfirm={setDangerConfirm} dangerActions={dangerActions}
    />
  )
}
