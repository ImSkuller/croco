import { useState, forwardRef } from 'react'
import { SearchIcon } from '../../constants/SimpleSvgExports'

const SearchBox = forwardRef(function SearchBox({ value, onChange, placeholder = 'Search projects...' }, ref) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          8,
      background:   'var(--card)',
      border:       `1px solid ${focused ? 'var(--border-bright)' : 'var(--border)'}`,
      borderRadius: 8,
      padding:      '7px 12px',
      flex:         1,
      maxWidth:     320,
      transition:   'border-color 0.15s',
    }}>
      <span style={{ color: 'var(--dimmer)', display: 'flex', flexShrink: 0 }}><SearchIcon /></span>
      <input
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        style={{
          background:  'none',
          border:      'none',
          outline:     'none',
          fontSize:    12,
          color:       'var(--text)',
          flex:        1,
          fontFamily:  'Geist, sans-serif',
        }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', fontSize: 14, lineHeight: 1, padding: 0 }}
        >
          ×
        </button>
      )}
    </div>
  )
})

export default SearchBox
