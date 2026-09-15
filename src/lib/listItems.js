// Detects a numbered/bulleted list in free-text (an AI reply, most often)
// and extracts each item's text — used to offer "Add as Todos" wherever a
// chat-style AI response is rendered (ChatPanel, ClaudeCodePanel). Requires
// at least 2 matching lines so a single stray bullet or numbered reference
// inside ordinary prose doesn't trigger the affordance.
const LIST_LINE_RE = /^\s*(?:[-*•]|\d+[.)])\s+(.+)$/

export function extractListItems(text) {
  if (!text) return []
  const items = []
  for (const line of text.split('\n')) {
    const m = LIST_LINE_RE.exec(line)
    if (m) items.push(m[1].trim())
  }
  return items.length >= 2 ? items : []
}
