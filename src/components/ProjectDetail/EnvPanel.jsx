import { useState, useEffect, useCallback } from 'react'
import { EyeIcon, EyeOffIcon, TrashIcon, PlusCircleIcon, SaveIcon } from '../../constants/SimpleSvgExports'
import { useToast } from '../Toast/useToast.js'

// Masked editor for a project's own .env file — see env_manager.rs. The
// file itself is the only store; saving here rewrites it (no comment/
// formatting preservation, see that module's header comment).
export default function EnvPanel({ projectId }) {
  const toast = useToast()
  const [entries, setEntries] = useState(null)
  const [visible, setVisible] = useState({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    if (!window.api) return
    window.api.envManager.read(projectId).then(e => { setEntries(e); setDirty(false) }).catch(() => setEntries([]))
  }, [projectId])

  useEffect(() => { load() }, [load])

  const update = (i, field, value) => {
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e))
    setDirty(true)
  }
  const remove = (i) => { setEntries(prev => prev.filter((_, idx) => idx !== i)); setDirty(true) }
  const add = () => { setEntries(prev => [...prev, { key: '', value: '' }]); setDirty(true) }

  const save = async () => {
    setSaving(true)
    try {
      const cleaned = entries.filter(e => e.key.trim())
      await window.api.envManager.write(projectId, cleaned)
      setEntries(cleaned)
      setDirty(false)
      toast.success('.env saved')
    } catch (e) {
      toast.error('Could not save .env', e.message)
    } finally {
      setSaving(false)
    }
  }

  if (entries === null) return <div style={{ padding: '20px 0', fontSize: 12, color: 'var(--dimmer)' }}>Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>{entries.length} variable{entries.length === 1 ? '' : 's'}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={add} style={smallBtnStyle}><PlusCircleIcon size={12} /> Add</button>
          <button onClick={save} disabled={!dirty || saving} style={{ ...smallBtnStyle, opacity: (!dirty || saving) ? 0.5 : 1, cursor: (!dirty || saving) ? 'not-allowed' : 'pointer' }}>
            <SaveIcon size={12} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--dimmer)' }}>No .env file here yet — click Add to create one.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entries.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={e.key}
                onChange={ev => update(i, 'key', ev.target.value)}
                placeholder="KEY"
                style={{ ...inputStyle, width: 180, flexShrink: 0 }}
              />
              <input
                type={visible[i] ? 'text' : 'password'}
                value={e.value}
                onChange={ev => update(i, 'value', ev.target.value)}
                placeholder="value"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={() => setVisible(v => ({ ...v, [i]: !v[i] }))} style={iconBtnStyle}>
                {visible[i] ? <EyeOffIcon size={13} /> : <EyeIcon size={13} />}
              </button>
              <button onClick={() => remove(i)} style={iconBtnStyle}><TrashIcon size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const inputStyle = {
  background: 'var(--base)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
  padding: '7px 10px', fontSize: 12, color: 'var(--text)', fontFamily: 'Geist Mono, monospace', outline: 'none',
}
const smallBtnStyle = {
  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 'var(--r-sm)',
  border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)',
  fontSize: 11, fontFamily: 'Geist, sans-serif',
}
const iconBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28,
  borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', cursor: 'pointer', flexShrink: 0,
}
