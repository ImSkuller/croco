// Priority colors are user-configurable (see lib/todoPriorities.js) — the
// caller resolves label/color/bg and passes them in, so this stays a dumb
// tab. `color`/`bg` default to the neutral "All" look when omitted.
export default function PriorityTab({ label, color = 'var(--dim)', bg = 'var(--border)', active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
        fontSize: 11, fontFamily: 'Geist Mono, monospace', fontWeight: active ? 500 : 400,
        background: active ? bg : 'transparent',
        color:      active ? color : 'var(--dimmer)',
        transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  )
}
