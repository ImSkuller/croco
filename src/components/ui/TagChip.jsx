import { useData } from '../../lib/store'
import { hexToRgba } from '../../lib/todoPriorities'

// One chip for every place a tag renders (project cards, ProjectDetail,
// Notes, filters, editors). Color comes from settings.tags.catalog — a tag
// without an entry renders in the neutral look every tag had before the
// Tag Manager existed, so nothing changes until someone assigns a color.
export default function TagChip({ tag, prefix = '', active = false, onClick, onRemove, size = 'sm', style: extra = {} }) {
  const settings = useData('settings')
  const color = settings?.tags?.catalog?.[tag]?.color || null
  const clickable = !!onClick
  const pad = size === 'md' ? '4px 9px' : '2px 7px'
  const fontSize = size === 'md' ? 11 : 10

  const bg     = active ? (color ? hexToRgba(color, 0.25) : 'var(--accent-dim)') : color ? hexToRgba(color, 0.14) : 'var(--border)'
  const fg     = color ? color : active ? 'var(--accent)' : 'var(--dim)'
  const border = active ? (color || 'var(--accent)') : color ? hexToRgba(color, 0.35) : 'transparent'

  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontFamily: 'Geist Mono, monospace', fontSize, lineHeight: 1.4,
        padding: pad, borderRadius: 'var(--r-sm)',
        background: bg, color: fg, border: `1px solid ${border}`,
        cursor: clickable ? 'pointer' : 'default', userSelect: 'none',
        transition: 'background var(--transition-fast), border-color var(--transition-fast)',
        ...extra,
      }}
    >
      {prefix}{tag}
      {onRemove && (
        <button
          onClick={e => { e.stopPropagation(); onRemove() }}
          title="Remove"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.7, fontSize: 12, lineHeight: 1, padding: 0 }}
        >×</button>
      )}
    </span>
  )
}
