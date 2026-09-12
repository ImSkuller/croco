import { useEffect } from 'react'
import { setDiscordContext } from '../lib/discordPresence'

// Pages call this with what they want shown on the user's Discord profile —
// `details` is the top line ("Browsing Croco", "Editing <project>"), `state`
// the second line (a tab, an open file, an AI mode), and `githubUrl` (the
// project's real html_url, if any) adds a "View on GitHub" button. No-op
// cost when the Discord module is off: DiscordPresenceManager just won't
// forward it.
export default function useDiscordPresence(details, state = null, githubUrl = null) {
  useEffect(() => {
    if (details) setDiscordContext(details, state, githubUrl)
  }, [details, state, githubUrl])
}
