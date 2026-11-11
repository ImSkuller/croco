import { useState } from 'react'
import ObsidianSection from './ObsidianSection'

// Owns the Obsidian tab's state and hands it to the presentational ObsidianSection.
export default function ObsidianTab({ settings, saveField }) {
  const ob = settings.app?.obsidian || {}
  const [obsidianEnabled,    setObsidianEnabled]    = useState(!!ob.enabled)
  const [obsidianVaultPath,  setObsidianVaultPath]  = useState(ob.vaultPath || '')
  const [obsidianLastSync,   setObsidianLastSync]   = useState(ob.lastSyncAt || null)
  const [obsidianPathCheck,  setObsidianPathCheck]  = useState(null) // null | { valid, message? }
  const [obsidianSyncing,    setObsidianSyncing]    = useState(false)
  const [obsidianSyncResult, setObsidianSyncResult] = useState(null) // null | { ok, message }

  const handleToggle = () => {
    const next = !obsidianEnabled
    setObsidianEnabled(next)
    saveField({ app: { obsidian: { enabled: next, vaultPath: obsidianVaultPath } } })
  }

  const handlePickVault = async () => {
    if (!window.api) return
    const picked = await window.api.system.showFolderPicker()
    if (!picked) return
    const check = await window.api.obsidian.testVaultPath(picked).catch(() => ({ valid: false, message: 'Could not validate this folder.' }))
    setObsidianPathCheck(check)
    if (!check.valid) return
    setObsidianVaultPath(picked)
    saveField({ app: { obsidian: { enabled: obsidianEnabled, vaultPath: picked } } })
  }

  const handleSyncNow = async () => {
    if (!window.api) return
    setObsidianSyncing(true)
    setObsidianSyncResult(null)
    try {
      const r = await window.api.obsidian.syncAll()
      const failedPart = r.failed ? `, ${r.failed} failed` : ''
      setObsidianSyncResult({ ok: true, message: `Synced ${r.synced} note${r.synced === 1 ? '' : 's'}${failedPart}.` })
      setObsidianLastSync(new Date().toISOString())
    } catch (err) {
      setObsidianSyncResult({ ok: false, message: err?.message || String(err) })
    } finally {
      setObsidianSyncing(false)
    }
  }

  return (
    <ObsidianSection
      obsidianEnabled={obsidianEnabled} handleObsidianToggle={handleToggle}
      obsidianVaultPath={obsidianVaultPath} setObsidianVaultPath={setObsidianVaultPath}
      handlePickVault={handlePickVault} obsidianPathCheck={obsidianPathCheck}
      obsidianSyncResult={obsidianSyncResult} obsidianLastSync={obsidianLastSync}
      obsidianSyncing={obsidianSyncing} handleObsidianSyncNow={handleSyncNow}
    />
  )
}
