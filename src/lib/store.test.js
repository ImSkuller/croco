import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useDataStore, refreshData, patchData, EMPTY_LIST } from './store'

const INITIAL_KEYS = ['projects', 'notes', 'todos', 'schedules', 'settings', 'activity', 'personality']

function resetStore() {
  const reset = Object.fromEntries(INITIAL_KEYS.map(k => [k, null]))
  useDataStore.setState({ ...reset, _fetchedAt: {}, _inflight: {} })
}

beforeEach(() => {
  resetStore()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  delete window.api
})

describe('EMPTY_LIST', () => {
  it('is a stable empty array reference', () => {
    expect(EMPTY_LIST).toEqual([])
  })
})

describe('ensure', () => {
  it('returns null and does nothing without window.api', async () => {
    delete window.api
    const result = await useDataStore.getState().ensure('projects')
    expect(result).toBeNull()
  })

  it('fetches and caches data on first call', async () => {
    const getAll = vi.fn().mockResolvedValue([{ id: '1' }])
    window.api = { projects: { getAll } }
    const result = await useDataStore.getState().ensure('projects')
    expect(result).toEqual([{ id: '1' }])
    expect(useDataStore.getState().projects).toEqual([{ id: '1' }])
    expect(getAll).toHaveBeenCalledTimes(1)
  })

  it('serves from cache within the TTL without refetching', async () => {
    const getAll = vi.fn().mockResolvedValue([{ id: '1' }])
    window.api = { projects: { getAll } }
    await useDataStore.getState().ensure('projects')
    await useDataStore.getState().ensure('projects')
    expect(getAll).toHaveBeenCalledTimes(1)
  })

  it('refetches once the TTL has elapsed', async () => {
    const getAll = vi.fn().mockResolvedValue([{ id: '1' }])
    window.api = { projects: { getAll } }
    await useDataStore.getState().ensure('projects')
    vi.advanceTimersByTime(31_000) // TTL is 30s
    await useDataStore.getState().ensure('projects')
    expect(getAll).toHaveBeenCalledTimes(2)
  })

  it('refetches immediately when force is true, even if fresh', async () => {
    const getAll = vi.fn().mockResolvedValue([{ id: '1' }])
    window.api = { projects: { getAll } }
    await useDataStore.getState().ensure('projects')
    await useDataStore.getState().ensure('projects', { force: true })
    expect(getAll).toHaveBeenCalledTimes(2)
  })

  it('coalesces concurrent calls into a single in-flight request', async () => {
    let resolveFetch
    const getAll = vi.fn(() => new Promise(res => { resolveFetch = res }))
    window.api = { projects: { getAll } }

    const p1 = useDataStore.getState().ensure('projects')
    const p2 = useDataStore.getState().ensure('projects')
    resolveFetch([{ id: '1' }])
    await Promise.all([p1, p2])

    expect(getAll).toHaveBeenCalledTimes(1)
  })

  it('falls back to null (not []) for settings on fetch failure', async () => {
    const get = vi.fn().mockRejectedValue(new Error('boom'))
    window.api = { settings: { get } }
    const result = await useDataStore.getState().ensure('settings')
    expect(result).toBeNull()
    expect(useDataStore.getState().settings).toBeNull()
  })

  it('leaves the previous value in place on fetch failure rather than clobbering it', async () => {
    useDataStore.setState({ todos: [{ id: 'stale-but-good' }] })
    const getAll = vi.fn().mockRejectedValue(new Error('boom'))
    window.api = { todos: { getAll } }
    // ensure() only replaces state in the success path — a rejection just
    // clears the in-flight marker and resolves to whatever was already
    // cached, so a transient failure can't blank out good data.
    const result = await useDataStore.getState().ensure('todos', { force: true })
    expect(result).toEqual([{ id: 'stale-but-good' }])
    expect(useDataStore.getState().todos).toEqual([{ id: 'stale-but-good' }])
  })
})

describe('setLocal / patchData', () => {
  it('replaces a collection directly', () => {
    useDataStore.getState().setLocal('todos', [{ id: 'a' }])
    expect(useDataStore.getState().todos).toEqual([{ id: 'a' }])
  })

  it('updates a collection via an updater function', () => {
    useDataStore.setState({ todos: [{ id: 'a', done: false }] })
    patchData('todos', list => list.map(t => ({ ...t, done: true })))
    expect(useDataStore.getState().todos).toEqual([{ id: 'a', done: true }])
  })
})

describe('invalidate', () => {
  it('clears freshness for the given keys, forcing the next ensure to refetch', async () => {
    const getAll = vi.fn().mockResolvedValue([])
    window.api = { projects: { getAll } }
    await useDataStore.getState().ensure('projects')
    useDataStore.getState().invalidate('projects')
    await useDataStore.getState().ensure('projects')
    expect(getAll).toHaveBeenCalledTimes(2)
  })

  it('clears every key when called with none', async () => {
    const projectsFetch = vi.fn().mockResolvedValue([])
    const notesFetch = vi.fn().mockResolvedValue([])
    window.api = { projects: { getAll: projectsFetch }, notes: { getAll: notesFetch } }
    await useDataStore.getState().ensure('projects')
    await useDataStore.getState().ensure('notes')
    useDataStore.getState().invalidate()
    await useDataStore.getState().ensure('projects')
    await useDataStore.getState().ensure('notes')
    expect(projectsFetch).toHaveBeenCalledTimes(2)
    expect(notesFetch).toHaveBeenCalledTimes(2)
  })
})

describe('refreshData', () => {
  it('force-refetches the given keys regardless of freshness', async () => {
    const getAll = vi.fn().mockResolvedValue([])
    window.api = { projects: { getAll } }
    await useDataStore.getState().ensure('projects')
    await refreshData('projects')
    expect(getAll).toHaveBeenCalledTimes(2)
  })
})
