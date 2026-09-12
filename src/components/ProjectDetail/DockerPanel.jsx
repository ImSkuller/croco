import { useState, useEffect, useCallback } from 'react'
import { PlayIcon, StopIcon, RefreshIcon, TerminalIcon } from '../../constants/SimpleSvgExports'
import { useToast } from '../Toast/useToast.js'
import Spinner from './Spinner'

export default function DockerPanel({ projectId }) {
  const toast = useToast()
  const [available, setAvailable] = useState(null)
  const [services, setServices] = useState(null)
  const [busyService, setBusyService] = useState(null)
  const [logs, setLogs] = useState(null)
  const [logsFor, setLogsFor] = useState(null)

  // Named for reuse by buttons (Refresh, and after any up/stop/down
  // action) — the initial mount fetch below deliberately does *not* call
  // this and instead chains .then/.catch directly, since calling an
  // async/await function bare from an effect (fire-and-forget, no
  // await) is exactly the pattern React's set-state-in-effect check
  // flags; a plain promise-chain callback is the sanctioned shape.
  const load = useCallback(async () => {
    if (!window.api) return
    const ok = await window.api.docker.available(projectId).catch(() => false)
    setAvailable(ok)
    if (ok) setServices(await window.api.docker.services(projectId).catch(() => []))
  }, [projectId])

  useEffect(() => {
    if (!window.api) return
    window.api.docker.available(projectId)
      .then(ok => {
        setAvailable(ok)
        if (ok) return window.api.docker.services(projectId).then(setServices)
      })
      .catch(() => setAvailable(false))
  }, [projectId])

  const withBusy = async (service, fn) => {
    setBusyService(service)
    try { await fn() } catch (e) { toast.error('Docker', e.message || String(e)) }
    await load()
    setBusyService(null)
  }

  const viewLogs = async (service) => {
    setLogsFor(service)
    setLogs(await window.api.docker.logs(projectId, service).catch(e => `Could not load logs: ${e.message || e}`))
  }

  if (available === null) return <div style={{ padding: '20px 0', fontSize: 12, color: 'var(--dimmer)' }}>Checking for a docker-compose file…</div>
  if (!available) return <div style={{ padding: '20px 0', fontSize: 12, color: 'var(--dimmer)' }}>No docker-compose file found in this project's root.</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>{services?.length || 0} service{services?.length === 1 ? '' : 's'}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={smallBtnStyle}><RefreshIcon size={12} /> Refresh</button>
          <button onClick={() => withBusy('__all__', () => window.api.docker.up(projectId, null))} style={smallBtnStyle}><PlayIcon size={12} /> Up All</button>
          <button onClick={() => withBusy('__all__', () => window.api.docker.down(projectId))} style={smallBtnStyle}><StopIcon size={12} /> Down</button>
        </div>
      </div>

      {!services?.length ? (
        <div style={{ fontSize: 12, color: 'var(--dimmer)' }}>No services defined.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {services.map(s => {
            const running = s.status?.toLowerCase().includes('running')
            const busy = busyService === s.name || busyService === '__all__'
            return (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '10px 14px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: running ? 'var(--green)' : 'var(--dimmer)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>{s.status}</div>
                </div>
                {busy ? <Spinner size={13} /> : (
                  <>
                    <button onClick={() => viewLogs(s.name)} title="Logs" style={iconBtnStyle}><TerminalIcon size={13} /></button>
                    {running ? (
                      <button onClick={() => withBusy(s.name, () => window.api.docker.stop(projectId, s.name))} title="Stop" style={iconBtnStyle}><StopIcon size={13} /></button>
                    ) : (
                      <button onClick={() => withBusy(s.name, () => window.api.docker.up(projectId, s.name))} title="Start" style={iconBtnStyle}><PlayIcon size={13} /></button>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {logsFor && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>Logs — {logsFor}</span>
            <button onClick={() => { setLogsFor(null); setLogs(null) }} style={{ background: 'none', border: 'none', color: 'var(--dimmer)', cursor: 'pointer', fontSize: 11, fontFamily: 'Geist, sans-serif' }}>Close</button>
          </div>
          <pre style={{ maxHeight: 300, overflow: 'auto', padding: '10px 12px', background: 'var(--base)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', fontSize: 11, fontFamily: 'Geist Mono, monospace', color: 'var(--dim)', whiteSpace: 'pre-wrap' }}>
            {logs ?? 'Loading…'}
          </pre>
        </div>
      )}
    </div>
  )
}

const smallBtnStyle = {
  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 'var(--r-sm)',
  border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)',
  fontSize: 11, cursor: 'pointer', fontFamily: 'Geist, sans-serif',
}
const iconBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26,
  borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', cursor: 'pointer', flexShrink: 0,
}
