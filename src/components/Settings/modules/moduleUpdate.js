import { patchData, refreshData } from '../../../lib/store'

// Mirrors settings.rs::deep_merge exactly: plain objects recurse key by
// key, anything else (arrays, primitives, null) in the patch replaces the
// base value wholesale. Needed because module cards send partial nested
// patches — e.g. IdeModuleCard's `updateEditor({ fontSize })` only sends
// the one changed editor field, relying on the backend to preserve
// tabSize/wordWrap/etc. A shallow local merge would have briefly wiped
// those other fields from the optimistic cache instead of preserving them.
function deepMerge(base, patch) {
  if (isPlainObject(base) && isPlainObject(patch)) {
    const out = { ...base }
    for (const k of Object.keys(patch)) out[k] = deepMerge(base[k], patch[k])
    return out
  }
  return patch
}
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

// Every module card used to fire the backend write with no local store
// update at all — `window.api.settings.update(...)` and nothing else. The
// card reads its toggle state from `useData('settings')` (the shared
// zustand cache, 30s TTL), so a click looked broken: the switch just sat
// there until something else happened to revalidate the store. This
// patches `settings.modules.<moduleKey>` optimistically, then persists it;
// on failure it refetches the real settings from disk instead of leaving
// the optimistic guess in place.
export function patchModule(moduleKey, patch) {
  patchData('settings', prev => prev ? deepMerge(prev, { modules: { [moduleKey]: patch } }) : prev)
  return window.api?.settings.update({ modules: { [moduleKey]: patch } })
    .catch(err => { refreshData('settings'); throw err })
}
