// A real per-file-type icon set for the IDE explorer/tabs, in the spirit of
// an icon pack like Catppuccin Icons — a short, recognizable glyph badge
// per language/file type, colored from the Catppuccin Mocha palette (same
// MIT-licensed colors as src/lib/monacoSetup.js's editor theme) — rather
// than the previous single generic file glyph with only its tint varying
// per extension. These are original glyph badges, not the actual
// third-party icon-pack artwork.
const MOCHA = {
  yellow: '#f9e2af', sky: '#89dceb', blue: '#89b4fa', peach: '#fab387',
  lavender: '#b4befe', maroon: '#eba0ac', green: '#a6e3a1', sapphire: '#74c7ec',
  red: '#f38ba8', mauve: '#cba6f7', pink: '#f5c2e7', teal: '#94e2d5',
  rosewater: '#f5e0dc', flamingo: '#f2cdcd', overlay1: '#7f849c',
}

const FILE_TYPES = {
  '.js':   { label: 'JS',  color: MOCHA.yellow },
  '.mjs':  { label: 'JS',  color: MOCHA.yellow },
  '.cjs':  { label: 'JS',  color: MOCHA.yellow },
  '.jsx':  { label: 'JSX', color: MOCHA.sky },
  '.ts':   { label: 'TS',  color: MOCHA.blue },
  '.tsx':  { label: 'TSX', color: MOCHA.blue },
  '.json': { label: '{ }', color: MOCHA.peach },
  '.md':   { label: 'MD',  color: MOCHA.lavender },
  '.mdx':  { label: 'MDX', color: MOCHA.lavender },
  '.rs':   { label: 'RS',  color: MOCHA.maroon },
  '.py':   { label: 'PY',  color: MOCHA.green },
  '.go':   { label: 'GO',  color: MOCHA.sapphire },
  '.java': { label: 'JV',  color: MOCHA.red },
  '.c':    { label: 'C',   color: MOCHA.blue },
  '.h':    { label: 'H',   color: MOCHA.blue },
  '.cpp':  { label: 'C++', color: MOCHA.blue },
  '.hpp':  { label: 'H++', color: MOCHA.blue },
  '.cs':   { label: 'C#',  color: MOCHA.mauve },
  '.html': { label: '</>', color: MOCHA.peach },
  '.css':  { label: '#',   color: MOCHA.blue },
  '.scss': { label: '#',   color: MOCHA.pink },
  '.less': { label: '#',   color: MOCHA.blue },
  '.yml':  { label: 'YML', color: MOCHA.mauve },
  '.yaml': { label: 'YML', color: MOCHA.mauve },
  '.toml': { label: 'TML', color: MOCHA.mauve },
  '.xml':  { label: 'XML', color: MOCHA.peach },
  '.sh':   { label: 'SH',  color: MOCHA.teal },
  '.sql':  { label: 'SQL', color: MOCHA.sapphire },
  '.php':  { label: 'PHP', color: MOCHA.mauve },
  '.rb':   { label: 'RB',  color: MOCHA.red },
  '.vue':  { label: 'VUE', color: MOCHA.green },
  '.svelte':{ label: 'SV', color: MOCHA.red },
  '.env':  { label: 'ENV', color: MOCHA.yellow },
  '.lock': { label: 'LCK', color: MOCHA.overlay1 },
  '.txt':  { label: 'TXT', color: MOCHA.overlay1 },
  '.svg':  { label: 'SVG', color: MOCHA.flamingo },
  '.png':  { label: 'IMG', color: MOCHA.rosewater },
  '.jpg':  { label: 'IMG', color: MOCHA.rosewater },
  '.jpeg': { label: 'IMG', color: MOCHA.rosewater },
  '.gif':  { label: 'IMG', color: MOCHA.rosewater },
  '.gitignore': { label: 'GIT', color: MOCHA.maroon },
}

function fileTypeMeta(name, ext) {
  if (name === '.gitignore' || name === '.gitattributes') return FILE_TYPES['.gitignore']
  return FILE_TYPES[ext] || null
}

export default function FileTypeIcon({ name, ext, size = 13 }) {
  const meta = fileTypeMeta(name, ext)
  if (!meta) {
    // Unknown type — a plain neutral dot-file glyph, no badge.
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="var(--dimmer)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 1.5h5l3 3v10a.5.5 0 0 1-.5.5h-7.5a.5.5 0 0 1-.5-.5v-12a.5.5 0 0 1 .5-.5z" />
        <path d="M9 1.5V4.5h3" />
      </svg>
    )
  }
  const fontSize = meta.label.length > 2 ? size * 0.42 : size * 0.5
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size + 4, height: size + 4, borderRadius: 4,
        background: `${meta.color}26`, border: `1px solid ${meta.color}55`,
        color: meta.color, fontSize, fontWeight: 700, lineHeight: 1,
        fontFamily: 'Geist Mono, monospace', flexShrink: 0, letterSpacing: '-0.02em',
      }}
    >
      {meta.label}
    </span>
  )
}
