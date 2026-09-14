import { isIconValue, findIcon } from '../../lib/projectIcons'

/** Renders a project's `emoji` field — either a literal emoji character or
 * one of Croco's own SVG icons (`icon:<id>`, see lib/projectIcons.js) —
 * falling back to the default folder emoji for anything unrecognized (a
 * deleted preset, an empty value). Every place that used to render
 * `{project.emoji}` directly renders `<ProjectIcon value={project.emoji} />`
 * instead. */
export function ProjectIcon({ value, size = 16, style }) {
  const found = isIconValue(value) ? findIcon(value) : null
  if (found) {
    const { Icon, color } = found
    return <span style={{ display: 'inline-flex', color, ...style }}><Icon size={size} /></span>
  }
  return <span style={style}>{value || '📁'}</span>
}
