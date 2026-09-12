import { useState, useEffect, useCallback } from 'react'
import { TagIcon, TrashIcon, EditIcon, CheckIcon } from '../../constants/SimpleSvgExports'
import { SectionTitle, SettingsCard, FieldDesc, InfoBox } from './Exports'
import { useToast } from '../Toast/useToast.js'
import { refreshData } from '../../lib/store'
import TagChip from '../ui/TagChip'

const SWATCHES = ['#ff4444', '#ff6b35', '#ffd700', '#4aff91', '#4a9eff', '#a855f7', '#e56aad', '#00d2ff', '#e8e4dc']

// Self-contained (loads and mutates through window.api.tags directly) —
// same shape as the module cards. Rename with an existing target name is
// the merge operation; the backend dedupes per project/note.
export default function TagsSection() {
  const toast = useToast()
  const [tags, setTags] = useState(null)
  const [renaming, setRenaming] = useState(null) // { name, value }
  const [mergeTarget, setMergeTarget] = useState({}) // name -> target
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    if (!window.api) return
    window.api.tags.list().then(setTags).catch(() => setTags([]))
  }, [])
  useEffect(() => { Promise.resolve().then(load) }, [load])

  const afterMutation = () => {
    load()
    refreshData('projects'); refreshData('notes'); refreshData('settings')
  }

  const setColor = async (name, color) => {
    await window.api.tags.setColor(name, color).catch(e => toast.error('Could not save color', e.message))
    afterMutation()
  }

  const commitRename = async () => {
    if (!renaming || !renaming.value.trim() || renaming.value.trim() === renaming.name) { setRenaming(null); return }
    setBusy(true)
    try {
      const r = await window.api.tags.rename(renaming.name, renaming.value.trim())
      toast.success('Tag renamed', `${r.projects} project${r.projects === 1 ? '' : 's'}, ${r.notes} note${r.notes === 1 ? '' : 's'} updated`)
      setRenaming(null)
      afterMutation()
    } catch (e) {
      toast.error('Rename failed', e.message)
    } finally { setBusy(false) }
  }

  const merge = async (name) => {
    const into = mergeTarget[name]
    if (!into || into === name) return
    setBusy(true)
    try {
      const r = await window.api.tags.rename(name, into)
      toast.success(`Merged into ${into}`, `${r.projects} project${r.projects === 1 ? '' : 's'}, ${r.notes} note${r.notes === 1 ? '' : 's'} updated`)
      setMergeTarget(m => { const n = { ...m }; delete n[name]; return n })
      afterMutation()
    } catch (e) {
      toast.error('Merge failed', e.message)
    } finally { setBusy(false) }
  }

  const remove = async (name) => {
    setBusy(true)
    try {
      const r = await window.api.tags.delete(name)
      toast.success('Tag deleted', `Removed from ${r.projects} project${r.projects === 1 ? '' : 's'} and ${r.notes} note${r.notes === 1 ? '' : 's'}`)
      setConfirmDelete(null)
      afterMutation()
    } catch (e) {
      toast.error('Delete failed', e.message)
    } finally { setBusy(false) }
  }

  const iconBtn = (extra = {}) => ({ display: 'flex', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'var(--dim)', padding: 4, transition: 'all var(--transition-fast)', ...extra })

  return (
    <>
      <SectionTitle icon={<TagIcon />} title="Tags" desc="Every tag used across your projects and notes. Give them colors, rename or merge duplicates, or remove one everywhere at once." />

      <SettingsCard>
        {tags === null ? (
          <FieldDesc>Loading…</FieldDesc>
        ) : tags.length === 0 ? (
          <FieldDesc>No tags yet — add some to a project or note and they'll show up here.</FieldDesc>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tags.map(t => (
              <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--r-md)', background: 'var(--base)', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
                {renaming?.name === t.name ? (
                  <input
                    autoFocus
                    value={renaming.value}
                    onChange={e => setRenaming(r => ({ ...r, value: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null) }}
                    style={{ fontFamily: 'Geist Mono, monospace', fontSize: 12, padding: '3px 8px', borderRadius: 'var(--r-sm)', background: 'var(--card)', border: '1px solid var(--border-bright)', color: 'var(--text)', outline: 'none', width: 160 }}
                  />
                ) : (
                  <TagChip tag={t.name} size="md" />
                )}
                <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
                  {t.projects} project{t.projects === 1 ? '' : 's'} · {t.notes} note{t.notes === 1 ? '' : 's'}
                </span>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {/* Color */}
                  <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    {SWATCHES.map(c => (
                      <button key={c} onClick={() => setColor(t.name, c)} title={c}
                        style={{ width: 14, height: 14, borderRadius: '50%', background: c, border: t.color === c ? '2px solid var(--text)' : '2px solid transparent', cursor: 'pointer', padding: 0 }} />
                    ))}
                    <label title="Custom color" style={{ position: 'relative', width: 14, height: 14, borderRadius: '50%', border: '1px dashed var(--dimmer)', cursor: 'pointer', overflow: 'hidden', display: 'inline-block' }}>
                      <input type="color" value={t.color || '#888888'} onChange={e => setColor(t.name, e.target.value)} style={{ position: 'absolute', inset: -4, width: 24, height: 24, opacity: 0, cursor: 'pointer' }} />
                    </label>
                    {t.color && (
                      <button onClick={() => setColor(t.name, null)} title="Clear color" style={{ ...iconBtn(), padding: '1px 5px', fontSize: 10, fontFamily: 'Geist Mono, monospace' }}>none</button>
                    )}
                  </div>

                  {/* Rename */}
                  {renaming?.name === t.name ? (
                    <button onClick={commitRename} disabled={busy} title="Save" style={iconBtn({ color: '#4aff91' })}><CheckIcon size={12} /></button>
                  ) : (
                    <button onClick={() => setRenaming({ name: t.name, value: t.name })} title="Rename everywhere" style={iconBtn()}><EditIcon size={12} /></button>
                  )}

                  {/* Merge */}
                  {tags.length > 1 && (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <select
                        value={mergeTarget[t.name] || ''}
                        onChange={e => setMergeTarget(m => ({ ...m, [t.name]: e.target.value }))}
                        style={{ background: 'var(--card)', color: 'var(--dim)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '3px 6px', fontSize: 11, fontFamily: 'Geist Mono, monospace' }}
                      >
                        <option value="">merge into…</option>
                        {tags.filter(o => o.name !== t.name).map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
                      </select>
                      {mergeTarget[t.name] && (
                        <button onClick={() => merge(t.name)} disabled={busy} style={{ ...iconBtn(), padding: '3px 8px', fontSize: 11, fontFamily: 'Geist, sans-serif', color: 'var(--text)' }}>Merge</button>
                      )}
                    </div>
                  )}

                  {/* Delete */}
                  {confirmDelete === t.name ? (
                    <button onClick={() => remove(t.name)} disabled={busy} style={{ ...iconBtn({ color: '#ff4444', borderColor: '#ff4444' }), padding: '3px 8px', fontSize: 10, fontFamily: 'Geist Mono, monospace' }}>confirm?</button>
                  ) : (
                    <button onClick={() => { setConfirmDelete(t.name); setTimeout(() => setConfirmDelete(prev => (prev === t.name ? null : prev)), 4000) }} title="Delete everywhere" style={iconBtn()}><TrashIcon size={12} /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>

      <InfoBox>
        Renaming or merging rewrites the tag on every project and note that has it. Deleting removes it everywhere — the projects and notes themselves are untouched.
      </InfoBox>
    </>
  )
}
