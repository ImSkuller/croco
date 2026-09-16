import { useState, useEffect, useMemo, useRef } from 'react'
import { layoutCommitGraph } from '../../lib/gitGraphLayout'
import { authorColor, initials } from '../../lib/projectDetailHelpers'
import DiffView from './DiffView'
import Spinner from './Spinner'

const ROW_H = 28
const LANE_W = 16
const NODE_R = 4
// Catppuccin Mocha accents — matches the IDE's own theme (monacoSetup.js)
// and file-type icon badges (FileTypeIcon.jsx) for a consistent palette
// across every place Croco draws something "developer-tool-graph-shaped".
const LANE_COLORS = ['#89b4fa', '#a6e3a1', '#f9e2af', '#f38ba8', '#cba6f7', '#fab387', '#94e2d5', '#f5c2e7']
const laneColor = (lane) => LANE_COLORS[lane % LANE_COLORS.length]

function refLabel(ref) {
  if (ref.startsWith('tag: ')) return { text: ref.slice(5), tag: true }
  return { text: ref.replace('HEAD -> ', ''), tag: false }
}

// Visual commit/branch graph for the Git tab — the single most-cited "why I
// use GitKraken" feature in the developer-tooling research behind this
// pass. Reuses git_get_graph_log's --all history (every local branch, not
// just the current one) and lib/gitGraphLayout.js's lane assignment; a
// plain commit list (the existing "Commit History" section) already shows
// the current branch linearly, this is the branch-topology view alongside it.
export default function CommitGraph({ projectId }) {
  const [commits, setCommits] = useState(null)
  const [selected, setSelected] = useState(null) // { hash, parents }
  const [diff, setDiff] = useState(null)
  const [diffLoading, setDiffLoading] = useState(false)
  // Bumped on every selectCommit call and every project switch so a
  // slow-to-resolve diff request from a stale click (or a previous project)
  // can recognize it's no longer current and not clobber a newer one.
  const diffRequestRef = useRef(0)

  // A hash selected in the previously-viewed project means nothing here —
  // reset during render (the standard "adjusting state when a prop
  // changes" pattern) rather than in the effect below, so it can't ever
  // paint a stale selection/diff for one project under another's header.
  const [prevProjectId, setPrevProjectId] = useState(projectId)
  if (projectId !== prevProjectId) {
    setPrevProjectId(projectId)
    setSelected(null)
    setDiff(null)
  }

  useEffect(() => {
    let cancelled = false
    // Invalidate any diff fetch still in flight from the previous project —
    // done here rather than during the render above since refs aren't
    // meant to be touched mid-render.
    diffRequestRef.current++
    window.api?.git.getGraphLog(projectId, 200)
      .then(data => { if (!cancelled) setCommits(data || []) })
      .catch(() => { if (!cancelled) setCommits([]) })
    return () => { cancelled = true }
  }, [projectId])

  const { nodes, edges, laneCount } = useMemo(() => layoutCommitGraph(commits || []), [commits])

  const selectCommit = async (node) => {
    setSelected(node)
    setDiff(null)
    const requestId = ++diffRequestRef.current
    if (!node.parents?.length) return // root commit — nothing to diff against
    setDiffLoading(true)
    try {
      const result = await window.api.git.diffBetweenRefs(projectId, node.parents[0], node.hash)
      if (diffRequestRef.current === requestId) setDiff(result?.diff || '')
    } catch {
      if (diffRequestRef.current === requestId) setDiff('')
    } finally {
      if (diffRequestRef.current === requestId) setDiffLoading(false)
    }
  }

  if (commits === null) {
    return <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px 0', color: 'var(--dimmer)', fontSize: 12 }}><Spinner size={12} /> Loading history…</div>
  }
  if (!commits.length) {
    return <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--dimmer)', fontSize: 12 }}>No commits yet</div>
  }

  const graphWidth = laneCount * LANE_W + LANE_W / 2
  const totalHeight = nodes.length * ROW_H

  return (
    <div>
      <div style={{ display: 'flex', overflowX: 'auto', maxHeight: 420, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
        <svg data-commit-graph="true" width={graphWidth} height={totalHeight} style={{ flexShrink: 0, display: 'block' }}>
          {edges.map((e, i) => {
            const x1 = e.fromLane * LANE_W + LANE_W / 2
            const y1 = e.fromRow * ROW_H + ROW_H / 2
            const x2 = e.toLane * LANE_W + LANE_W / 2
            const y2 = (e.toRow ?? nodes.length) * ROW_H + ROW_H / 2
            const color = laneColor(e.fromLane)
            if (e.fromLane === e.toLane) {
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.5} opacity={0.85} />
            }
            const midY = (y1 + y2) / 2
            return <path key={i} d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`} stroke={color} strokeWidth={1.5} fill="none" opacity={0.85} />
          })}
          {nodes.map(n => (
            <circle
              key={n.hash}
              cx={n.lane * LANE_W + LANE_W / 2} cy={n.row * ROW_H + ROW_H / 2} r={NODE_R}
              fill={laneColor(n.lane)} stroke="var(--surface)" strokeWidth={1.5}
            />
          ))}
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          {nodes.map(n => (
            <div
              key={n.hash}
              onClick={() => selectCommit(n)}
              style={{
                height: ROW_H, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', minWidth: 0,
                cursor: 'pointer', background: selected?.hash === n.hash ? 'var(--accent-dim)' : 'transparent',
                transition: 'background var(--transition-fast)',
              }}
              onMouseEnter={e => { if (selected?.hash !== n.hash) e.currentTarget.style.background = 'var(--hover-bg)' }}
              onMouseLeave={e => { if (selected?.hash !== n.hash) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                background: authorColor(n.author || ''), display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 6, fontWeight: 800, color: '#000',
              }}>{initials(n.author || '')}</div>
              <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'var(--orange)', flexShrink: 0 }}>{n.hash}</span>
              {n.refs?.map(r => {
                const { text, tag } = refLabel(r)
                return (
                  <span key={r} style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 'var(--r-xl)', flexShrink: 0, fontFamily: 'Geist Mono, monospace',
                    background: tag ? 'rgba(255,215,0,0.1)' : 'var(--accent-dim)', color: tag ? 'var(--yellow)' : 'var(--accent)',
                  }}>{tag ? `🏷 ${text}` : text}</span>
                )
              })}
              <span style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{n.message}</span>
              <span style={{ fontSize: 10, color: 'var(--dimmer)', flexShrink: 0 }}>{n.date}</span>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--orange)' }}>{selected.hash}</span>
            <span>{selected.message}</span>
          </div>
          {selected.parents?.length
            ? <DiffView loading={diffLoading} text={diff} />
            : <div style={{ fontSize: 11, color: 'var(--dimmer)', padding: '6px 0' }}>Initial commit — no parent to diff against.</div>}
        </div>
      )}
    </div>
  )
}
