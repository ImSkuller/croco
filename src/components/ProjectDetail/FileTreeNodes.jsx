const FILE_EXT_ICON = {
  '.js': '📄', '.jsx': '⚛️', '.ts': '📘', '.tsx': '⚛️',
  '.css': '🎨', '.scss': '🎨', '.html': '🌐', '.json': '{}',
  '.md': '📝', '.py': '🐍', '.go': '🐹', '.rs': '🦀',
  '.sh': '⚡', '.env': '🔑', '.yaml': '📋', '.yml': '📋',
  '.toml': '📋', '.vue': '💚', '.svelte': '🔥', '.astro': '🚀',
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
                <span style={{ fontSize: 13 }}>📁</span>
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
        const icon = FILE_EXT_ICON[node.ext] || '📄'
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
            <span style={{ fontSize: 12 }}>{icon}</span>
            <span style={{ fontSize: 11, color: 'var(--dim)', flex: 1 }}>{node.name}</span>
            {sizeStr && <span style={{ fontSize: 9, color: 'var(--dimmer)', flexShrink: 0 }}>{sizeStr}</span>}
          </div>
        )
      })}
    </>
  )
}
