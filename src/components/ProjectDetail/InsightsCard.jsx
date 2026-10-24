import { useState } from 'react'
import InfoSection from './InfoSection'
import { useToast } from '../Toast/useToast.js'

// Three on-demand analyses of the project folder (see insights.rs): lines of
// code per language, TODO/FIXME markers in comments, and a known-vulnerability
// check of the lockfile against OSV.dev. Nothing runs until Run is pressed —
// the dependency audit in particular sends package names/versions over the
// network, so it must stay an explicit action.
const TABS = [
  { id: 'code', label: 'Code stats' },
  { id: 'todos', label: 'TODO scan' },
  { id: 'audit', label: 'Dependency audit' },
]

const fmt = n => Number(n || 0).toLocaleString()

const box = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }
const btn = {
  padding: '5px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--dim)', fontSize: 11.5, fontFamily: 'Geist, sans-serif', cursor: 'pointer',
}

function CodeTable({ result }) {
  const right = { textAlign: 'right' }
  return (
    <div style={{ ...box, padding: '10px 14px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(4, auto)', gap: '4px 16px', fontSize: 11.5, fontFamily: 'Geist Mono, monospace' }}>
        {['Language', 'Files', 'Code', 'Comments', 'Blank'].map(h => (
          <div key={h} style={{ color: 'var(--dimmer)', ...(h === 'Language' ? {} : right) }}>{h}</div>
        ))}
        {result.languages.slice(0, 12).map(l => (
          <div key={l.name} style={{ display: 'contents' }}>
            <div style={{ color: 'var(--text)' }}>{l.name}</div>
            <div style={{ ...right, color: 'var(--dim)' }}>{fmt(l.files)}</div>
            <div style={{ ...right, color: 'var(--text)' }}>{fmt(l.code)}</div>
            <div style={{ ...right, color: 'var(--dim)' }}>{fmt(l.comments)}</div>
            <div style={{ ...right, color: 'var(--dim)' }}>{fmt(l.blanks)}</div>
          </div>
        ))}
        <div style={{ color: 'var(--accent)', fontWeight: 600 }}>Total</div>
        {['files', 'code', 'comments', 'blanks'].map(k => (
          <div key={k} style={{ ...right, color: 'var(--accent)' }}>{fmt(result.totals[k])}</div>
        ))}
      </div>
    </div>
  )
}

function TodoList({ result, onAdd }) {
  if (result.total === 0) return <div style={{ fontSize: 12, color: 'var(--green)' }}>No TODO / FIXME markers found.</div>
  return (
    <div style={{ ...box, maxHeight: 280, overflowY: 'auto' }}>
      <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--dimmer)', borderBottom: '1px solid var(--border)' }}>
        {fmt(result.total)} marker{result.total === 1 ? '' : 's'}{result.truncated ? ` (showing first ${result.items.length})` : ''}
      </div>
      {result.items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '6px 14px', borderBottom: '1px solid var(--border)', fontSize: 11.5 }}>
          <span style={{ color: it.tag === 'FIXME' || it.tag === 'BUG' ? '#ff6b35' : 'var(--blue)', fontFamily: 'Geist Mono, monospace', width: 46, flexShrink: 0 }}>{it.tag}</span>
          <span style={{ flex: 1, minWidth: 0, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.text}>{it.text || '—'}</span>
          <span style={{ color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', fontSize: 10.5, flexShrink: 0 }}>{it.file}:{it.line}</span>
          <button onClick={() => onAdd(it)} title="Create a todo from this" style={{ ...btn, padding: '1px 7px', fontSize: 10.5 }}>+ todo</button>
        </div>
      ))}
    </div>
  )
}

