export default function ViewBtn({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width:        28,
        height:       28,
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'center',
        borderRadius: 5,
        border:       'none',
        cursor:       'pointer',
        background:   active ? 'var(--card)' : 'transparent',
        color:        active ? 'var(--text)' : 'var(--dimmer)',
        transition:   'all 0.12s',
      }}
    >
      {children}
    </button>
  )
}
