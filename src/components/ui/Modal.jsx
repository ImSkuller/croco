// Shared modal shell — the backdrop + centered panel + click-outside/Escape-
// to-close behavior that all 5 of the app's independent modal
// implementations duplicate (GitHub/CreateReleaseModal, ProjectDetail/
// ConfirmModal, Settings/ConfirmModal, Schedules/ScheduleModal, Todo/
// PriorityManagerModal — docs/ui-audit.md §2), plus ProjectDetail.jsx's
// inline, never-componentized "Publish to GitHub" modal. This is the shell
// only — each modal's specific content (confirm buttons, a form, a picker)
// stays as children; migrating the 5 existing implementations onto this is
// still open (Phase 4.2).
import { useEffect } from 'react'

export function Modal({ open, onClose, maxWidth = 440, children }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div
        className="pm-card"
        style={{
          maxWidth, width: '90%',
          padding: '24px 24px 20px',
          boxShadow: 'var(--shadow-lg)',
          animation: 'pmFadeDown 0.18s ease both',
        }}
      >
        {children}
      </div>
    </div>
  )
}
