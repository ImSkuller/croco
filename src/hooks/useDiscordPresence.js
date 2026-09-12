import { useEffect } from 'react'
import { setDiscordContext } from '../lib/discordPresence'

// Pages call this with what they want shown on the user's Discord profile —
// `details` is the top line ("Browsing Croco", "Editing <project>"), `state`
// the second line (a tab, an open file, an AI mode). No-op cost when the
// Discord module is off: DiscordPresenceManager just won't forward it.
export default function useDiscordPresence(details, state = null) {
  useEffect(() => {
    if (details) setDiscordContext(details, state)
  }, [details, state])
}
