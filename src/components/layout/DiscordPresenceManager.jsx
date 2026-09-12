import { useEffect, useRef } from 'react'
import { useData } from '../../lib/store'
import { getDiscordContext, subscribeDiscordContext } from '../../lib/discordPresence'

const IDLE_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes of no input → "Idle"
const IDLE_CHECK_MS = 15 * 1000
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart']

// Mounted once in AppShell — the only thing that actually calls
// window.api.discord.setPresence. Owns idle detection; page-level context
// (what the user is doing) comes from lib/discordPresence.js, written to by
// useDiscordPresence() calls scattered across pages.
export default function DiscordPresenceManager() {
  const settings = useData('settings')
  const enabled = !!settings?.modules?.discord?.enabled && !!settings?.modules?.discord?.richPresence?.enabled
  // Fallback button target for every context that isn't scoped to a
  // project with its own repo (Dashboard, Notes, Settings, idle, an
  // unscoped AI chat, ...) — the user's own GitHub profile instead of no
  // button at all. A project's real repo (ctx.githubUrl) always wins when
  // present; this only fills the gap.
  const profileUrl = settings?.user?.github?.username ? `https://github.com/${settings.user.github.username}` : null
  const profileUrlRef = useRef(profileUrl)
  useEffect(() => { profileUrlRef.current = profileUrl }, [profileUrl])
  const lastActivityRef = useRef(0)
  const lastSentRef = useRef(null) // { details, state, githubUrl } | null
  const idleRef = useRef(false)

  useEffect(() => {
    const bump = () => { lastActivityRef.current = Date.now() }
    bump()
    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, bump, { passive: true }))
    return () => ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, bump))
  }, [])

  useEffect(() => {
    if (!window.api) return
    if (!enabled) {
      lastSentRef.current = null
      window.api.discord.clearActivity().catch(() => {})
      return
    }

    const send = (details, state, githubUrl) => {
      const next = { details, state: state || null, githubUrl: githubUrl || null }
      const prev = lastSentRef.current
      if (prev && prev.details === next.details && prev.state === next.state && prev.githubUrl === next.githubUrl) return
      lastSentRef.current = next
      window.api.discord.setPresence(next.details, next.state || undefined, next.githubUrl || undefined).catch(() => {})
    }

    const evaluate = () => {
      const idleNow = Date.now() - lastActivityRef.current >= IDLE_THRESHOLD_MS
      idleRef.current = idleNow
      if (idleNow) {
        send('Idle', null, profileUrlRef.current)
      } else {
        const ctx = getDiscordContext()
        send(ctx.details, ctx.state, ctx.githubUrl || profileUrlRef.current)
      }
    }

    evaluate()
    const unsubscribe = subscribeDiscordContext(() => { if (!idleRef.current) evaluate() })
    const interval = setInterval(evaluate, IDLE_CHECK_MS)
    return () => { unsubscribe(); clearInterval(interval) }
  }, [enabled])

  return null
}