function AuditList({ result }) {
  if (!result.supported) {
    return <div style={{ fontSize: 12, color: 'var(--dimmer)' }}>No supported lockfile found (package-lock.json, Cargo.lock, or requirements.txt with pinned versions).</div>
  }
  if (result.vulnerable.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--green)' }}>No known vulnerabilities in {fmt(result.scanned)} packages ({result.sources.join(', ')}).</div>
  }
  const open = id => window.api?.system.openExternal(`https://osv.dev/vulnerability/${id}`)
  return (
    <div style={{ ...box, maxHeight: 300, overflowY: 'auto' }}>
      <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--orange)', borderBottom: '1px solid var(--border)' }}>
        {result.vulnerable.length} of {fmt(result.scanned)} packages have known advisories
      </div>
      {result.vulnerable.map((v, i) => (
        <div key={i} style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', fontSize: 11.5 }}>
          <div style={{ color: 'var(--text)', fontFamily: 'Geist Mono, monospace' }}>
            {v.name}@{v.version} <span style={{ color: 'var(--dimmer)' }}>· {v.ecosystem} · {v.advisoryCount} advisor{v.advisoryCount === 1 ? 'y' : 'ies'}</span>
          </div>
          {v.advisories.slice(0, 3).map(a => (
            <div key={a.id} style={{ color: 'var(--dim)', marginTop: 2 }}>
              <button onClick={() => open(a.id)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', cursor: 'pointer', fontSize: 11.5, fontFamily: 'inherit' }}>{a.id}</button>
              {a.summary ? ` — ${a.summary}` : ''}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function InsightsCard({ projectId }) {
  const toast = useToast()
  const [tab, setTab] = useState('code')
  const [data, setData] = useState({})
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState({})

  const run = async (id) => {
    if (!window.api) return
    setBusy(id)
    setError(e => ({ ...e, [id]: null }))
    try {
      const fn = { code: 'codeStats', todos: 'scanTodos', audit: 'auditDeps' }[id]
      const result = await window.api.insights[fn](projectId)
      setData(d => ({ ...d, [id]: result }))
    } catch (e) {
      setError(er => ({ ...er, [id]: String(e?.message || e) }))
    } finally { setBusy(null) }
  }

  const addTodo = async (item) => {
    try {
      await window.api.todos.create({
        title: `${item.tag}: ${item.text || item.file}`.slice(0, 140),
        projectId,
        priority: item.tag === 'FIXME' || item.tag === 'BUG' ? 'high' : 'med',
      })
      window.dispatchEvent(new CustomEvent('croco:data-changed'))
      toast.success('Todo added', `${item.file}:${item.line}`)
    } catch (e) { toast.error('Could not add todo', String(e?.message || e)) }
  }

  const result = data[tab]

  return (
    <InfoSection label="Insights">
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            ...btn, border: 'none', background: tab === t.id ? 'var(--card)' : 'transparent',
            color: tab === t.id ? 'var(--text)' : 'var(--dimmer)', fontWeight: tab === t.id ? 600 : 400,
          }}>{t.label}</button>
        ))}
        <button onClick={() => run(tab)} disabled={busy === tab} style={{ ...btn, marginLeft: 'auto', opacity: busy === tab ? 0.6 : 1 }}>
          {busy === tab ? 'Working…' : result ? 'Re-run' : 'Run'}
        </button>
      </div>

      {tab === 'audit' && !result && (
        <div style={{ fontSize: 11, color: 'var(--dimmer)', marginBottom: 8 }}>
          Checks your lockfile (package-lock.json, Cargo.lock, requirements.txt) against the free OSV.dev database.
          Only package names and versions are sent.
        </div>
      )}
      {error[tab] && <div style={{ fontSize: 12, color: '#ff4444' }}>{error[tab]}</div>}
      {!result && !error[tab] && busy !== tab && tab !== 'audit' && (
        <div style={{ fontSize: 12, color: 'var(--dimmer)' }}>Press Run to analyse this project.</div>
      )}

      {tab === 'code' && result && <CodeTable result={result} />}
      {tab === 'todos' && result && <TodoList result={result} onAdd={addTodo} />}
      {tab === 'audit' && result && <AuditList result={result} />}
    </InfoSection>
  )
}
