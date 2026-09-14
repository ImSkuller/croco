// Shared source for project icon pickers (ProjectForm on create,
// ProjectDetail's Settings tab on edit) — was three separately hand-rolled
// emoji lists (~36, ~40, and a small todo-emoji set) that had already
// drifted out of sync with each other.
//
// Split from the ProjectIcon component itself (components/ui/ProjectIcon.jsx)
// because a file that exports a component can't also export plain
// constants/functions without breaking Vite Fast Refresh
// (react-refresh/only-export-components) — same reason ToastProvider.jsx
// and useToast.js are two files instead of one.
import {
  FolderIcon, TerminalIcon, DatabaseIcon, PackageIcon, WindowIcon, GameIcon,
  GitIcon, BranchIcon, ShieldIcon, LockIcon, PuzzleIcon, BulbIcon, FlameIcon,
  StarIcon, PaletteIcon, MusicNoteIcon, AIIcon, APIIcon, VaultIcon, KeyboardIcon,
} from '../constants/SimpleSvgExports'

// A much larger set than any of the three lists this replaces — dev/tech
// first (most relevant to a project icon), then creative, security, docs,
// nature/mascots, space, and general symbols.
export const EMOJI_OPTIONS = [
  '⚡','🚀','🔧','🛠️','🤖','📡','📦','🔬','💻','🖥️','⌨️','🧠','🔩','🧩','🔌','🪛','🖨️','💾','📀','🛰️',
  '🎨','🎮','🎵','🎧','📷','🎬','✏️','🖌️','🎭','🧵',
  '🔐','🔒','🔑','🛡️','🧾','🗝️','🚧','🧱',
  '📑','📗','📘','📙','📕','📓','📝','🔖','🗂️','📁',
  '🦊','🐙','🦋','🐢','🐉','🦖','🦕','🐝','🦉','🐺','🐸','🦁',
  '🌐','🌍','🌙','🌟','⭐','✨','🌈','☄️','🪐','🔮',
  '💡','🎯','🏆','🎁','☕','🍀','💎','🔥','❄️','🌊','🧊','🌿','🏗️','🧭','⚙️','🎲',
  '💀','☠️','👾','🧿','🩵',
]

// "SVG" project icons — an alternative to Unicode emoji, drawn from
// Croco's own icon set instead of relying on the OS's emoji font, so the
// project icon looks crisp and identical on Windows/macOS/Linux instead of
// varying with whatever emoji set the OS ships. Stored in the same
// `project.emoji` string field as `icon:<id>` — see isIconValue/ProjectIcon,
// the only place that needs to know about this encoding.
export const SVG_ICON_OPTIONS = [
  { id: 'folder',   Icon: FolderIcon,    color: '#e8c547' },
  { id: 'terminal', Icon: TerminalIcon,  color: '#6fdd9a' },
  { id: 'database', Icon: DatabaseIcon,  color: '#4a9eff' },
  { id: 'package',  Icon: PackageIcon,   color: '#e5854f' },
  { id: 'window',   Icon: WindowIcon,    color: '#a855f7' },
  { id: 'game',     Icon: GameIcon,      color: '#ff6b6b' },
  { id: 'git',      Icon: GitIcon,       color: '#f1502f' },
  { id: 'branch',   Icon: BranchIcon,    color: '#56c936' },
  { id: 'shield',   Icon: ShieldIcon,    color: '#4ad9d9' },
  { id: 'lock',     Icon: LockIcon,      color: '#ffd700' },
  { id: 'puzzle',   Icon: PuzzleIcon,    color: '#b48cf2' },
  { id: 'bulb',     Icon: BulbIcon,      color: '#ffb454' },
  { id: 'flame',    Icon: FlameIcon,     color: '#ff5e5e' },
  { id: 'star',     Icon: StarIcon,      color: '#ffd700' },
  { id: 'palette',  Icon: PaletteIcon,   color: '#e56aad' },
  { id: 'music',    Icon: MusicNoteIcon, color: '#4ad9d9' },
  { id: 'ai',       Icon: AIIcon,        color: '#61dafb' },
  { id: 'api',      Icon: APIIcon,       color: '#4a9eff' },
  { id: 'vault',    Icon: VaultIcon,     color: '#9a9ec0' },
  { id: 'keyboard', Icon: KeyboardIcon,  color: '#e8c547' },
]

const ICON_PREFIX = 'icon:'

export function isIconValue(value) {
  return typeof value === 'string' && value.startsWith(ICON_PREFIX)
}

export function iconValueFor(id) {
  return `${ICON_PREFIX}${id}`
}

export function findIcon(value) {
  const id = value.slice(ICON_PREFIX.length)
  return SVG_ICON_OPTIONS.find(o => o.id === id)
}
