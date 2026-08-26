import Spinner from './Spinner'

export default function DepsBtn({ children, onClick, loading }) {
  return (
    <button
      disabled={loading}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)',
        background: 'var(--card)', color: loading ? 'var(--dimmer)' : 'var(--dim)',
        fontSize: 11, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Geist, sans-serif', transition: 'all 0.12s',
      }}
    >
      {loading && <Spinner size={10} />}
      {children}
    </button>
  )
}
