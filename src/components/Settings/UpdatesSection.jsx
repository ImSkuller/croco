import { RefreshIcon } from '../../constants/SimpleSvgExports'
import { SectionTitle, SettingsCard, FieldLabel, FieldDesc, InfoBox } from './Exports'

export default function UpdatesSection({
  updateChecking, setUpdateChecking, updateInfo, setUpdateInfo,
  updateInstalling, setUpdateInstalling, toast,
}) {
  return (
    <>
      <SectionTitle icon={<RefreshIcon />} title="Updates" desc="Check for the latest version of Croco." />
      <SettingsCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <FieldLabel>Check for Updates</FieldLabel>
            <FieldDesc>Fetches the latest release from GitHub to compare with your installed version.</FieldDesc>
          </div>
          <button
            onClick={async () => {
              if (!window.api) return
              setUpdateChecking(true)
              try {
                const info = await window.api.updates.check()
                setUpdateInfo(info)
              } catch { setUpdateInfo({ error: true }) }
              finally { setUpdateChecking(false) }
            }}
            disabled={updateChecking}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)',
              background: 'transparent', cursor: updateChecking ? 'default' : 'pointer',
              color: 'var(--dim)', fontSize: 12, fontFamily: 'Geist, sans-serif',
              opacity: updateChecking ? 0.6 : 1,
            }}
          >
            <RefreshIcon /> {updateChecking ? 'Checking…' : 'Check now'}
          </button>
        </div>

        {updateInfo && !updateInfo.error && (
          <div style={{
            padding: '14px 16px', borderRadius: 9,
            border: `1px solid ${updateInfo.hasUpdate ? 'var(--accent)' : 'var(--border)'}`,
            background: updateInfo.hasUpdate ? 'var(--accent-dim)' : 'var(--card)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: updateInfo.hasUpdate ? 10 : 0 }}>
              <span style={{ fontSize: 18 }}>{updateInfo.hasUpdate ? '🎉' : '✅'}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  {updateInfo.hasUpdate ? `v${updateInfo.latest} available` : 'You\'re up to date'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', marginTop: 2 }}>
                  Current: v{updateInfo.current}{updateInfo.latest && updateInfo.latest !== updateInfo.current ? ` · Latest: v${updateInfo.latest}` : ''}
                </div>
              </div>
            </div>
            {updateInfo.hasUpdate && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={async () => {
                    setUpdateInstalling(true)
                    try {
                      // Downloads, verifies the signature, installs, and
                      // restarts the app — the promise only rejects, it
                      // never resolves on success.
                      await window.api.updates.install()
                    } catch (e) {
                      toast.error('Update failed', e?.message || '')
                      setUpdateInstalling(false)
                    }
                  }}
                  disabled={updateInstalling}
                  style={{
                    padding: '7px 16px', borderRadius: 7, border: 'none',
                    background: updateInstalling ? 'var(--border)' : 'var(--accent)', color: updateInstalling ? 'var(--dim)' : '#000',
                    fontSize: 12, fontWeight: 600, fontFamily: 'Geist, sans-serif', cursor: updateInstalling ? 'default' : 'pointer',
                  }}
                >
                  {updateInstalling ? 'Installing…' : `Install v${updateInfo.latest}`}
                </button>
                <button
                  onClick={() => window.api?.system.openExternal(`https://github.com/ImSkuller/croco/releases/tag/v${updateInfo.latest}`)}
                  style={{
                    padding: '7px 16px', borderRadius: 7, border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--dim)', fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: 'pointer',
                  }}
                >
                  Open Release Page →
                </button>
              </div>
            )}
          </div>
        )}
        {updateInfo?.error && (
          <InfoBox>Could not reach GitHub. Check your internet connection.</InfoBox>
        )}
      </SettingsCard>
    </>
  )
}
