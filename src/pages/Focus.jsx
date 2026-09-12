import { useState, useEffect, useCallback, useMemo } from 'react'
import { useData, EMPTY_LIST } from '../lib/store'
import { ClockIcon, PlayIcon, StopIcon, CheckCircleIcon } from '../constants/SimpleSvgExports'
import { useToast } from '../components/Toast/useToast.js'
import useDiscordPresence from '../hooks/useDiscordPresence'

function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = String(Math.floor(total / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
}

// Local-only Pomodoro-style timer (see focus.rs) — the countdown/auto-
// complete notification only fires while this page stays mounted; the
// session itself (started/ended timestamps) is always tracked server-side
// regardless, so history and today's stats stay correct either way.
export default function Focus() {
  const toast = useToast()
  const settings = useData('settings')
  const projects = useData('projects') || EMPTY_LIST
  const [active, setActive] = useState(null)
  const [history, setHistory] = useState([])
  const [stats, setStats] = useState({ workMinutes: 0, sessionsCompleted: 0 })
  const [projectId, setProjectId] = useState('')
  const [now, setNow] = useState(() => Date.now())

  const workMinutes = settings?.modules?.focusTimer?.workMinutes ?? 25
  const breakMinutes = settings?.modules?.focusTimer?.breakMinutes ?? 5
  const activeProjects = useMemo(() => projects.filter(p => !p.trashedAt && !p.archived), [projects])

  const refresh = useCallback(() => {
    if (!window.api) return
    window.api.focus.getActive().then(setActive).catch(() => {})
    window.api.focus.getHistory(20).then(setHistory).catch(() => {})
    window.api.focus.getTodayStats().then(setStats).catch(() => {})
  }, [])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const targetMs = active ? (active.kind === 'work' ? workMinutes : breakMinutes) * 60 * 1000 : 0
  const elapsedMs = active ? now - new Date(active.startedAt).getTime() : 0
  const remainingMs = targetMs - elapsedMs

  useDiscordPresence(
    active ? (active.kind === 'work' ? 'Focusing' : 'On a break') : 'Focus Timer',
    active ? `${Math.max(0, Math.ceil(remainingMs / 60000))} min left` : null
  )

  // The backend scheduler (focus.rs) ends the session and sends the
  // notification when the planned end passes — even with this page closed.
  // This page only needs to refresh when that happens.
  useEffect(() => window.api?.focus.onEnded?.(() => refresh()), [refresh])

  const start = async (kind) => {
    if (!window.api) return
    const session = await window.api.focus.start(projectId || null, kind).catch(e => { toast.error('Could not start session', e.message); return null })
    if (session) setActive(session)
  }

  const stop = async () => {
    if (!window.api || !active) return
    await window.api.focus.end(active.id).catch(() => {})
    refresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 28px', height: 54, flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--accent)', display: 'flex' }}><ClockIcon /></span>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Focus</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 48, fontWeight: 700, fontFamily: 'Geist Mono, monospace', color: active ? 'var(--text)' : 'var(--dimmer)' }}>
            {active ? formatElapsed(Math.max(0, remainingMs)) : `${workMinutes}:00`}
          </div>
          <div style={{ fontSize: 12, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Geist Mono, monospace' }}>
            {active ? (active.kind === 'work' ? 'Focusing' : 'On a break') : 'Ready'}
          </div>
        </div>

        {!active ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} style={selectStyle}>
              <option value="">No project</option>
              {activeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => start('work')} style={primaryBtnStyle}><PlayIcon size={13} /> Start Work ({workMinutes}m)</button>
              <button onClick={() => start('break')} style={secondaryBtnStyle}><PlayIcon size={13} /> Start Break ({breakMinutes}m)</button>
            </div>
          </div>
        ) : (
          <button onClick={stop} style={{ ...secondaryBtnStyle, color: 'var(--red, #ff5050)' }}><StopIcon size={13} /> End Session</button>
        )}

        <div style={{ display: 'flex', gap: 24 }}>
          <Stat label="Focused today" value={`${stats.workMinutes}m`} />
          <Stat label="Sessions completed" value={stats.sessionsCompleted} />
        </div>

        {history.length > 0 && (
          <div style={{ width: '100%', maxWidth: 420 }}>
            <div style={{ fontSize: 11, color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Geist Mono, monospace', marginBottom: 8 }}>Recent Sessions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {history.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', fontSize: 12 }}>
                  <span style={{ display: 'flex', color: s.kind === 'work' ? 'var(--accent)' : 'var(--dimmer)' }}><CheckCircleIcon size={13} /></span>
                  <span style={{ color: 'var(--text)', textTransform: 'capitalize' }}>{s.kind}</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
                    {new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--dimmer)' }}>{label}</div>
    </div>
  )
}

const selectStyle = {
  background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 'var(--r-md)', padding: '7px 10px', fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: 'pointer',
}
const primaryBtnStyle = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 'var(--r-lg)',
  border: 'none', background: 'var(--accent)', color: '#000', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'Geist, sans-serif',
}
const secondaryBtnStyle = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 'var(--r-lg)',
  border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 12,
  cursor: 'pointer', fontFamily: 'Geist, sans-serif',
}
