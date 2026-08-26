import { CheckIcon } from '../../constants/SimpleSvgExports'

export default function IDEOption({ ide, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
        border: `1px solid ${selected ? 'var(--orange)' : 'var(--border)'}`,
        background: selected ? 'rgba(255,107,53,0.08)' : 'var(--base)',
        color: selected ? 'var(--orange)' : 'var(--dim)',
        fontSize: 12, fontFamily: 'Geist, sans-serif', fontWeight: selected ? 500 : 400,
        transition: 'all 0.12s', textAlign: 'left',
      }}
    >
      {ide.label}
      {selected && (
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <CheckIcon />
        </div>
      )}
    </button>
  )
}
