import Spinner from './Spinner'

export default function DiffView({ loading, text }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0 8px 70px' }}>
        <Spinner size={12} />
        <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Loading diff…</span>
      </div>
    )
  }

  const lines = (text || '').split('\n').filter((l, i, arr) => !(i === arr.length - 1 && l === ''))
  if (lines.length === 0) {
    return (
      <div style={{ padding: '6px 0 6px 70px', fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
        No changes to show
      </div>
    )
  }

  return (
    <div style={{
      margin: '4px 0 8px 70px', padding: '8px 10px', borderRadius: 6,
      background: 'var(--base)', border: '1px solid var(--border)',
      overflowX: 'auto', fontFamily: 'Geist Mono, monospace', fontSize: 11, lineHeight: 1.5,
    }}>
      {lines.map((line, i) => {
        const isAdd  = line.startsWith('+') && !line.startsWith('+++')
        const isDel  = line.startsWith('-') && !line.startsWith('---')
        const isHunk = line.startsWith('@@')
        const isMeta = line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('+++') || line.startsWith('---')
        return (
          <div key={i} style={{
            whiteSpace: 'pre',
            color: isAdd ? '#4aff91' : isDel ? '#ff6b6b' : isHunk ? 'var(--blue)' : isMeta ? 'var(--dimmer)' : 'var(--dim)',
            background: isAdd ? 'rgba(74,255,145,0.06)' : isDel ? 'rgba(255,107,107,0.06)' : 'transparent',
          }}>
            {line || ' '}
          </div>
        )
      })}
    </div>
  )
}
