// Keyboard shortcut definitions + binding helpers — split out of AppShell.jsx
// so that Settings.jsx / ShortcutsSection.jsx can import plain data without
// pulling in the AppShell component (also fixes Vite Fast Refresh: a file
// that exports both a component and shared constants breaks HMR state
// preservation for that component).

// 'Mod' is a platform-neutral token meaning Ctrl on Windows/Linux, ⌘ on macOS —
// see formatKeyToken(), applied wherever these display arrays are rendered.
export const SHORTCUT_DEFS = [
  // Global
  { id: 'search',        group: 'Global',      desc: 'Search everything',       defaultKey: 'ctrl+k',     chord: false, remappable: true,  display: ['Mod', 'K']      },
  { id: 'help',          group: 'Global',      desc: 'Show keyboard shortcuts',  defaultKey: '?',          chord: false, remappable: true,  display: ['?']              },
  { id: 'open-settings', group: 'Global',      desc: 'Open Settings',           defaultKey: 'ctrl+,',     chord: false, remappable: true,  display: ['Mod', ',']      },
  // Navigation (chords: g then key)
  { id: 'goto-dash',     group: 'Navigation',  desc: 'Go to Dashboard',         defaultKey: 'g+d',        chord: true,  remappable: true,  display: ['G', 'then', 'D'] },
  { id: 'goto-projects', group: 'Navigation',  desc: 'Go to Projects',          defaultKey: 'g+p',        chord: true,  remappable: true,  display: ['G', 'then', 'P'] },
  { id: 'goto-notes',    group: 'Navigation',  desc: 'Go to Notes',             defaultKey: 'g+n',        chord: true,  remappable: true,  display: ['G', 'then', 'N'] },
  { id: 'goto-todos',    group: 'Navigation',  desc: 'Go to Todos',             defaultKey: 'g+t',        chord: true,  remappable: true,  display: ['G', 'then', 'T'] },
  { id: 'goto-settings', group: 'Navigation',  desc: 'Go to Settings',          defaultKey: 'g+s',        chord: true,  remappable: true,  display: ['G', 'then', 'S'] },
  { id: 'goto-ideas',    group: 'Navigation',  desc: 'Go to Ideas',             defaultKey: 'g+i',        chord: true,  remappable: true,  display: ['G', 'then', 'I'] },
  { id: 'goto-activity', group: 'Navigation',  desc: 'Go to Activity',          defaultKey: 'g+a',        chord: true,  remappable: true,  display: ['G', 'then', 'A'] },
  { id: 'goto-favs',     group: 'Navigation',  desc: 'Go to Favourites',        defaultKey: 'g+f',        chord: true,  remappable: true,  display: ['G', 'then', 'F'] },
  // Page-level (not remappable — registered per-page via useKeyboard)
  { id: 'focus-search',  group: 'Lists',       desc: 'Focus search box',        defaultKey: '/',          chord: false, remappable: false, display: ['/']              },
  { id: 'new-item',      group: 'Lists',       desc: 'New item',                defaultKey: 'ctrl+n',     chord: false, remappable: false, display: ['Mod', 'N']      },
  { id: 'run-toggle',    group: 'Project',     desc: 'Run / stop process',      defaultKey: 'ctrl+r',     chord: false, remappable: false, display: ['Mod', 'R']      },
  { id: 'switch-tabs',   group: 'Project',     desc: 'Switch tabs',             defaultKey: '1-9',        chord: false, remappable: false, display: ['1 – 9']          },
  { id: 'commit',        group: 'Project',     desc: 'Confirm commit',          defaultKey: 'ctrl+enter', chord: false, remappable: false, display: ['Mod', 'Enter']  },
  { id: 'open-ide',      group: 'Project',     desc: 'Open in IDE',             defaultKey: 'o',          chord: false, remappable: false, display: ['O']              },
  { id: 'save-note',     group: 'Note editor', desc: 'Save note',               defaultKey: 'ctrl+s',     chord: false, remappable: false, display: ['Mod', 'S']      },
  { id: 'bold',          group: 'Note editor', desc: 'Bold',                    defaultKey: 'ctrl+b',     chord: false, remappable: false, display: ['Mod', 'B']      },
  { id: 'italic',        group: 'Note editor', desc: 'Italic',                  defaultKey: 'ctrl+i',     chord: false, remappable: false, display: ['Mod', 'I']      },
  { id: 'close',         group: 'Anywhere',    desc: 'Close panel / go back',   defaultKey: 'escape',     chord: false, remappable: false, display: ['Esc']            },
]

// Build display tokens from a stored binding string like 'ctrl+k' → ['Mod', 'K']
export function bindingToDisplay(binding) {
  if (!binding) return []
  const parts = binding.split('+')
  return parts.map(p => p === 'ctrl' ? 'Mod' : p.charAt(0).toUpperCase() + p.slice(1))
}

// Merge defaults with user overrides
export function resolveBindings(overrides = {}) {
  return Object.fromEntries(
    SHORTCUT_DEFS.map(d => [d.id, overrides[d.id] || d.defaultKey])
  )
}

// Chord second-key (e.g. 'g+p' → 'p')
export function chordKey(binding) {
  const parts = binding.split('+')
  return parts[parts.length - 1]
}
