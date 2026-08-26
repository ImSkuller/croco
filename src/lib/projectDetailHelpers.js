import { marked } from 'marked'

const AUTHOR_PALETTE = ['#4a9eff', '#4aff91', '#ff6b35', '#a855f7', '#ffd700', '#ff4444', '#00d2ff', '#ff69b4']

export function authorColor(name = '') {
  let h = 0
  for (const c of name) h = ((h * 31) + c.charCodeAt(0)) >>> 0
  return AUTHOR_PALETTE[h % AUTHOR_PALETTE.length]
}

export function initials(name = '') {
  return name.trim().split(/\s+/).map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?'
}

marked.setOptions({ gfm: true, breaks: true })
export function renderMarkdown(md) {
  return marked.parse(md || '')
}

export const SHELL_OPTS_WIN  = [{ value: '', label: 'cmd.exe (default)' }, { value: 'powershell', label: 'PowerShell' }]
export const SHELL_OPTS_UNIX = [{ value: '', label: 'sh (default)' }, { value: 'bash', label: 'Bash' }, { value: 'zsh', label: 'Zsh' }, { value: 'fish', label: 'Fish' }]

// Handle \r (carriage return) for progress-bar-style output
export function applyTermText(prev, type, text) {
  const result = [...prev]
  const parts = text.split(/(\r\n|\n|\r)/)
  for (const part of parts) {
    if (part === '\r\n' || part === '\n') {
      result.push({ type, text: '' })
    } else if (part === '\r') {
      if (result.length > 0) result[result.length - 1] = { type, text: '' }
      else result.push({ type, text: '' })
    } else if (part !== '') {
      if (result.length === 0) result.push({ type, text: part })
      else result[result.length - 1] = { ...result[result.length - 1], text: result[result.length - 1].text + part }
    }
  }
  return result
}
