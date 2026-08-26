/**
 * Central data store (zustand) with stale-while-revalidate caching.
 *
 * Pages render instantly from in-memory data (like Discord), while a
 * background refresh keeps everything current. Mutations update the
 * store optimistically so every page reflects changes immediately —
 * no full refetch, no loading spinners after first load.
 *
 * Usage:
 *   const projects = useData('projects')          // auto-fetches when stale
 *   const { todos, notes } = useDataStore()        // raw access
 *   refreshData('todos')                           // force background refresh
 */
import { useEffect } from 'react'
import { create } from 'zustand'

const TTL = 30_000 // consider data fresh for 30s; navigation within it is instant

// Stable fallback for `useData(key) || EMPTY_LIST` — a fresh `[]` literal on
// every render defeats useMemo/useEffect dependency comparisons downstream
// (a "changed" array reference even though nothing changed), forcing
// unnecessary recomputation on every render. Never mutate this.
export const EMPTY_LIST = []

export const useDataStore = create((set, get) => ({
  projects: null,
  notes:    null,
  todos:    null,
  schedules: null,
  settings: null,
  activity: null,
  personality: null,

  _fetchedAt: {},
  _inflight:  {},

  /** Fetch `key` if missing or stale. Serves cached data instantly. */
  async ensure(key, { force = false } = {}) {
    if (!window.api) return null
    const state = get()
    const fresh = state[key] !== null &&
      Date.now() - (state._fetchedAt[key] || 0) < TTL
    if (!force && fresh) return state[key]
    if (state._inflight[key]) return state._inflight[key]

    const fetchers = {
      projects: () => window.api.projects.getAll(),
      notes:    () => window.api.notes.getAll(),
      todos:    () => window.api.todos.getAll(),
      schedules: () => window.api.schedules.getAll(),
      settings: () => window.api.settings.get(),
      activity: () => window.api.activity.getAll(200),
      personality: () => window.api.personality.getProfile(),
    }
    const p = fetchers[key]()
      .then(data => {
        set(s => ({
          [key]: data ?? (key === 'settings' ? null : []),
          _fetchedAt: { ...s._fetchedAt, [key]: Date.now() },
          _inflight:  { ...s._inflight,  [key]: null },
        }))
        return data
      })
      .catch(err => {
        console.error(`store: failed to load ${key}`, err)
        set(s => ({ _inflight: { ...s._inflight, [key]: null } }))
        return get()[key]
      })
    set(s => ({ _inflight: { ...s._inflight, [key]: p } }))
    return p
  },

  /** Optimistically patch a collection in place (no refetch). */
  setLocal(key, updater) {
    set(s => ({ [key]: typeof updater === 'function' ? updater(s[key]) : updater }))
  },

  /** Mark keys stale so the next ensure() refetches. */
  invalidate(...keys) {
    const list = keys.length ? keys : ['projects', 'notes', 'todos', 'schedules', 'settings', 'activity', 'personality']
    set(s => {
      const fetchedAt = { ...s._fetchedAt }
      for (const k of list) delete fetchedAt[k]
      return { _fetchedAt: fetchedAt }
    })
  },
}))

/** Force a background refresh of the given keys. */
export function refreshData(...keys) {
  const { ensure } = useDataStore.getState()
  const list = keys.length ? keys : ['projects', 'notes', 'todos', 'schedules', 'settings']
  return Promise.all(list.map(k => ensure(k, { force: true })))
}

/** Optimistic local update helper (usable outside components). */
export function patchData(key, updater) {
  useDataStore.getState().setLocal(key, updater)
}

/**
 * Hook: subscribe to a collection and keep it fresh.
 * Returns the cached value immediately (or null on very first load).
 */
export function useData(key) {
  const value  = useDataStore(s => s[key])
  const ensure = useDataStore(s => s.ensure)
  useEffect(() => { ensure(key) }, [key, ensure])
  return value
}

// Any component can dispatch `croco:data-changed` after a mutation;
// everything re-syncs in the background (single listener, app-wide).
if (typeof window !== 'undefined') {
  window.addEventListener('croco:data-changed', () => {
    useDataStore.getState().invalidate()
    refreshData()
  })
}
