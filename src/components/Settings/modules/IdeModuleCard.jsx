import { useData } from '../../../lib/store'
import { IDEIcon } from '../../../constants/SimpleSvgExports'
import { SettingsCard, FieldLabel, FieldDesc, TextInput, Toggle, ToggleChip, InfoBox } from '../Exports'
import ModuleHeader from './ModuleHeader'

const DEFAULT_EDITOR = {
  fontSize: 13, tabSize: 2, insertSpaces: true, wordWrap: 'off',
  minimap: false, lineNumbers: 'on', renderWhitespace: 'none',
  cursorBlinking: 'blink', formatOnSave: false,
}

export default function IdeModuleCard() {
  const settings = useData('settings')
  const ide = settings?.modules?.ide
  if (!settings) return null
  const editor = { ...DEFAULT_EDITOR, ...(ide.editor || {}) }

  const updateModule = (patch) => window.api?.settings.update({ modules: { ide: patch } }).catch(() => {})
  const updateEditor = (patch) => updateModule({ editor: patch })

  return (
    <SettingsCard>
      <ModuleHeader icon={<IDEIcon />} title="IDE" enabled={ide.enabled} onToggle={() => updateModule({ enabled: !ide.enabled })}
        desc="An embedded code editor — adds an IDE tab to the sidebar and to each project, for quick edits without leaving Croco." />
      {ide.enabled && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <InfoBox>
            This is a lightweight editor (syntax highlighting, multi-file tabs, save-to-disk, themed to match Croco) — not a replacement for your real IDE. No extensions, no debugger.
          </InfoBox>

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
