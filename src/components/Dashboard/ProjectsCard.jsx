import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IDEIcon } from '../../constants/SimpleSvgExports.jsx'

export default function ProjectCard({ project }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={() => navigate(`/projects/${project.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:   hovered ? 'var(--card-hover)' : 'var(--card)',
        border:       `1px solid ${hovered ? 'var(--border-bright)' : 'var(--border)'}`,
        borderRadius: 12,
        padding:      18,
        cursor:       'pointer',
        transform:    hovered ? 'translateY(-1px)' : 'translateY(0)',
        transition:   'all 0.15s',
        position:     'relative',
        overflow:     'hidden',
      }}
    >
      {hovered && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, var(--border-bright), transparent)' }} />
      )}

      {/* Icon + IDE badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: project.emojiColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
          {project.emoji}
        </div>
        <button
          onClick={e => { e.stopPropagation(); window.api?.projects.openInIDE(project.id) }}
          title="Open in IDE"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 7, background: 'none',
            border: '1px solid transparent', cursor: 'pointer', color: 'var(--dimmer)',
            opacity: hovered ? 1 : 0, transition: 'all 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--dim)'; e.currentTarget.style.background = 'var(--border)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--dimmer)'; e.currentTarget.style.background = 'none' }}
        >
          <IDEIcon />
        </button>
      </div>

      {/* Name + visibility */}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4, letterSpacing: -0.2, display: 'flex', alignItems: 'center', gap: 6 }}>
        {project.name}
        {project.visibility === 'hidden' && (
          <span style={{ fontSize: 9, fontFamily: 'Geist Mono, monospace', padding: '2px 5px', borderRadius: 3, background: 'var(--accent-dim)', color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            private
          </span>
        )}
      </div>

      {/* Description */}
      <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 12, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 30 }}>
        {project.description || <span style={{ color: 'var(--dimmer)' }}>No description</span>}
      </div>

      {/* Tags */}
      {(project.tags || []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
          {(project.tags || []).slice(0, 3).map(tag => (
            <span key={tag} style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, background: 'var(--border)', color: 'var(--dim)', padding: '2px 7px', borderRadius: 4 }}>
              {tag}
            </span>
          ))}
          {(project.tags || []).length > 3 && (
            <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'var(--dimmer)', padding: '2px 7px' }}>
              +{project.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        <span style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', color: 'var(--dimmer)' }}>
          {project.time}
        </span>
        <span style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', color: 'var(--dimmer)', background: 'var(--border)', padding: '2px 6px', borderRadius: 4 }}>
          {project.ide || 'vscode'}
        </span>
      </div>
    </div>
  )
}
