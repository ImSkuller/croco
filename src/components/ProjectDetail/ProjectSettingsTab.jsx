import { PackageIcon } from '../../constants/SimpleSvgExports'
import { SHELL_OPTS_WIN, SHELL_OPTS_UNIX } from '../../lib/projectDetailHelpers'
import TagChip from '../ui/TagChip'
import { EMOJI_OPTIONS, SVG_ICON_OPTIONS, iconValueFor } from '../../lib/projectIcons'
import { ProjectIcon } from '../ui/ProjectIcon'

export default function ProjectSettingsTab({ editDraft, editSaving, exportingTemplate, platform, project, setEditDraft, setEditSaving, setExportingTemplate, setSettingsIconTab, setTagInput, settingsIconTab, syncProject, tagInput, toast }) {
  const IDE_OPTIONS = [
    { value: 'vscode',      label: 'VS Code' },
    { value: 'cursor',      label: 'Cursor' },
    { value: 'webstorm',    label: 'WebStorm' },
    { value: 'idea',        label: 'IntelliJ IDEA' },
    { value: 'zed',         label: 'Zed' },
    { value: 'sublime',     label: 'Sublime Text' },
    { value: 'vim',         label: 'Vim' },
    { value: 'neovim',      label: 'Neovim' },
    { value: 'claude-code', label: 'Claude Code' },
  ]
  const labelStyle = { fontSize: 10, fontFamily: 'Geist Mono, monospace', color: 'var(--dimmer)', textTransform: 'uppercase', letterSpacing: '0.06em' }
  const inputStyle = { width: '100%', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '8px 11px', color: 'var(--text)', fontSize: 13, fontFamily: 'Geist, sans-serif', outline: 'none', transition: 'border-color var(--transition-base)' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* Emoji picker */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={labelStyle}>Project Icon</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ fontSize: 30, width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', flexShrink: 0 }}>
            <ProjectIcon value={editDraft.emoji} size={26} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              {[['emoji', 'Emoji'], ['icons', 'Icons']].map(([id, tlabel]) => (
                <button key={id} onClick={() => setSettingsIconTab(id)}
                  style={{
                    padding: '3px 10px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer',
                    fontSize: 10.5, fontFamily: 'Geist, sans-serif', fontWeight: settingsIconTab === id ? 600 : 400,
                    color: settingsIconTab === id ? 'var(--text)' : 'var(--dimmer)',
                    background: settingsIconTab === id ? 'var(--border)' : 'transparent',
                    transition: 'all var(--transition-fast)',
                  }}
                >{tlabel}</button>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 108, overflowY: 'auto' }}>
              {settingsIconTab === 'emoji' ? EMOJI_OPTIONS.map(e => (
                <button key={e} onClick={() => setEditDraft(d => ({ ...d, emoji: e }))}
                  style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, borderRadius: 'var(--r-md)', cursor: 'pointer', background: editDraft.emoji === e ? 'var(--border-bright)' : 'var(--card)', border: `1px solid ${editDraft.emoji === e ? 'var(--border-bright)' : 'var(--border)'}`, transition: 'background var(--transition-fast)' }}>
                  {e}
                </button>
              )) : SVG_ICON_OPTIONS.map(({ id, Icon, color }) => {
                const value = iconValueFor(id)
                const active = editDraft.emoji === value
                return (
                  <button key={id} onClick={() => setEditDraft(d => ({ ...d, emoji: value }))}
                    title={id}
                    style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color, borderRadius: 'var(--r-md)', cursor: 'pointer', background: active ? 'var(--border-bright)' : 'var(--card)', border: `1px solid ${active ? 'var(--border-bright)' : 'var(--border)'}`, transition: 'background var(--transition-fast)' }}>
                    <Icon size={16} />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Name */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={labelStyle}>Name</div>
        <input value={editDraft.name} onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))}
          style={inputStyle} placeholder="Project name"
          onFocus={e => e.target.style.borderColor = 'var(--border-bright)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'} />
      </div>

      {/* Description */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={labelStyle}>Description</div>
        <textarea value={editDraft.description} onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))}
          rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }} placeholder="Short description"
          onFocus={e => e.target.style.borderColor = 'var(--border-bright)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'} />
      </div>

      {/* IDE + Visibility */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={labelStyle}>Code Editor</div>
          <select value={editDraft.ide} onChange={e => setEditDraft(d => ({ ...d, ide: e.target.value }))}
            style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="">— None —</option>
            {IDE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={labelStyle}>Visibility</div>
          <select value={editDraft.visibility} onChange={e => setEditDraft(d => ({ ...d, visibility: e.target.value }))}
            style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="public">Public</option>
            <option value="hidden">Hidden</option>
          </select>
        </div>
      </div>

      {/* Shell */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={labelStyle}>Terminal Shell</div>
        <select value={editDraft.shell || ''} onChange={e => setEditDraft(d => ({ ...d, shell: e.target.value }))}
          style={{ ...inputStyle, cursor: 'pointer' }}>
          {(platform === 'win32' ? SHELL_OPTS_WIN : SHELL_OPTS_UNIX).map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* GitHub URL */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={labelStyle}>GitHub Repository</div>
        <input value={editDraft.github} onChange={e => setEditDraft(d => ({ ...d, github: e.target.value }))}
          style={inputStyle} placeholder="https://github.com/user/repo"
          onFocus={e => e.target.style.borderColor = 'var(--border-bright)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'} />
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={labelStyle}>Tags</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          {editDraft.tags.map(tag => (
            <TagChip key={tag} tag={tag} size="md" onRemove={() => setEditDraft(d => ({ ...d, tags: d.tags.filter(t => t !== tag) }))} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={tagInput} onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => {
              if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                e.preventDefault()
                const t = tagInput.trim().replace(/,/g, '')
                if (t && !editDraft.tags.includes(t)) setEditDraft(d => ({ ...d, tags: [...d.tags, t] }))
                setTagInput('')
              }
            }}
            style={{ ...inputStyle, flex: 1 }} placeholder="Add tag, press Enter"
            onFocus={e => e.target.style.borderColor = 'var(--border-bright)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'} />
          <button onClick={() => {
              const t = tagInput.trim()
              if (t && !editDraft.tags.includes(t)) { setEditDraft(d => ({ ...d, tags: [...d.tags, t] })); setTagInput('') }
            }}
            style={{ padding: '8px 14px', borderRadius: 'var(--r-md)', background: 'var(--border)', border: 'none', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}>Add</button>
        </div>
      </div>

      {/* Commands */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={labelStyle}>NPM / Run Commands</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {['dev', 'build', 'start', 'test'].map(k => (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>{k}</div>
              <input value={editDraft.commands[k]} onChange={e => setEditDraft(d => ({ ...d, commands: { ...d.commands, [k]: e.target.value } }))}
                style={{ ...inputStyle, fontSize: 12, fontFamily: 'Geist Mono, monospace' }} placeholder={`npm run ${k}`}
                onFocus={e => e.target.style.borderColor = 'var(--border-bright)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'} />
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
        <button
          disabled={editSaving}
          onClick={async () => {
            setEditSaving(true)
            try {
              let updated
              if (editDraft.name !== project.name) {
                updated = await window.api.projects.rename(project.id, editDraft.name)
              }
              const rest = { ...editDraft }
              if (editDraft.name !== project.name) delete rest.name
              updated = await window.api.projects.edit(project.id, rest)
              if (updated) { syncProject(updated); toast.success('Project settings saved') }
              else toast.error('Save failed')
            } catch (err) { toast.error(err?.message || 'Save failed') }
            finally { setEditSaving(false) }
          }}
          style={{ padding: '9px 22px', borderRadius: 'var(--r-md)', background: editSaving ? 'var(--border)' : 'var(--orange)', border: 'none', color: editSaving ? 'var(--dim)' : '#fff', fontSize: 13, fontWeight: 600, cursor: editSaving ? 'default' : 'pointer', transition: 'background var(--transition-base)' }}>
          {editSaving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* Export as Template (Phase 6 item 12) — local-first: writes a
          shareable JSON file the user can send to anyone; there's no
          hosted marketplace to publish to. */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Export as Template</div>
        <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 10 }}>
          Save this project's file structure as a reusable starter template. Excludes node_modules/build output, lockfiles, and .env files. Share the resulting file with anyone — they import it from the New Project screen.
        </div>
        <button
          disabled={exportingTemplate}
          onClick={async () => {
            setExportingTemplate(true)
            try {
              const template = await window.api.projects.exportAsTemplate(project.id, project.name, project.description || '')
              const savePath = await window.api.system.showSavePicker(`${project.name}.crocotemplate.json`, [{ name: 'Croco Template', extensions: ['json'] }])
              if (!savePath) return
              const bytes = Array.from(new TextEncoder().encode(JSON.stringify(template, null, 2)))
              await window.api.system.writeBytes(savePath, bytes)
              toast.success('Template exported', `${template.fileCount} files`)
            } catch (err) {
              toast.error('Export failed', err?.message || String(err))
            } finally {
              setExportingTemplate(false)
            }
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 'var(--r-md)', background: 'transparent', border: '1px solid var(--border)', color: 'var(--dim)', fontSize: 12, cursor: exportingTemplate ? 'default' : 'pointer', fontFamily: 'Geist, sans-serif' }}>
          <PackageIcon size={14} /> {exportingTemplate ? 'Exporting…' : 'Export as Template'}
        </button>
      </div>
    </div>
  )
}
