// Small bits shared by several Settings sections.

export const codeStyle = {
  fontFamily:   'Geist Mono, monospace',
  fontSize:     11,
  background:   'var(--border)',
  color:        'var(--text)',
  padding:      '1px 5px',
  borderRadius: 'var(--r-sm)',
}

// Deep-merges a settings patch into the local copy, matching how the
// backend merges `settings.update` patches. Non-plain values (arrays, null,
// strings...) replace instead of merging.
const isPlain = (v) => v && typeof v === 'object' && !Array.isArray(v)
export function mergeDeep(base, patch) {
  if (!isPlain(base) || !isPlain(patch)) return patch
  const out = { ...base }
  for (const k of Object.keys(patch)) out[k] = mergeDeep(base[k], patch[k])
  return out
}
