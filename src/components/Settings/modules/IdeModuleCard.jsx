import { useData } from '../../../lib/store'
import { IDEIcon } from '../../../constants/SimpleSvgExports'
import { SettingsCard, FieldLabel, FieldDesc, TextInput, Toggle, ToggleChip, InfoBox } from '../Exports'
import ModuleHeader from './ModuleHeader'
import { patchModule } from './moduleUpdate'

const DEFAULT_EDITOR = {
  fontSize: 13, tabSize: 2, insertSpaces: true, wordWrap: 'off',
  minimap: false, lineNumbers: 'on', renderWhitespace: 'none',
  cursorBlinking: 'blink', formatOnSave: false, colorTheme: 'catppuccin-mocha',
}

export default function IdeModuleCard() {
  const settings = useData('settings')
  const ide = settings?.modules?.ide
  if (!settings) return null
  const editor = { ...DEFAULT_EDITOR, ...(ide.editor || {}) }
  const layout = { explorerSide: 'left', ...(ide.layout || {}) }
  const claudeCode = { enabled: false, permissionMode: 'plan', ...(ide.claudeCode || {}) }

  const updateModule = (patch) => patchModule('ide', patch).catch(() => {})
  const updateEditor = (patch) => updateModule({ editor: patch })
  const updateLayout = (patch) => updateModule({ layout: patch })
  const updateClaudeCode = (patch) => updateModule({ claudeCode: patch })

  // While the user is actually looking at the IDE, Croco's own nav sidebar
  // follows this same value (see AppShell.jsx) and animates to match —
  // having the app's nav and the IDE's file explorer stacked on the same
  // edge reads as redundant. That's purely a read of this one setting,
  // scoped to the /ide route — nothing else here needs to change for it.
  const setExplorerSide = (side) => updateLayout({ explorerSide: side })

  return (
    <SettingsCard>
      <ModuleHeader icon={<IDEIcon />} title="IDE" enabled={ide.enabled} onToggle={() => updateModule({ enabled: !ide.enabled })}
        desc="An embedded code editor — adds an IDE tab to the sidebar and to each project, for quick edits without leaving Croco." />
      {ide.enabled && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <InfoBox>
            This is a lightweight editor (syntax highlighting, multi-file tabs, save-to-disk, themed to match Croco) — not a replacement for your real IDE. No extensions, no debugger.
          </InfoBox>

          <div>
            <FieldLabel>Explorer Position</FieldLabel>
            <FieldDesc>Which side the file explorer sits on. While the IDE page is open, Croco's own sidebar follows this too, animating to the same side — everywhere else in the app, the sidebar stays put. There's also a quick-flip button right in the explorer panel itself.</FieldDesc>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <ToggleChip label="Left" active={layout.explorerSide !== 'right'} color="var(--accent)" bg="var(--accent-dim)" onClick={() => setExplorerSide('left')} />
              <ToggleChip label="Right" active={layout.explorerSide === 'right'} color="var(--accent)" bg="var(--accent-dim)" onClick={() => setExplorerSide('right')} />
            </div>
          </div>

          <div>
            <FieldLabel>Editor Color Theme</FieldLabel>
            <FieldDesc>Catppuccin Mocha is a real ported syntax theme (not just re-tinted chrome) and is the default regardless of your app-wide Croco theme — the same way a real IDE's editor theme is its own choice. "Match Croco Theme" instead derives editor colors from whatever app theme/accent is active.</FieldDesc>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <ToggleChip label="Catppuccin Mocha" active={editor.colorTheme !== 'croco'} color="var(--accent)" bg="var(--accent-dim)" onClick={() => updateEditor({ colorTheme: 'catppuccin-mocha' })} />
              <ToggleChip label="Match Croco Theme" active={editor.colorTheme === 'croco'} color="var(--accent)" bg="var(--accent-dim)" onClick={() => updateEditor({ colorTheme: 'croco' })} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <FieldLabel>Claude Code Panel</FieldLabel>
              <FieldDesc>Adds a Claude Code tab next to Ask AI, backed by your own locally-installed <code>claude</code> CLI, scoped to the open project's folder. Defaults to read-only ("Plan") permission — escalate per-session from inside the panel.</FieldDesc>
            </div>
            <Toggle value={claudeCode.enabled} onChange={() => updateClaudeCode({ enabled: !claudeCode.enabled })} />
          </div>

          <FieldLabel>Editor Preferences</FieldLabel>

          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <FieldDesc>Font size</FieldDesc>
              <TextInput type="number" value={editor.fontSize} onChange={v => updateEditor({ fontSize: Math.max(8, Math.min(32, Number(v) || 13)) })} mono />
            </div>
            <div style={{ flex: 1 }}>
              <FieldDesc>Tab size</FieldDesc>
              <TextInput type="number" value={editor.tabSize} onChange={v => updateEditor({ tabSize: Math.max(1, Math.min(8, Number(v) || 2)) })} mono />
            </div>
          </div>

          <div>
            <FieldDesc>Indentation</FieldDesc>
            <div style={{ display: 'flex', gap: 8 }}>
              <ToggleChip label="Spaces" active={editor.insertSpaces} color="var(--accent)" bg="var(--accent-dim)" onClick={() => updateEditor({ insertSpaces: true })} />
              <ToggleChip label="Tabs" active={!editor.insertSpaces} color="var(--accent)" bg="var(--accent-dim)" onClick={() => updateEditor({ insertSpaces: false })} />
            </div>
          </div>

          <div>
            <FieldDesc>Word wrap</FieldDesc>
            <div style={{ display: 'flex', gap: 8 }}>
              <ToggleChip label="Off" active={editor.wordWrap === 'off'} color="var(--accent)" bg="var(--accent-dim)" onClick={() => updateEditor({ wordWrap: 'off' })} />
              <ToggleChip label="On" active={editor.wordWrap === 'on'} color="var(--accent)" bg="var(--accent-dim)" onClick={() => updateEditor({ wordWrap: 'on' })} />
            </div>
          </div>

          <div>
            <FieldDesc>Line numbers</FieldDesc>
            <div style={{ display: 'flex', gap: 8 }}>
              {['on', 'relative', 'off'].map(v => (
                <ToggleChip key={v} label={v} active={editor.lineNumbers === v} color="var(--accent)" bg="var(--accent-dim)" onClick={() => updateEditor({ lineNumbers: v })} />
              ))}
            </div>
          </div>

          <div>
            <FieldDesc>Render whitespace</FieldDesc>
            <div style={{ display: 'flex', gap: 8 }}>
              {['none', 'boundary', 'all'].map(v => (
                <ToggleChip key={v} label={v} active={editor.renderWhitespace === v} color="var(--accent)" bg="var(--accent-dim)" onClick={() => updateEditor({ renderWhitespace: v })} />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <FieldLabel>Minimap</FieldLabel>
              <FieldDesc>The small code overview strip on the right edge.</FieldDesc>
            </div>
            <Toggle value={editor.minimap} onChange={() => updateEditor({ minimap: !editor.minimap })} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <FieldLabel>Format on Save</FieldLabel>
              <FieldDesc>Runs Monaco's built-in formatter before writing — works well for JSON/CSS/HTML; other languages fall back to saving as-is if no formatter is registered.</FieldDesc>
            </div>
            <Toggle value={editor.formatOnSave} onChange={() => updateEditor({ formatOnSave: !editor.formatOnSave })} />
          </div>
        </div>
      )}
    </SettingsCard>
  )
}
