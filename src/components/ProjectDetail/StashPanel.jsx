import { useState, useEffect, useCallback } from 'react'
import { PackageIcon, DownloadIcon, TrashIcon } from '../../constants/SimpleSvgExports'
import InfoSection from './InfoSection'

// Self-contained (fetches/mutates its own state directly via window.api)
// rather than threading yet more props through GitPanel — same pattern the
// module cards settled on once Settings → Modules stopped being a
// prop-drilling hub (see docs/modules-plan.md).
export default function StashPanel({ projectId, toast, onChanged }) {
  const [stashes, setStashes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyIndex, setBusyIndex] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(() => {
    if (!window.api) return
    setLoading(true)
    window.api.git.stashList(projectId)
      .then(setStashes)
      .catch(() => setStashes([]))
      .finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => { Promise.resolve().then(load) }, [load])

  const handleSave = async () => {
    if (!window.api) return
    setSaving(true)
    try {
      await window.api.git.stashSave(projectId, message.trim() || undefined)
      setMessage('')
      load()
      onChanged?.()
    } catch (e) {
      toast.error('Stash failed', e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleApply = async (index, pop) => {
    if (!window.api) return
    setBusyIndex(index)
    try {
      await (pop ? window.api.git.stashPop(projectId, index) : window.api.git.stashApply(projectId, index))
      load()
      onChanged?.()
    } catch (e) {
      toast.error(pop ? 'Pop failed' : 'Apply failed', e.message)
    } finally {
      setBusyIndex(null)
    }
  }

  const handleDrop = async (index) => {
    if (!window.api) return
    setBusyIndex(index)
    try {
      await window.api.git.stashDrop(projectId, index)
      load()
    } catch (e) {
      toast.error('Drop failed', e.message)
    } finally {
      setBusyIndex(null)
    }
  }

  return (
    <InfoSection label={`Stash${stashes.length > 0 ? ` (${stashes.length})` : ''}`}>
      <div style={{ display: 'flex', gap: 8, marginBottom: stashes.length > 0 ? 12 : 0 }}>
        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
          placeholder="Stash message (optional)"
          style={{
            flex: 1, fontSize: 12, padding: '6px 10px', borderRadius: 'var(--r-sm)',
            background: 'var(--base)', border: '1px solid var(--border)', color: 'var(--text)',
            outline: 'none', fontFamily: 'Geist, sans-serif',
          }}
        />
        <button onClick={handleSave} disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--r-sm)',
            border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--dim)',
            fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
          }}>
          <PackageIcon size={12} /> {saving ? 'Stashing…' : 'Stash Changes'}
        </button>
      </div>

      {!loading && stashes.length === 0 ? null : loading ? (
        <div style={{ fontSize: 11, color: 'var(--dimmer)' }}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {stashes.map(s => (
            <div key={s.index} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.message}</div>
                <div style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>{s.when}</div>
              </div>
              <button onClick={() => handleApply(s.index, false)} disabled={busyIndex === s.index} title="Apply (keep in stash)"
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 11, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
                Apply
              </button>
              <button onClick={() => handleApply(s.index, true)} disabled={busyIndex === s.index} title="Pop (apply and remove)"
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: '#4aff91', fontSize: 11, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
                <DownloadIcon size={11} /> Pop
              </button>
              <button onClick={() => handleDrop(s.index)} disabled={busyIndex === s.index} title="Drop (delete permanently)"
                style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: '#ff4444', cursor: 'pointer' }}>
                <TrashIcon size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </InfoSection>
  )
}
