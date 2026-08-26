import { useState } from 'react'
import { FolderOpenIcon } from '../../constants/SimpleSvgExports'

export default function PathInput({ value, onChange, onBrowse, onBlur, disabled }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input
        value={value}
        onChange={e => !disabled && onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); onBlur?.() }}
        disabled={disabled}
        style={{
          flex: 1, background: disabled ? 'var(--hover-bg)' : 'var(--base)',
          border: `1px solid ${focused ? 'var(--border-bright)' : 'var(--border)'}`,
          borderRadius: 8, padding: '8px 12px',
          fontSize: 12, color: disabled ? 'var(--dimmer)' : 'var(--text)',
          fontFamily: 'Geist Mono, monospace',
          outline: 'none', transition: 'border-color 0.15s',
          cursor: disabled ? 'not-allowed' : 'text',
        }}
      />
      {!disabled && (
        <button
          onClick={onBrowse}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
            borderRadius: 8, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--dim)',
            fontSize: 12, cursor: 'pointer', fontFamily: 'Geist, sans-serif',
            flexShrink: 0, transition: 'all 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--dim)' }}
        >
          <FolderOpenIcon /> Browse
        </button>
      )}
    </div>
  )
}
