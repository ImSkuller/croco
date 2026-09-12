import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GithubIcon, XCircleIcon } from '../../constants/SimpleSvgExports'
import { TextInput, PathInput } from '../Settings/Exports'
import { useToast } from '../Toast/useToast.js'
import { refreshData } from '../../lib/store'

// Clone-from-GitHub as a new-project source (previously the only way in was
// "Import Folder" on something already cloned outside the app — see
// docs/git-github-upgrade-plan.md). Clones into a chosen parent folder, then
// hands the result straight to projects.import(), reusing all of that
// command's existing language/GitHub-remote detection rather than
// duplicating it here.
export default function CloneModal({ defaultParent, onClose }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [url,    setUrl]    = useState('')
  const [parent, setParent] = useState(defaultParent || '')
  const [busy,   setBusy]   = useState(false)
  const [error,  setError]  = useState('')

  const pickParent = async () => {
    if (!window.api) return
    const picked = await window.api.system.showFolderPicker()
    if (picked) setParent(picked)
  }

  const handleClone = async () => {
    if (!url.trim() || !parent.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const clonedPath = await window.api.git.cloneRepo(url.trim(), parent.trim())
      const project = await window.api.projects.import(clonedPath)
      refreshData('projects')
      toast.success('Repository cloned', project.name)
      onClose()
      navigate(`/projects/${project.id}`)
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget && !busy) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, maxWidth: 460, width: '90%', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <GithubIcon />
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Clone from GitHub</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--dimmer)', marginBottom: 4 }}>Repository URL or "owner/repo"</div>
            <TextInput value={url} onChange={setUrl} placeholder="octocat/Hello-World" mono />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--dimmer)', marginBottom: 4 }}>Clone into</div>
            <PathInput value={parent} onChange={setParent} onBrowse={pickParent} placeholder="Parent folder" />
          </div>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ff6b6b' }}>
              <XCircleIcon size={12} /> {error}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 22 }}>
          <button onClick={onClose} disabled={busy}
            style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleClone} disabled={!url.trim() || !parent.trim() || busy}
            style={{
              padding: '8px 18px', borderRadius: 7, border: 'none',
              background: url.trim() && parent.trim() && !busy ? '#24292e' : 'var(--dimmer)', color: '#fff',
              fontSize: 12, fontWeight: 600, fontFamily: 'Geist, sans-serif',
              cursor: url.trim() && parent.trim() && !busy ? 'pointer' : 'not-allowed',
            }}>
            {busy ? 'Cloning…' : 'Clone'}
          </button>
        </div>
      </div>
    </div>
  )
}
