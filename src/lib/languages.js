// Overall language mix across projects, used by the Dashboard and Patterns so
// both show the same numbers.
//
// Weighted by bytes of code (each project's `lang.count`), not by the rounded
// per-project percentages: a 40-byte scratch project must not count as much
// as a 3 MB app. Data/markup formats (JSON, Markdown, YAML, XML, TOML…) are
// left out the same way GitHub's language bar leaves them out — otherwise
// lockfiles and docs drown the real languages — unless a project has nothing
// else, in which case they're all it has and still count.

export const NON_CODE_LANGUAGES = new Set(['JSON', 'Markdown', 'YAML', 'XML', 'TOML', 'Text', 'CSV'])

export function isCodeLanguage(name) {
  return !NON_CODE_LANGUAGES.has(name)
}

/** A project's languages with data/markup rows dropped (when real code exists). */
export function codeLanguagesOf(project) {
  const all = (project?.languages || []).filter(l => l && l.name && (l.count || 0) > 0)
  const code = all.filter(l => isCodeLanguage(l.name))
  return code.length > 0 ? code : all
}

/**
 * @returns {{name:string,color:string,count:number,pct:number}[]} sorted by
 * bytes, descending; pct is a share of the total, rounded.
 */
export function aggregateLanguages(projects) {
  const byName = new Map()
  let total = 0
  for (const p of projects || []) {
    for (const lang of codeLanguagesOf(p)) {
      const prev = byName.get(lang.name) || { name: lang.name, color: lang.color, count: 0 }
      prev.count += lang.count
      byName.set(lang.name, prev)
      total += lang.count
    }
  }
  return [...byName.values()]
    .sort((a, b) => b.count - a.count)
    .map(l => ({ ...l, pct: total > 0 ? Math.round((l.count / total) * 100) : 0 }))
}

const REFRESH_AFTER_MS = 3 * 24 * 60 * 60 * 1000

/** Whether a project's cached languages predate the filtering or are old. */
export function languagesNeedRefresh(project, now = Date.now()) {
  if (!project?.languagesScannedAt) return true
  const at = new Date(project.languagesScannedAt).getTime()
  return Number.isNaN(at) || now - at > REFRESH_AFTER_MS
}
