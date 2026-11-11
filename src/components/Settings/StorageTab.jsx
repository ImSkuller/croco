import { useState } from 'react'
import StorageSection from './StorageSection'

// Owns the Storage tab's state (storage format, manual + scheduled backups)
// and hands it to the presentational StorageSection.
export default function StorageTab({ settings, saveField }) {
  const ab = settings.app?.autoBackup || {}
  const [storageBackend, setStorageBackend] = useState(settings.app?.storageBackend || 'json') // 'json' | 'sqlite'
  const [migrating,      setMigrating]      = useState(false)
  const [migrateResult,  setMigrateResult]  = useState(null) // null | { ok, message }

  const [backupBusy,   setBackupBusy]   = useState(null) // null | 'export' | 'import'
  const [backupResult, setBackupResult] = useState(null) // null | { ok, message }

  const [autoBackupEnabled,   setAutoBackupEnabled]   = useState(ab.enabled ?? true)
  const [autoBackupInterval,  setAutoBackupInterval]  = useState(ab.intervalDays || 1)
  const [autoBackupRetention, setAutoBackupRetention] = useState(ab.retentionCount || 7)
  const [autoBackupLastAt,    setAutoBackupLastAt]    = useState(ab.lastBackupAt || null)
  const [autoBackupBusy,      setAutoBackupBusy]      = useState(false)
  const [autoBackupResult,    setAutoBackupResult]    = useState(null)

  const saveAutoBackup = (patch) => saveField({
    app: { autoBackup: { enabled: autoBackupEnabled, intervalDays: autoBackupInterval, retentionCount: autoBackupRetention, ...patch } },
  })

  const handleToggle = () => {
    const next = !autoBackupEnabled
    setAutoBackupEnabled(next)
    saveAutoBackup({ enabled: next })
  }

  const handleIntervalChange = (days) => {
    setAutoBackupInterval(days)
    saveAutoBackup({ intervalDays: days })
  }

  const handleRetentionChange = (count) => {
    setAutoBackupRetention(count)
    saveAutoBackup({ retentionCount: count })
  }

  const handleBackUpNow = async () => {
    if (!window.api) return
    setAutoBackupBusy(true)
    setAutoBackupResult(null)
    try {
      await window.api.data.backupNow()
      setAutoBackupLastAt(new Date().toISOString())
      setAutoBackupResult({ ok: true, message: 'Backup saved.' })
    } catch (err) {
      setAutoBackupResult({ ok: false, message: err?.message || String(err) })
    } finally {
      setAutoBackupBusy(false)
    }
  }

  return (
    <StorageSection
      storageBackend={storageBackend} setStorageBackend={setStorageBackend}
      migrating={migrating} setMigrating={setMigrating}
      migrateResult={migrateResult} setMigrateResult={setMigrateResult}
      backupBusy={backupBusy} setBackupBusy={setBackupBusy}
      backupResult={backupResult} setBackupResult={setBackupResult}
      autoBackupEnabled={autoBackupEnabled} onToggleAutoBackup={handleToggle}
      autoBackupInterval={autoBackupInterval} onChangeAutoBackupInterval={handleIntervalChange}
      autoBackupRetention={autoBackupRetention} onChangeAutoBackupRetention={handleRetentionChange}
      autoBackupLastAt={autoBackupLastAt}
      autoBackupBusy={autoBackupBusy} autoBackupResult={autoBackupResult}
      onBackUpNow={handleBackUpNow}
    />
  )
}
