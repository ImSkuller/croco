import { marked } from 'marked'
import DOMPurify from 'dompurify'

// The one shared markdown-render pipeline for the whole app — CLAUDE.md's
// own tech-stack table already documents "markdown via marked + dompurify"
// as the intended pattern; this file is what actually makes that true.
// Previously `NoteEditor.jsx` called `marked.parse()` directly into
// `dangerouslySetInnerHTML` with no sanitization step at all — low-risk
// there (a single local user's own note, never rendered for anyone else),
// but the exact same pattern would be a real stored-XSS vector the moment
// it renders untrusted OTHER users' content, which the social module's
// `.md` post attachments do. Built this pipeline properly before wiring
// that up, and moved NoteEditor onto it too rather than leaving two
// implementations (one sanitized, one not) of the same thing.
marked.setOptions({ gfm: true, breaks: true })

/**
 * Renders markdown to sanitized HTML safe to pass to dangerouslySetInnerHTML.
 * @param {string} text
 * @returns {string}
 */
export function renderMarkdown(text) {
  const html = marked.parse(text || '')
  return DOMPurify.sanitize(html)
}
