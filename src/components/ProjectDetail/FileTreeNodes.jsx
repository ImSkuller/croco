import { FileIcon, FolderIcon } from '../../constants/SimpleSvgExports'

// A generic file icon tinted per extension (rather than per-language brand
// logos hand-drawn to match — see docs/ui-audit's emoji-removal pass) gives
// the same at-a-glance differentiation a colored-dot language legend does
// elsewhere in the app, without needing ~20 accurate brand marks.
const FILE_EXT_COLOR = {
  '.js': '#f0db4f', '.jsx': '#61dafb', '.ts': '#3178c6', '.tsx': '#61dafb',
  '.css': '#a855f7', '.scss': '#a855f7', '.html': '#e34c26', '.json': 'var(--dimmer)',
  '.md': 'var(--dim)', '.py': '#4b8bbe', '.go': '#00add8', '.rs': '#dea584',
  '.sh': '#4aff91', '.env': '#ffd700', '.yaml': 'var(--dim)', '.yml': 'var(--dim)',
  '.toml': 'var(--dim)', '.vue': '#42b883', '.svelte': '#ff3e00', '.astro': '#ff5d01',
}

export default function FileTreeNodes({ nodes, depth, expanded, setExpanded, onOpenFile, onContextMenu }) {
  if (!nodes || nodes.length === 0) return null
  return (
    <>
      {nodes.map(node => {
        const key = node.rel || node.name
        if (node.type === 'dir') {
          const isExpanded = expanded[key]
          const isIgnored  = node.ignored
          return (
            <div key={key}>
              <button
                onClick={() => !isIgnored && setExpanded(p => ({ ...p, [key]: !p[key] }))}
                onContextMenu={e => onContextMenu && onContextMenu(e, node.name + '/')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
                  background: 'none', border: 'none', cursor: isIgnored ? 'default' : 'pointer',
                  padding: `6px 12px 6px ${12 + depth * 16}px`,
                  borderBottom: '1px solid var(--border)',
                  opacity: isIgnored ? 0.4 : 1,
                }}
                onMouseEnter={e => { if (!isIgnored) e.currentTarget.style.background = 'var(--hover-bg)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
              >
                <span style={{ fontSize: 11, color: 'var(--dimmer)', width: 10, flexShrink: 0 }}>
                  {isIgnored ? '—' : isExpanded ? '▾' : '▸'}
                </span>
                <span style={{ display: 'flex', color: 'var(--dim)' }}><FolderIcon size={13} /></span>
                <span style={{ fontSize: 12, color: 'var(--dim)' }}>{node.name}</span>
                {isIgnored && (
                  <span style={{ fontSize: 9, color: 'var(--dimmer)', marginLeft: 4, fontFamily: 'Geist Mono, monospace' }}>ignored</span>
                )}
                {!isIgnored && node.children && (
                  <span style={{ fontSize: 9, color: 'var(--dimmer)', marginLeft: 'auto', fontFamily: 'Geist Mono, monospace' }}>
                    {node.children.length}
                  </span>
                )}
              </button>
              {isExpanded && node.children && (
                <FileTreeNodes nodes={node.children} depth={depth + 1} expanded={expanded} setExpanded={setExpanded} onOpenFile={onOpenFile} onContextMenu={onContextMenu} />
              )}
            </div>
          )
        }
        const iconColor = FILE_EXT_COLOR[node.ext] || 'var(--dimmer)'
        const sizeStr = node.size > 1024 * 1024
          ? `${(node.size / 1024 / 1024).toFixed(1)}MB`
          : node.size > 1024
          ? `${Math.round(node.size / 1024)}KB`
          : node.size > 0 ? `${node.size}B` : ''
        return (
          <div key={key}
            onClick={() => onOpenFile && onOpenFile(node.path)}
            onContextMenu={e => onContextMenu && onContextMenu(e, node.name)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              padding: `5px 12px 5px ${12 + depth * 16}px`,
              borderBottom: '1px solid var(--border)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <span style={{ width: 10, flexShrink: 0 }} />
            <span style={{ display: 'flex', color: iconColor }}><FileIcon size={12} /></span>
            <span style={{ fontSize: 11, color: 'var(--dim)', flex: 1 }}>{node.name}</span>
            {sizeStr && <span style={{ fontSize: 9, color: 'var(--dimmer)', flexShrink: 0 }}>{sizeStr}</span>}
          </div>
        )
      })}
    </>
  )
}
