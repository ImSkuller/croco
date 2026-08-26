import { KeyboardIcon } from '../../constants/SimpleSvgExports'
import { SectionTitle, SettingsCard, FieldLabel, FieldDesc, InfoBox } from './Exports'
import { SHORTCUT_DEFS, bindingToDisplay } from '../../lib/shortcuts'
import { formatKeyToken } from '../../lib/platform'

export default function ShortcutsSection({ capturingId, setCapturingId, shortcutOverrides, setShortcutOverrides }) {
  return (
    <>
      <SectionTitle icon={<KeyboardIcon />} title="Shortcuts" desc="Remap global navigation and action shortcuts. Page-level shortcuts (tabs, run, commit) are built-in and cannot be remapped." />

      <SettingsCard>
        <InfoBox>Click <strong>Edit</strong> on any shortcut, then press the new key or combo. Changes take effect immediately.</InfoBox>
      </SettingsCard>

      {['Global', 'Navigation'].map(group => {
        const defs = SHORTCUT_DEFS.filter(d => d.group === group && d.remappable)
        return (
          <SettingsCard key={group}>
            <FieldLabel>{group}</FieldLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
              {defs.map(def => {
                const isCapturing = capturingId === def.id
                const override = shortcutOverrides[def.id]
                const tokens = override
                  ? (def.chord ? ['G', 'then', override.split('+').pop().toUpperCase()] : bindingToDisplay(override))
                  : def.display
                return (
                  <div
                    key={def.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 10px', borderRadius: 7, gap: 10,
                      background: isCapturing ? 'var(--accent-dim)' : 'transparent',
                      border: `1px solid ${isCapturing ? 'var(--accent)' : 'transparent'}`,
                      transition: 'all 0.12s',
                    }}
                  >
                    <span style={{ fontSize: 12, color: 'var(--dim)' }}>{def.desc}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {isCapturing ? (
                        <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'Geist Mono, monospace', animation: 'pmFadeIn 0.15s both' }}>
                          Press a key… (Esc to cancel)
                        </span>
                      ) : (
                        <div style={{ display: 'flex', gap: 3 }}>
                          {tokens.map((t, i) =>
                            t === 'then'
                              ? <span key={i} style={{ fontSize: 10, color: 'var(--dimmer)', alignSelf: 'center' }}>then</span>
                              : <kbd key={i} style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '3px 6px', borderRadius: 5, boxShadow: '0 1px 0 var(--border)' }}>{formatKeyToken(t)}</kbd>
                          )}
                          {override && (
                            <button
                              onClick={() => {
                                const next = { ...shortcutOverrides }
                                delete next[def.id]
                                setShortcutOverrides(next)
                                window.api?.settings.update({ app: { shortcuts: next } }).catch(() => {})
                                window.dispatchEvent(new Event('croco:shortcuts-changed'))
                              }}
                              title="Reset to default"
                              style={{ fontSize: 10, color: 'var(--dimmer)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 3px', marginLeft: 2 }}
                            >↺</button>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => setCapturingId(isCapturing ? null : def.id)}
                        style={{
                          fontSize: 11, padding: '3px 10px', borderRadius: 5,
                          border: `1px solid ${isCapturing ? 'var(--accent)' : 'var(--border)'}`,
                          background: isCapturing ? 'var(--accent)' : 'transparent',
                          color: isCapturing ? '#fff' : 'var(--dim)',
                          cursor: 'pointer', fontFamily: 'Geist, sans-serif',
                        }}
                      >
                        {isCapturing ? 'Cancel' : 'Edit'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </SettingsCard>
        )
      })}

      <SettingsCard>
        <FieldLabel>Built-in (read-only)</FieldLabel>
        <FieldDesc>These shortcuts are registered per-page and cannot be remapped from here.</FieldDesc>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
          {SHORTCUT_DEFS.filter(d => !d.remappable).map((def, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', gap: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--dimmer)' }}>{def.desc}</span>
              <div style={{ display: 'flex', gap: 3 }}>
                {def.display.map((t, ti) =>
                  t === 'then' || t === '–'
                    ? <span key={ti} style={{ fontSize: 10, color: 'var(--dimmer)', alignSelf: 'center' }}>{t}</span>
                    : <kbd key={ti} style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', background: 'var(--border)', border: '1px solid var(--border)', color: 'var(--dimmer)', padding: '3px 6px', borderRadius: 5 }}>{formatKeyToken(t)}</kbd>
                )}
              </div>
            </div>
          ))}
        </div>
      </SettingsCard>
    </>
  )
}
