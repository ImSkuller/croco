import { useState } from 'react'

export default function TextInput({ value, onChange, placeholder, mono, type = 'text', style: extraStyle = {} }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      style={{
        width: '100%', background: 'var(--base)',
        border: `1px solid ${focused ? 'var(--border-bright)' : 'var(--border)'}`,
        borderRadius: 8, padding: '8px 12px',
        fontSize: 13, color: 'var(--text)',
        fontFamily: mono ? 'Geist Mono, monospace' : 'Geist, sans-serif',
        outline: 'none', transition: 'border-color 0.15s',
        ...extraStyle,
      }}
    />
  )
}
