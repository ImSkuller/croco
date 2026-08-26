import { NavLink } from "react-router-dom"

export default function SectionHeader({ title, action, link }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--dimmer)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'Geist Mono, monospace' }}>
        {title}
      </span>
      <span style={{ fontSize: 11, color: 'var(--dim)', cursor: 'pointer' }}>
        <NavLink
          to={link}
          end={link === '/'}
          style={{
            color: 'var(--dim)',
            textDecoration: 'none'
          }}>
            {action}
          </NavLink>
      </span>
    </div>
  )
}
