import { useState } from 'react'
import { VisibilityBadge, CardBtn } from './Exports.jsx'
import { IDEIcon, StarIcon } from '../../constants/SimpleSvgExports.jsx'

export default function ProjectCardGrid({ project, isRunning, onToggleFav, onClick }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:   hovered ? 'var(--card-hover)' : 'var(--card)',
        border:       `1px solid ${hovered ? 'var(--border-bright)' : 'var(--border)'}`,
        borderRadius: 12, padding: 18, cursor: 'pointer',
        transform:    hovered ? 'translateY(-1px)' : 'translateY(0)',
        transition:   'all 0.15s', position: 'relative', overflow: 'hidden',
      }}
    >
      {hovered && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, var(--border-bright), transparent)' }} />
      )}

      {/* Header (Project Card header) */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: project.emojiColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
            {project.emoji}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', letterSpacing: -0.2, display: 'flex', alignItems: 'center', gap: 6 }}>
              {project.name}
              <VisibilityBadge visibility={project.visibility} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', marginTop: 2 }}>
              {project.ide}
            </div>
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onToggleFav(project.id) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--dimmer)', opacity: hovered || project.favourite ? 1 : 0, transition: 'opacity 0.15s' }}
        >
          <StarIcon filled={project.favourite} />
        </button>
      </div>

      {/* Description */}
      <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 12, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {project.description}
      </div>

      {/* Language bar */}
      <div style={{ height: 3, background: 'var(--border)', borderRadius: 10, overflow: 'hidden', display: 'flex', marginBottom: 12 }}>
        {(project.languages || []).map((l, i) => (
          <div key={i} style={{ width: `${l.pct}%`, background: l.color, height: '100%' }} />
        ))}
      </div>

      {/* Tags */}
      {(project.tags || []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
          {(project.tags || []).slice(0, 4).map(tag => (
            <span key={tag} style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, background: 'var(--border)', color: 'var(--dim)', padding: '3px 7px', borderRadius: 4 }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: isRunning ? '#4aff91' : 'var(--dimmer)',
            boxShadow:  isRunning ? '0 0 0 3px rgba(74,255,145,0.15)' : 'none',
            animation:  isRunning ? 'pmPulse 2s infinite' : 'none',
          }} />
          <span style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', color: isRunning ? '#4aff91' : 'var(--dimmer)' }}>
            {isRunning ? 'running' : project.time}
          </span>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: 4, opacity: hovered ? 1 : 0, transition: 'opacity 0.12s' }}>
          <CardBtn title="Open in IDE" onClick={e => { e.stopPropagation(); window.api?.projects.openInIDE(project.id) }}><IDEIcon /></CardBtn>
        </div>
      </div>
    </div>
  )
}
