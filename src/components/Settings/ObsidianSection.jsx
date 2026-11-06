import { VaultIcon, CheckIcon, XCircleIcon } from '../../constants/SimpleSvgExports'
import { SectionTitle, SettingsCard, FieldLabel, FieldDesc, PathInput, Toggle } from './Exports'

export default function ObsidianSection({
  obsidianEnabled, handleObsidianToggle, obsidianVaultPath, setObsidianVaultPath, handlePickVault,
  obsidianPathCheck, obsidianSyncResult, obsidianLastSync, obsidianSyncing, handleObsidianSyncNow,
}) {
  return (
    <>
      <SectionTitle icon={<VaultIcon />} title="Obsidian" desc="Keep a copy of your notes in an Obsidian vault. Changes only go one way: edits you make inside Obsidian do not come back to Croco." />
      <SettingsCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <FieldLabel>Copy notes to Obsidian</FieldLabel>
            <FieldDesc>Whenever you add, change, archive, or delete a note, the copy in your vault is updated too.</FieldDesc>
          </div>
          <Toggle value={obsidianEnabled} onChange={handleObsidianToggle} />
        </div>

        <FieldLabel>Vault Folder</FieldLabel>
        <PathInput
          value={obsidianVaultPath}
          onChange={setObsidianVaultPath}
          onBrowse={handlePickVault}
          onBlur={() => window.api?.settings.update({ app: { obsidian: { enabled: obsidianEnabled, vaultPath: obsidianVaultPath } } }).catch(() => {})}
        />
        {obsidianPathCheck && !obsidianPathCheck.valid && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#ff5050' }}>{obsidianPathCheck.message}</div>
        )}

        {obsidianSyncResult && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, padding: '10px 14px', borderRadius: 'var(--r-md)', background: obsidianSyncResult.ok ? 'rgba(74,255,145,0.07)' : 'rgba(255,80,80,0.07)', border: `1px solid ${obsidianSyncResult.ok ? 'rgba(74,255,145,0.2)' : 'rgba(255,80,80,0.2)'}`, fontSize: 12, color: obsidianSyncResult.ok ? '#4aff91' : '#ff5050', fontFamily: 'Geist Mono, monospace' }}>
            {obsidianSyncResult.ok ? <CheckIcon size={12} /> : <XCircleIcon size={12} />}{obsidianSyncResult.message}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--dimmer)' }}>
            {obsidianLastSync ? `Last synced ${new Date(obsidianLastSync).toLocaleString()}` : 'Never synced'}
          </div>
          <button
            disabled={obsidianSyncing || !obsidianEnabled || !obsidianVaultPath}
            onClick={handleObsidianSyncNow}
            style={{
              padding: '7px 16px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--accent)', color: '#000',
              fontSize: 12, fontWeight: 600, fontFamily: 'Geist, sans-serif',
              cursor: (obsidianSyncing || !obsidianEnabled || !obsidianVaultPath) ? 'not-allowed' : 'pointer',
              opacity: (obsidianSyncing || !obsidianEnabled || !obsidianVaultPath) ? 0.6 : 1,
            }}
          >
            {obsidianSyncing ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>
      </SettingsCard>
    </>
  )
}
