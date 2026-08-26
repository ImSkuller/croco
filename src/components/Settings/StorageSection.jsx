import { DatabaseIcon } from '../../constants/SimpleSvgExports'
import { SectionTitle, SettingsCard, FieldLabel, FieldDesc } from './Exports'

export default function StorageSection({
  storageBackend, setStorageBackend, migrating, setMigrating, migrateResult, setMigrateResult,
  backupBusy, setBackupBusy, backupResult, setBackupResult,
}) {
  return (
    <>
      <SectionTitle icon={<DatabaseIcon />} title="Storage" desc="Choose how Croco stores your data. Activity logs are always kept in SQLite." />
      <SettingsCard>
        <FieldLabel>Storage Backend</FieldLabel>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {[
            { id: 'json',   label: 'JSON Files',  desc: 'One file per item. Easy to inspect and back up manually.', pros: ['Human-readable', 'Easy backup'], cons: ['Slower with many projects'] },
            { id: 'sqlite', label: 'SQLite',      desc: 'Single database file. Faster reads, better for large datasets.', pros: ['Faster queries', 'Atomic writes'], cons: ['Binary format'] },
          ].map(opt => (
            <div
              key={opt.id}
              onClick={() => !migrating && setStorageBackend(opt.id)}
              style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: `1px solid ${storageBackend === opt.id ? 'var(--accent)' : 'var(--border)'}`, background: storageBackend === opt.id ? 'var(--accent-dim)' : 'var(--card)', cursor: migrating ? 'not-allowed' : 'pointer', transition: 'border-color 0.15s' }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: storageBackend === opt.id ? 'var(--accent)' : 'var(--text)', marginBottom: 3 }}>{opt.label}</div>
              <div style={{ fontSize: 11, color: 'var(--dimmer)', lineHeight: 1.5, marginBottom: 8 }}>{opt.desc}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {opt.pros.map(p => <div key={p} style={{ fontSize: 10, color: '#4aff91', display: 'flex', alignItems: 'center', gap: 4 }}>+ {p}</div>)}
                {opt.cons.map(c => <div key={c} style={{ fontSize: 10, color: 'var(--dimmer)', display: 'flex', alignItems: 'center', gap: 4 }}>– {c}</div>)}
              </div>
            </div>
          ))}
        </div>

        {migrateResult && (
          <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: migrateResult.ok ? 'rgba(74,255,145,0.07)' : 'rgba(255,80,80,0.07)', border: `1px solid ${migrateResult.ok ? 'rgba(74,255,145,0.2)' : 'rgba(255,80,80,0.2)'}`, fontSize: 12, color: migrateResult.ok ? '#4aff91' : '#ff5050', fontFamily: 'Geist Mono, monospace' }}>
            {migrateResult.ok ? '✓ ' : '✗ '}{migrateResult.message}
          </div>
        )}

        {(() => {
          const currentBackend = migrateResult?.appliedBackend || (window._currentStorageBackend ?? 'json')
          const changed = storageBackend !== currentBackend
          return changed ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(255,107,53,0.06)', border: '1px solid rgba(255,107,53,0.2)' }}>
              <div style={{ fontSize: 11, color: 'var(--dimmer)', lineHeight: 1.5 }}>
                Switching to <strong style={{ color: 'var(--text)' }}>{storageBackend === 'sqlite' ? 'SQLite' : 'JSON'}</strong> will sync all data and restart the app.
              </div>
              <button
                disabled={migrating}
                onClick={async () => {
                  setMigrating(true)
                  setMigrateResult(null)
                  try {
                    await window.api.storage.switchBackend(storageBackend)
                    setMigrateResult({ ok: true, message: `Switched to ${storageBackend}. Restarting…`, appliedBackend: storageBackend })
                    window._currentStorageBackend = storageBackend
                    setTimeout(() => window.api.app.restart(), 1200)
                  } catch (err) {
                    setMigrateResult({ ok: false, message: err?.message || String(err) })
                    setStorageBackend(currentBackend)
                  } finally {
                    setMigrating(false)
                  }
                }}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#000', fontSize: 12, fontWeight: 600, fontFamily: 'Geist, sans-serif', cursor: migrating ? 'not-allowed' : 'pointer', opacity: migrating ? 0.6 : 1, flexShrink: 0, whiteSpace: 'nowrap' }}>
                {migrating ? 'Switching…' : 'Apply & Restart'}
              </button>
            </div>
          ) : (
            <div style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(74,255,145,0.05)', border: '1px solid rgba(74,255,145,0.12)', fontSize: 11, color: 'var(--dimmer)' }}>
              Currently using <strong style={{ color: '#4aff91' }}>{currentBackend === 'sqlite' ? 'SQLite' : 'JSON files'}</strong>. Activity logs are always stored in SQLite.
            </div>
          )
        })()}
      </SettingsCard>

      <SettingsCard>
        <FieldLabel>Backup & Restore</FieldLabel>
        <FieldDesc>Export all projects, notes and todos to a single backup file, or restore from a previous backup. Settings and tokens are never included in restores.</FieldDesc>

        {backupResult && (
          <div style={{ margin: '12px 0', padding: '10px 14px', borderRadius: 8, background: backupResult.ok ? 'rgba(74,255,145,0.07)' : 'rgba(255,80,80,0.07)', border: `1px solid ${backupResult.ok ? 'rgba(74,255,145,0.2)' : 'rgba(255,80,80,0.2)'}`, fontSize: 12, color: backupResult.ok ? '#4aff91' : '#ff5050', fontFamily: 'Geist Mono, monospace' }}>
            {backupResult.ok ? '✓ ' : '✗ '}{backupResult.message}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            disabled={!!backupBusy}
            onClick={async () => {
              if (!window.api) return
              const stamp = new Date().toISOString().slice(0, 10)
              const dest = await window.api.system.showSavePicker(`croco-backup-${stamp}.json`, [{ name: 'Croco Backup', extensions: ['json'] }])
              if (!dest) return
              setBackupBusy('export'); setBackupResult(null)
              try {
                const r = await window.api.data.exportAll(dest)
                setBackupResult({ ok: true, message: `Exported ${r.projects} projects, ${r.notes} notes, ${r.todos} todos.` })
              } catch (err) {
                setBackupResult({ ok: false, message: err?.message || String(err) })
              } finally { setBackupBusy(null) }
            }}
            style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#000', fontSize: 12, fontWeight: 600, fontFamily: 'Geist, sans-serif', cursor: backupBusy ? 'not-allowed' : 'pointer', opacity: backupBusy ? 0.6 : 1 }}
          >
            {backupBusy === 'export' ? 'Exporting…' : 'Export Backup'}
          </button>
          <button
            disabled={!!backupBusy}
            onClick={async () => {
              if (!window.api) return
              const src = await window.api.system.showFilePicker(undefined, [{ name: 'Croco Backup', extensions: ['json'] }])
              if (!src) return
              setBackupBusy('import'); setBackupResult(null)
              try {
                const r = await window.api.data.importAll(src)
                setBackupResult({ ok: true, message: `Restored ${r.projects} projects, ${r.notes} notes, ${r.todos} todos.` })
                window.dispatchEvent(new CustomEvent('croco:data-changed'))
              } catch (err) {
                setBackupResult({ ok: false, message: err?.message || String(err) })
              } finally { setBackupBusy(null) }
            }}
            style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 12, fontWeight: 500, fontFamily: 'Geist, sans-serif', cursor: backupBusy ? 'not-allowed' : 'pointer', opacity: backupBusy ? 0.6 : 1 }}
          >
            {backupBusy === 'import' ? 'Importing…' : 'Import Backup'}
          </button>
        </div>
      </SettingsCard>
    </>
  )
}
