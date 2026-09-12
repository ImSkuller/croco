// Discord Rich Presence context — pages push what they're doing via
// useDiscordPresence(details, state); DiscordPresenceManager (mounted once
// in AppShell) owns idle detection and is the only thing that actually
// talks to the backend. Kept as a plain module-level store rather than a
// zustand slice since nothing needs to *render* off this data — components
// only ever write to it.
//
// "Last write wins" is intentional and sufficient here: when navigating
// from page A to page B, React mounts B's context-setting effect after
// unmounting A's, so B's call is always the final word for that render —
// no stack/priority system needed. A child that wants to be more specific
// than its parent (CodeEditor's "editing <file>" vs IDE.jsx's "Using the
// IDE") just needs to be the one whose effect fires last/most recently,
// which is already true for any mounted child relative to its parent.

const DEFAULT_CONTEXT = { details: 'Browsing Croco', state: null, githubUrl: null }

let currentContext = DEFAULT_CONTEXT
const listeners = new Set()

// githubUrl is the project's real html_url (project.githubUrl — NOT
// project.github, which is only the "owner/repo" string) — when present,
// DiscordPresenceManager attaches a "View on GitHub" button. Discord never
// shows a viewer their own activity's buttons back to them, only other
// people looking at the profile see it, so this can't be verified solo.
export function setDiscordContext(details, state = null, githubUrl = null) {
  currentContext = { details, state, githubUrl }
  listeners.forEach(l => l(currentContext))
}

export function subscribeDiscordContext(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getDiscordContext() {
  return currentContext
}
