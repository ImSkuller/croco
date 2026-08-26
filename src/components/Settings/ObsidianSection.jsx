import { VaultIcon } from '../../constants/SimpleSvgExports'
import { SectionTitle, SettingsCard, FieldLabel, FieldDesc, PathInput, Toggle } from './Exports'

export default function ObsidianSection({
  obsidianEnabled, handleObsidianToggle, obsidianVaultPath, setObsidianVaultPath, handlePickVault,
  obsidianPathCheck, obsidianSyncResult, obsidianLastSync, obsidianSyncing, handleObsidianSyncNow,
}) {
  return (
    <>
      <SectionTitle icon={<VaultIcon />} title="Obsidian" desc="Mirror your notes into an Obsidian vault as markdown files with frontmatter. Croco is the source of truth — edits made directly in the vault aren't read back." />
      <SettingsCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <FieldLabel>Sync notes to Obsidian vault</FieldLabel>
            <FieldDesc>Every note create, edit, archive, and delete pushes a markdown file into the vault below.</FieldDesc>
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
          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: obsidianSyncResult.ok ? 'rgba(74,255,145,0.07)' : 'rgba(255,80,80,0.07)', border: `1px solid ${obsidianSyncResult.ok ? 'rgba(74,255,145,0.2)' : 'rgba(255,80,80,0.2)'}`, fontSize: 12, color: obsidianSyncResult.ok ? '#4aff91' : '#ff5050', fontFamily: 'Geist Mono, monospace' }}>
            {obsidianSyncResult.ok ? '✓ ' : '✗ '}{obsidianSyncResult.message}
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
              padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#000',
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
