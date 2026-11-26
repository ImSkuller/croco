// One definition of "a project Croco still tracks": it exists, isn't in the
// Trash, and isn't archived. Counts, suggestions, patterns and lists all use
// this so they never disagree.

export function isActiveProject(project) {
  return !!project && !project.trashedAt && !project.archived
}

export function activeProjects(projects) {
  return (projects || []).filter(isActiveProject)
}

/**
 * Keeps the items (todos, schedules) that belong to no project or to an active
 * one. Items of archived, trashed or permanently deleted projects drop out —
 * they come back if the project is restored or unarchived.
 */
export function inActiveProjects(items, projects) {
  const ids = new Set(activeProjects(projects).map(p => p.id))
  return (items || []).filter(item => !item.projectId || ids.has(item.projectId))
}
