// Shared button primitive — consolidates the app's ~9 independent Btn
// components (Dashboard/TopBtn, Todo/TopBtn, Todo/RowBtn, Projects/TopBtn,
// Projects/CardBtn, Projects/IconBtn, Projects/ViewBtn, ProjectDetail/DepsBtn,
// Settings/Buttons' SmallBtn/SaveBtn — see docs/ui-audit.md §2) into one,
// built on the .pm-btn-* classes that already existed in index.css but were
// used in exactly one place in the whole app before this. Migrating each
// existing call site onto this is still open (Phase 4.2, tracked in
// NOTES-followup.md) — this is the target, not a retroactive rename.
import { forwardRef } from 'react'

const VARIANT_CLASS = {
  primary:   'pm-btn-primary',
  secondary: 'pm-btn-secondary',
  danger:    'pm-btn-danger',
  icon:      'pm-btn-icon',
}

export const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', icon, children, className = '', ...props },
  ref
) {
  const cls = [VARIANT_CLASS[variant] || VARIANT_CLASS.secondary, size === 'sm' ? 'pm-btn-sm' : '', className]
    .filter(Boolean).join(' ')
  return (
    <button ref={ref} className={cls} {...props}>
      {icon}
      {children}
    </button>
  )
})
