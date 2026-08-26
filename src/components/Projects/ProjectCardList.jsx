import { useState } from 'react'
import { CardBtn, VisibilityBadge } from './Exports.jsx'
import { GithubIcon, IDEIcon, FolderIcon, StarIcon } from '../../constants/SimpleSvgExports.jsx'

export default function ProjectCardList({ project, isRunning, onToggleFav, index, onClick }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          16,
        padding:      '12px 16px',
        background:   hovered ? 'var(--card-hover)' : index % 2 === 0 ? 'var(--card)' : 'transparent',
        border:       `1px solid ${hovered ? 'var(--border-bright)' : 'transparent'}`,
        borderRadius: 10,
        cursor:       'pointer',
        transition:   'all 0.12s',
      }}
    >
      <div style={{ width: 34, height: 34, borderRadius: 8, background: project.emojiColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
        {project.emoji}
      </div>

      {/* Name + desc */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{project.name}</span>
          <VisibilityBadge visibility={project.visibility} />
          {isRunning && (
            <span style={{ fontSize: 9, fontFamily: 'Geist Mono, monospace', padding: '2px 6px', borderRadius: 20, background: 'rgba(74,255,145,0.15)', color: 'var(--green)' }}>
              running
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--dimmer)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {project.description}
        </div>
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {(project.tags || []).slice(0, 3).map(tag => (
          <span key={tag} style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, background: 'var(--border)', color: 'var(--dim)', padding: '2px 6px', borderRadius: 3 }}>
            {tag}
          </span>
        ))}
      </div>

      {/* Language bar */}
      <div style={{ width: 60, height: 4, background: 'var(--border)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexShrink: 0 }}>
        {(project.languages || []).map((l, i) => (
          <div key={i} style={{ width: `${l.pct}%`, background: l.color, height: '100%' }} />
        ))}
      </div>

      {/* IDE */}
      <div style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', width: 60, flexShrink: 0 }}>
        {project.ide}
      </div>

      {/* GitHub */}
      <div style={{ width: 16, flexShrink: 0, color: project.github ? 'var(--dim)' : 'var(--dimmer)', opacity: project.github ? 1 : 0.3 }}>
        <GithubIcon />
      </div>

      {/* Last commit */}
      <div style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', width: 80, flexShrink: 0, textAlign: 'right' }}>
        {project.lastCommit}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 3, opacity: hovered ? 1 : 0, transition: 'opacity 0.12s', flexShrink: 0 }}>
        <CardBtn title="Open in IDE" onClick={e => { e.stopPropagation(); window.api?.projects.openInIDE(project.id) }}><IDEIcon /></CardBtn>
        <CardBtn title="Open Folder" onClick={e => { e.stopPropagation(); window.api?.projects.openFolder(project.id) }}><FolderIcon /></CardBtn>
        <button
          onClick={e => { e.stopPropagation(); onToggleFav(project.id) }}
          title="Favourite"
          style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, border: 'none', cursor: 'pointer', background: 'var(--border)', color: project.favourite ? 'var(--orange)' : 'var(--dim)', transition: 'all 0.12s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--border-bright)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--border)' }}
        >
          <StarIcon filled={project.favourite} />
        </button>
      </div>
    </div>
  )
}
