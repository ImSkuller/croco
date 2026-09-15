// Assigns each commit a lane (column) and computes the parent-child edges
// for a git commit/branch graph visualization — the same general approach
// `git log --graph` itself uses: walk commits newest-to-oldest, track which
// commit hash each currently-open lane is waiting for next, continue a
// lane when its waited-for commit appears, converge multiple lanes that
// were waiting for the same commit (a fork point), and open a new lane for
// an unclaimed branch tip or a merge commit's non-primary parents.
//
// `commits` must already be in the order `git log --topo-order` gives
// (children before parents) — see git_get_graph_log in git_ops.rs.
export function layoutCommitGraph(commits) {
  const lanes = [] // lanes[i] = hash this lane is waiting for next, or null if free
  const laneOfHash = new Map()
  const rowOfHash = new Map()
  const nodes = []

  commits.forEach((commit, row) => {
    // Every lane currently waiting for this exact commit converges here —
    // only the first continues downward, the rest free up.
    const waiting = []
    lanes.forEach((h, i) => { if (h === commit.hash) waiting.push(i) })

    let lane
    if (waiting.length > 0) {
      lane = waiting[0]
      for (let i = 1; i < waiting.length; i++) lanes[waiting[i]] = null
    } else {
      lane = lanes.indexOf(null)
      if (lane === -1) { lane = lanes.length; lanes.push(null) }
    }

    const parents = commit.parents || []
    lanes[lane] = parents.length > 0 ? parents[0] : null
    // Reserve a column for any additional (merge) parents now, so that
    // when we reach that parent's own row later, it lands in a stable
    // lane instead of an arbitrary new one.
    for (let i = 1; i < parents.length; i++) {
      const p = parents[i]
      if (!lanes.includes(p)) {
        const free = lanes.indexOf(null)
        if (free === -1) lanes.push(p)
        else lanes[free] = p
      }
    }

    nodes.push({ ...commit, row, lane })
    laneOfHash.set(commit.hash, lane)
    rowOfHash.set(commit.hash, row)
  })

  // One edge per (commit, parent) pair, using each endpoint's own row/lane
  // from the walk above. A parent outside the visible window (the log is
  // capped at `limit`) has no row — that edge is left open-ended (toRow:
  // null) for the renderer to draw trailing off the bottom instead of
  // connecting to a node that isn't there.
  const edges = []
  for (const node of nodes) {
    for (const p of node.parents || []) {
      edges.push({
        fromRow: node.row,
        fromLane: node.lane,
        toRow: rowOfHash.has(p) ? rowOfHash.get(p) : null,
        toLane: laneOfHash.has(p) ? laneOfHash.get(p) : node.lane,
      })
    }
  }

  return { nodes, edges, laneCount: Math.max(1, lanes.length) }
}
