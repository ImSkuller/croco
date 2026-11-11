import { useState, useEffect } from 'react'
import { PaletteIcon } from '../../constants/SimpleSvgExports'
import { SectionTitle, SettingsCard, FieldLabel, FieldDesc, ToggleChip } from './Exports'
import { THEMES, applyTheme, getThemeAccentSwatch, normalizeThemeId } from '../../lib/theme.js'
import { STYLES, applyStyle, normalizeStyleId, applySmoothAnimations } from '../../lib/appearanceStyle.js'
import { lazyLoadAllPickerFonts } from '../../lib/lazyGoogleFont.js'

export default function AppearanceSection({ settings, saveField }) {
  const a = settings.appearance || {}
  const [accentColor,      setAccentColor]      = useState(a.accentColor || '#e8e4dc')
  const [selectedTheme,    setSelectedTheme]    = useState(normalizeThemeId(a.theme || 'default'))
  const [selectedStyle,    setSelectedStyle]    = useState(normalizeStyleId(a.style || 'apple'))
  const [glassEnabled,     setGlassEnabled]     = useState(!!a.glass)
  const [smoothAnimations, setSmoothAnimations] = useState(a.smoothAnimations ?? true)
  const [fontBody,         setFontBody]         = useState(a.fontBody || 'Geist')
  const [fontDisplay,      setFontDisplay]      = useState(a.fontDisplay || 'Lora')
  const logoBg = a.logoBg || '#ffffff'

  // Font picker previews need their real faces loaded — deferred until this
  // tab is actually opened rather than on every app launch.
  useEffect(() => { lazyLoadAllPickerFonts() }, [])

  useEffect(() => {
    const html = document.documentElement
    html.style.setProperty('--orange', accentColor)
    html.style.setProperty('--accent', accentColor)
    if (accentColor.startsWith('#') && accentColor.length === 7) {
      const r = parseInt(accentColor.slice(1, 3), 16)
      const g = parseInt(accentColor.slice(3, 5), 16)
      const b = parseInt(accentColor.slice(5, 7), 16)
      html.style.setProperty('--accent-dim',  `rgba(${r},${g},${b},0.12)`)
      html.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.25)`)
    }
  }, [accentColor])

  useEffect(() => {
    document.documentElement.style.setProperty('--font-body', `'${fontBody}', sans-serif`)
  }, [fontBody])

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--font-display',
      fontDisplay === 'inherit' ? 'var(--font-body)' : `'${fontDisplay}', serif`
    )
  }, [fontDisplay])

  return (
    <>
        <SectionTitle icon={<PaletteIcon />} title="Appearance" desc="Change how Croco looks." />

        <SettingsCard>
          <FieldLabel>Style</FieldLabel>
          <FieldDesc>Changes the shape and feel of buttons and panels. Colours are set separately under Theme.</FieldDesc>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 12 }}>
            {STYLES.map(style => {
              const isActive = selectedStyle === style.id
              return (
                <button
                  key={style.id}
                  onClick={() => {
                    setSelectedStyle(style.id)
                    applyStyle(style.id)
                    const patch = { appearance: { style: style.id } }
                    if (style.id === 'apple') {
                      // Curated font pairing to match the liquid-glass look —
                      // same idea as a Theme click curating an accent colour.
                      setFontBody('Inter')
                      setFontDisplay('inherit')
                      patch.appearance.fontBody = 'Inter'
                      patch.appearance.fontDisplay = 'inherit'
                    }
                    saveField(patch)
                  }}
                  title={style.label}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
                    padding: '12px 14px', borderRadius: 'var(--r-lg)', textAlign: 'left',
                    border: isActive ? '2px solid var(--accent)' : '2px solid var(--border)',
                    background: isActive ? 'var(--accent-dim)' : 'var(--card)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-base)',
                  }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: isActive ? 'var(--text)' : 'var(--dim)' }}>{style.label}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--dimmer)', lineHeight: 1.4 }}>{style.description}</span>
                </button>
              )
            })}
          </div>
        </SettingsCard>

        <SettingsCard>
          <FieldLabel>Glass Effect</FieldLabel>
          <FieldDesc>Makes the window see-through with a frosted look. Works with any theme. On older computers it may look slightly different.</FieldDesc>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {[{ v: false, label: 'off' }, { v: true, label: 'on' }].map(({ v, label }) => (
              <ToggleChip
                key={label}
                label={label}
                active={glassEnabled === v}
                color="var(--accent)"
                bg="var(--accent-dim)"
                onClick={() => {
                  setGlassEnabled(v)
                  applyTheme(selectedTheme, v, { accentColor, fontBody, fontDisplay, logoBg })
                  saveField({ appearance: { glass: v } })
                  window.api?.system.setWindowGlass(v).catch(console.error)
                }}
              />
            ))}
          </div>
        </SettingsCard>

        <SettingsCard>
          <FieldLabel>Smooth Animations</FieldLabel>
          <FieldDesc>Smooth movement when switching pages and pressing buttons. Turn off if you prefer things to change instantly. Your computer's "reduce motion" setting is always respected.</FieldDesc>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {[{ v: true, label: 'on' }, { v: false, label: 'off' }].map(({ v, label }) => (
              <ToggleChip
                key={label}
                label={label}
                active={smoothAnimations === v}
                color="var(--accent)"
                bg="var(--accent-dim)"
                onClick={() => {
                  setSmoothAnimations(v)
                  applySmoothAnimations(v)
                  saveField({ appearance: { smoothAnimations: v } })
                }}
              />
            ))}
          </div>
        </SettingsCard>

        <SettingsCard>
          <FieldLabel>Theme</FieldLabel>
          <FieldDesc>Pick the colours for the whole app.</FieldDesc>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginTop: 12 }}>
            {THEMES.map(theme => {
              const [bg, accent] = getThemeAccentSwatch(theme.id)
              const isActive = selectedTheme === theme.id
              return (
                <button
                  key={theme.id}
                  onClick={() => {
                    setSelectedTheme(theme.id)
                    const [, nativeAccent] = getThemeAccentSwatch(theme.id)
                    setAccentColor(nativeAccent)
                    applyTheme(theme.id, glassEnabled, { accentColor: nativeAccent, fontBody, fontDisplay, logoBg })
                    saveField({ appearance: { theme: theme.id, glass: glassEnabled, accentColor: nativeAccent, fontBody, fontDisplay, logoBg } })
                  }}
                  title={theme.label}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 5,
                    padding: '8px 4px',
                    borderRadius: 'var(--r-md)',
                    border: isActive ? `2px solid ${accent}` : '2px solid var(--border)',
                    background: isActive ? `${accent}18` : 'var(--card)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-base)',
                    outline: 'none',
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: bg,
                    border: `3px solid ${accent}`,
                    boxShadow: isActive ? `0 0 0 2px ${accent}40` : 'none',
                    transition: 'box-shadow var(--transition-base)',
                  }} />
                  <span style={{
                    fontSize: 9, fontFamily: 'Geist Mono, monospace',
                    color: isActive ? 'var(--text)' : 'var(--dimmer)',
                    textAlign: 'center', lineHeight: 1.2,
                    maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {theme.label}
                  </span>
                </button>
              )
            })}
          </div>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
              Selected: <span style={{ color: 'var(--text)' }}>{THEMES.find(t => t.id === selectedTheme)?.label || 'Default'}</span>
            </span>
            {THEMES.find(t => t.id === selectedTheme)?.dark === false && (
              <span style={{ fontSize: 10, background: 'rgba(255,215,0,0.1)', color: 'var(--yellow)', padding: '1px 6px', borderRadius: 'var(--r-sm)', fontFamily: 'Geist Mono, monospace' }}>light theme</span>
            )}
          </div>
        </SettingsCard>

        <SettingsCard>
          <FieldLabel>Accent Colour</FieldLabel>
          <FieldDesc>The colour used for highlights and selected items.</FieldDesc>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
            {['#e8e4dc', '#ff6b35', '#4a9eff', '#4aff91', '#a855f7', '#ffd700', '#ff4444'].map(color => (
              <button
                key={color}
                onClick={() => { setAccentColor(color); saveField({ appearance: { accentColor: color } }) }}
                style={{
                  width: 28, height: 28, borderRadius: '50%', background: color,
                  border: accentColor === color ? '2px solid #fff' : '2px solid transparent',
                  outline: accentColor === color ? '2px solid ' + color : 'none',
                  outlineOffset: 2,
                  cursor: 'pointer', transition: 'all var(--transition-base)', padding: 0,
                }}
              />
            ))}
            <input
              type="color"
              value={accentColor}
              onChange={e => { setAccentColor(e.target.value); saveField({ appearance: { accentColor: e.target.value } }) }}
              style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--card)', padding: 2 }}
            />
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: accentColor }} />
            <span style={{ fontSize: 12, color: 'var(--dim)', fontFamily: 'Geist Mono, monospace' }}>{accentColor}</span>
          </div>
        </SettingsCard>

        <SettingsCard>
          <FieldLabel>UI Font</FieldLabel>
          <FieldDesc>The font used for most text. Code always uses a code font.</FieldDesc>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
            {[
              { id: 'Geist',         sample: 'The quick brown fox' },
              { id: 'Inter',         sample: 'The quick brown fox' },
              { id: 'IBM Plex Sans', sample: 'The quick brown fox' },
              { id: 'Nunito',        sample: 'The quick brown fox' },
              { id: 'DM Sans',       sample: 'The quick brown fox' },
              { id: 'Space Grotesk', sample: 'The quick brown fox' },
              { id: 'Manrope',       sample: 'The quick brown fox' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => { setFontBody(f.id); saveField({ appearance: { fontBody: f.id } }) }}
                style={{
                  padding: '11px 14px', borderRadius: 'var(--r-md)', cursor: 'pointer', textAlign: 'left',
                  border: `1px solid ${fontBody === f.id ? 'var(--accent)' : 'var(--border)'}`,
                  background: fontBody === f.id ? 'var(--accent-dim)' : 'var(--card)',
                  transition: 'all var(--transition-base)',
                }}
              >
                <div style={{ fontSize: 13, color: 'var(--text)', fontFamily: `'${f.id}', sans-serif`, marginBottom: 3 }}>{f.sample}</div>
                <div style={{ fontSize: 10, color: fontBody === f.id ? 'var(--accent)' : 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>{f.id}</div>
              </button>
            ))}
          </div>
        </SettingsCard>

        <SettingsCard>
          <FieldLabel>Heading Font</FieldLabel>
          <FieldDesc>The font used for page titles. Choose "Same as body" for a plainer look.</FieldDesc>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
            {[
              { id: 'Lora',             label: 'Lora',             sample: 'Rise of the Croco' },
              { id: 'Playfair Display', label: 'Playfair Display', sample: 'Rise of the Croco' },
              { id: 'inherit',          label: 'Same as body',     sample: 'Rise of the Croco' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => { setFontDisplay(f.id); saveField({ appearance: { fontDisplay: f.id } }) }}
                style={{
                  padding: '11px 14px', borderRadius: 'var(--r-md)', cursor: 'pointer', textAlign: 'left',
                  border: `1px solid ${fontDisplay === f.id ? 'var(--accent)' : 'var(--border)'}`,
                  background: fontDisplay === f.id ? 'var(--accent-dim)' : 'var(--card)',
                  transition: 'all var(--transition-base)',
                }}
              >
                <div style={{ fontSize: 15, color: 'var(--text)', fontFamily: f.id === 'inherit' ? `'${fontBody}', sans-serif` : `'${f.id}', serif`, marginBottom: 3 }}>{f.sample}</div>
                <div style={{ fontSize: 10, color: fontDisplay === f.id ? 'var(--accent)' : 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>{f.label}</div>
              </button>
            ))}
          </div>
        </SettingsCard>

    </>
  )
}
