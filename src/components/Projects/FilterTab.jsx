export default function FilterTab({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          5,
        padding:      '5px 10px',
        borderRadius: 'var(--r-md)',
        border:       'none',
        cursor:       'pointer',
        fontSize:     12,
        fontWeight:   active ? 500 : 400,
        background:   active ? 'var(--card)' : 'transparent',
        color:        active ? 'var(--text)' : 'var(--dim)',
        transition:   'all 0.12s',
      }}
    >
      {label}
      <span style={{
        fontSize:     10,
        fontFamily:   'Geist Mono, monospace',
        background:   active ? 'var(--border)' : 'transparent',
        color:        active ? 'var(--text)' : 'var(--dimmer)',
        padding:      '1px 5px',
        borderRadius: 'var(--r-xl)',
        minWidth:     18,
        textAlign:    'center',
      }}>
        {count}
      </span>
    </button>
  )
}
