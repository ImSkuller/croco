import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeftIcon, FolderIcon, GithubIcon } from '../constants/SimpleSvgExports'

const IDE_OPTIONS = [
  { value: 'vscode',    label: 'VS Code'   },
  { value: 'cursor',    label: 'Cursor'    },
  { value: 'windsurf',  label: 'Windsurf'  },
  { value: 'trae',      label: 'Trae'      },
  { value: 'zed',       label: 'Zed'       },
  { value: 'fleet',     label: 'Fleet'     },
  { value: 'webstorm',  label: 'WebStorm'  },
  { value: 'idea',      label: 'IDEA'      },
  { value: 'sublime',   label: 'Sublime'   },
  { value: 'neovim',    label: 'Neovim'    },
  { value: 'vim',       label: 'Vim'       },
]

const EMOJI_PRESETS = [
  '⚡','🌐','🔧','🎮','🤖','📡','🚀','📦','🔬','🎨','💡','🛠️',
  '💀','☠️','🩵','🎁','☕','🧾','🔖','📑','📗','📘','📙',
  '🏗️','🔐','📱','🧠','🔮','🏆','🛡️','🔭','🧩','🌿','🦊',
  '🎯','🌟','💎','🎵','🌈','🦾','🐙','🦋','🌊','🔥','❄️','🌙',
]

const CATEGORY_ORDER = ['Blank', 'Frontend', 'Fullstack', 'Backend', 'CLI', 'Desktop', 'Minecraft', 'Discord', 'Other']
const CATEGORY_COLOR = {
  Blank:    'var(--dimmer)',
  Frontend: '#4a9eff',
  Fullstack:'#a855f7',
  Backend:  '#4aff91',
  CLI:      '#ffd700',
  Desktop:  '#ff6b35',
  Minecraft:'#56c936',
  Discord:  '#5865f2',
  Other:    '#00d2ff',
}

export default function ProjectForm() {
  const navigate  = useNavigate()
  const location  = useLocation()

  const [emoji,        setEmoji]        = useState('📁')
  const [name,         setName]         = useState(() => location.state?.prefill?.name || '')
  const [description,  setDescription]  = useState(() => location.state?.prefill?.description || '')
  const [visibility,   setVisibility]   = useState('public')
  const [ide,          setIde]          = useState('vscode')
  const [github,       setGithub]       = useState('')
  const [customPath,   setCustomPath]   = useState('')
  const [tagInput,     setTagInput]     = useState('')
  const [tags,         setTags]         = useState([])
  const [showEmoji,    setShowEmoji]    = useState(false)
  const [errors,       setErrors]       = useState({})
  const [saving,       setSaving]       = useState(false)
  const [setupDone,    setSetupDone]    = useState(null)
  const [showOptional, setShowOptional] = useState(false)

  const [templates,    setTemplates]    = useState([])
  const [templateId,   setTemplateId]   = useState('empty')
  const [initGit,           setInitGit]           = useState(false)
  const [createRepo,        setCreateRepo]        = useState(false)
  const [githubRepoPrivate, setGithubRepoPrivate] = useState(false)
  const [githubUser,        setGithubUser]        = useState('')
  const [catFilter,    setCatFilter]    = useState('All')
  const [shell,        setShell]        = useState('')
  const [platform,     setPlatform]     = useState('win32')

  const SHELL_OPTIONS_MAP = {
    win32: [{ value: '', label: 'cmd.exe' }, { value: 'powershell', label: 'PowerShell' }],
    other: [{ value: '', label: 'sh' }, { value: 'bash', label: 'Bash' }, { value: 'zsh', label: 'Zsh' }, { value: 'fish', label: 'Fish' }],
  }
  const shellOpts = SHELL_OPTIONS_MAP[platform] || SHELL_OPTIONS_MAP.other

  useEffect(() => {
    if (!window.api) return
    window.api.templates.list().then(setTemplates).catch(() => {})
    window.api.settings.get().then(s => {
      setGithubUser(s.user?.github?.username || '')
      if (s.defaults?.ide) setIde(s.defaults.ide)
      if (s.defaults?.shell !== undefined) setShell(s.defaults.shell || '')
    }).catch(() => {})
    window.api.system.platform().then(p => setPlatform(p || 'win32')).catch(() => {})
  }, [])

  const categories = ['All', ...CATEGORY_ORDER.filter(c => templates.some(t => t.category === c))]
  const visibleTemplates = catFilter === 'All' ? templates : templates.filter(t => t.category === catFilter)
  const selectedTemplate = templates.find(t => t.id === templateId)

  const addTag = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault()
      const tag = tagInput.trim().replace(/,/g, '')
      if (tag && !tags.includes(tag)) setTags(p => [...p, tag])
      setTagInput('')
    }
    if (e.key === 'Backspace' && !tagInput && tags.length) setTags(p => p.slice(0, -1))
  }

  const pickFolder = async () => {
    if (!window.api) return
    const picked = await window.api.system.showFolderPicker()
    if (picked) setCustomPath(picked)
  }

  const handleCreate = async () => {
    if (!name.trim()) { setErrors({ name: 'Required' }); return }
    setSaving(true)
    try {
      const result = await window.api.projects.create({
        name, description, emoji, visibility, ide, shell: shell || null,
        github: github || null, path: customPath || null, tags, templateId,
        initGit: initGit || createRepo,
        createGithubRepo: createRepo,
        githubRepoPrivate: createRepo ? githubRepoPrivate : undefined,
      })
      window.dispatchEvent(new CustomEvent('croco:data-changed'))
      if (result.setupWarnings?.length) {
        setSetupDone({ warnings: result.setupWarnings })
      } else {
        navigate('/projects')
      }
    } catch (err) {
      setErrors({ submit: err.message })
    } finally {
      setSaving(false)
    }
  }

  if (setupDone) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '28px 28px 22px', maxWidth: 440, width: '90%' }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Project Created</div>
          {setupDone.warnings.length > 0 && (
            <div style={{ background: 'rgba(255,170,85,0.07)', border: '1px solid rgba(255,170,85,0.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 16 }}>
              {setupDone.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: 11, color: '#ffaa55', fontFamily: 'Geist Mono, monospace', marginBottom: i < setupDone.warnings.length - 1 ? 6 : 0 }}>⚠ {w}</div>
              ))}
            </div>
          )}
          <button onClick={() => navigate('/projects')}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#000', fontSize: 13, fontWeight: 600, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}>
            Go to Projects
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 54, flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate('/projects')}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)', fontSize: 12, fontFamily: 'Geist, sans-serif', padding: '4px 6px', borderRadius: 6, transition: 'all 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--dim)' }}
          >
            <ArrowLeftIcon /> Back
          </button>
          <span style={{ color: 'var(--border-bright)', fontSize: 12 }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>New Project</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/projects')} disabled={saving}
            style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: saving ? 'not-allowed' : 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleCreate} disabled={saving}
            style={{ padding: '6px 16px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#000', fontSize: 12, fontWeight: 600, fontFamily: 'Geist, sans-serif', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left: Form fields */}
        <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '20px 20px 32px' }}>

          {/* Emoji + Name */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={() => setShowEmoji(p => !p)}
                style={{ width: 46, height: 46, borderRadius: 10, background: 'var(--card)', border: `1px solid ${showEmoji ? 'var(--border-bright)' : 'var(--border)'}`, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s' }}
              >
                {emoji}
              </button>
              {showEmoji && (
                <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 50, background: 'var(--surface)', border: '1px solid var(--border-bright)', borderRadius: 10, padding: 8, display: 'flex', flexWrap: 'wrap', gap: 3, width: 192, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                  {EMOJI_PRESETS.map(e => (
                    <button key={e} onClick={() => { setEmoji(e); setShowEmoji(false) }}
                      style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', padding: '3px 5px', borderRadius: 5, transition: 'background 0.1s' }}
                      onMouseEnter={e2 => e2.currentTarget.style.background = 'var(--card)'}
                      onMouseLeave={e2 => e2.currentTarget.style.background = 'none'}
                    >{e}</button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <input
                value={name}
                onChange={e => { setName(e.target.value); if (errors.name) setErrors(p => ({ ...p, name: null })) }}
                placeholder="Project name"
                autoFocus
                style={{ ...iStyle(!!errors.name), fontSize: 13, fontWeight: 500 }}
              />
              {errors.name && <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 3, fontFamily: 'Geist Mono, monospace' }}>{errors.name}</div>}
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 14 }}>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Short description (optional)"
              rows={2}
              style={{ ...iStyle(), resize: 'vertical', minHeight: 58, lineHeight: 1.5, fontSize: 12, color: 'var(--dim)' }}
            />
          </div>

          {/* Visibility */}
          <div style={{ marginBottom: 14 }}>
            <Label>Visibility</Label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['public', '🌐 Public', '#4a9eff'], ['hidden', '🔒 Private', '#a855f7']].map(([v, lbl, col]) => (
                <button key={v} onClick={() => setVisibility(v)}
                  style={{ flex: 1, padding: '6px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontFamily: 'Geist, sans-serif', transition: 'all 0.12s', border: `1px solid ${visibility === v ? col : 'var(--border)'}`, background: visibility === v ? `${col}14` : 'var(--card)', color: visibility === v ? col : 'var(--dim)' }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* IDE */}
          <div style={{ marginBottom: 14 }}>
            <Label>IDE</Label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
              {IDE_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setIde(opt.value)}
                  style={{ padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontFamily: 'Geist, sans-serif', textAlign: 'center', transition: 'all 0.12s', border: `1px solid ${ide === opt.value ? 'var(--accent)' : 'var(--border)'}`, background: ide === opt.value ? 'var(--accent-dim)' : 'var(--card)', color: ide === opt.value ? 'var(--accent)' : 'var(--dim)' }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Shell */}
          <div style={{ marginBottom: 14 }}>
            <Label>Shell</Label>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {shellOpts.map(opt => (
                <button key={opt.value} onClick={() => setShell(opt.value)}
                  style={{ padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontFamily: 'Geist Mono, monospace', transition: 'all 0.12s', border: `1px solid ${shell === opt.value ? 'var(--accent)' : 'var(--border)'}`, background: shell === opt.value ? 'var(--accent-dim)' : 'var(--card)', color: shell === opt.value ? 'var(--accent)' : 'var(--dim)' }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div style={{ marginBottom: 14 }}>
            <Label>Tags</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', minHeight: 36 }}>
              {tags.map(tag => (
                <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'Geist Mono, monospace', fontSize: 10, background: 'var(--border)', color: 'var(--dim)', padding: '2px 7px', borderRadius: 4 }}>
                  {tag}
                  <button onClick={() => setTags(p => p.filter(t => t !== tag))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', fontSize: 11, lineHeight: 1, padding: 0 }}>×</button>
                </span>
              ))}
              <input
                value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={addTag}
                placeholder={tags.length ? '' : 'Add tags…'}
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: 11, color: 'var(--text)', fontFamily: 'Geist, sans-serif', flex: 1, minWidth: 80 }}
              />
            </div>
          </div>

          {/* Git */}
          <div style={{ marginBottom: 14 }}>
            <Label>Git</Label>
            <MiniToggle checked={initGit} onChange={v => { setInitGit(v); if (!v) setCreateRepo(false) }} label="Initialize git repo" />
            {initGit && (
              <div style={{ marginTop: 8 }}>
                <MiniToggle
                  checked={createRepo}
                  onChange={v => { setCreateRepo(v); if (!v) setGithubRepoPrivate(false) }}
                  label={githubUser ? `Create GitHub repo` : 'Create GitHub repo (connect account first)'}
                  disabled={!githubUser}
                />
                {createRepo && githubUser && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 5, paddingLeft: 24 }}>
                    {[{ val: false, label: 'Public' }, { val: true, label: 'Private' }].map(opt => (
                      <button key={opt.label} onClick={() => setGithubRepoPrivate(opt.val)}
                        style={{ padding: '3px 12px', borderRadius: 5, fontSize: 10, cursor: 'pointer', fontFamily: 'Geist, sans-serif', border: '1px solid', borderColor: githubRepoPrivate === opt.val ? 'var(--accent)' : 'var(--border)', background: githubRepoPrivate === opt.val ? 'rgba(74,158,255,0.1)' : 'transparent', color: githubRepoPrivate === opt.val ? 'var(--accent)' : 'var(--dim)', transition: 'all 0.1s' }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Optional section toggle */}
          <button
            onClick={() => setShowOptional(p => !p)}
            style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--dim)', fontSize: 11, fontFamily: 'Geist, sans-serif', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.12s', marginBottom: 14 }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-bright)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <span>Optional settings</span>
            <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10 }}>{showOptional ? '▲' : '▼'}</span>
          </button>

          {showOptional && (
            <>
              <div style={{ marginBottom: 12 }}>
                <Label icon={<GithubIcon />}>Link GitHub Repo</Label>
                <input value={github} onChange={e => setGithub(e.target.value)} placeholder="username/repo" style={{ ...iStyle(), fontFamily: 'Geist Mono, monospace', fontSize: 11 }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <Label icon={<FolderIcon />}>Custom Path</Label>
                <div style={{ display: 'flex', gap: 5 }}>
                  <input value={customPath} onChange={e => setCustomPath(e.target.value)} placeholder="Leave blank for default" style={{ ...iStyle(), fontFamily: 'Geist Mono, monospace', fontSize: 11, flex: 1 }} />
                  {window.api && (
                    <button type="button" onClick={pickFolder}
                      style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--dim)', fontSize: 11, fontFamily: 'Geist, sans-serif', cursor: 'pointer', flexShrink: 0, transition: 'all 0.12s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-bright)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >Browse</button>
                  )}
                </div>
              </div>
            </>
          )}

          {errors.submit && (
            <div style={{ padding: '8px 12px', borderRadius: 7, background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', fontSize: 11, color: '#ff5050', fontFamily: 'Geist Mono, monospace' }}>
              {errors.submit}
            </div>
          )}
        </div>

        {/* Right: Template picker */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Selected template preview */}
          {selectedTemplate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--card)', border: '1px solid var(--border-bright)', borderRadius: 10 }}>
              <span style={{ fontSize: 22 }}>{selectedTemplate.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{selectedTemplate.name}</div>
                <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>{selectedTemplate.desc}</div>
              </div>
              <span style={{ fontSize: 9, fontFamily: 'Geist Mono, monospace', color: CATEGORY_COLOR[selectedTemplate.category] || 'var(--dimmer)', background: `${CATEGORY_COLOR[selectedTemplate.category] || 'var(--dimmer)'}18`, padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {selectedTemplate.category}
              </span>
            </div>
          )}

          {/* Category filter */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {categories.map(c => {
              const col = CATEGORY_COLOR[c] || 'var(--accent)'
              const active = catFilter === c
              return (
                <button key={c} onClick={() => setCatFilter(c)}
                  style={{ padding: '4px 10px', borderRadius: 20, fontSize: 10, cursor: 'pointer', fontFamily: 'Geist, sans-serif', border: '1px solid', borderColor: active ? col : 'var(--border)', background: active ? `${col}16` : 'transparent', color: active ? col : 'var(--dimmer)', transition: 'all 0.1s', fontWeight: active ? 600 : 400 }}>
                  {c}
                </button>
              )
            })}
          </div>

          {/* Template grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 7 }}>
            {visibleTemplates.map(t => {
              const selected = templateId === t.id
              const catColor = CATEGORY_COLOR[t.category] || 'var(--accent)'
              return (
                <button key={t.id} onClick={() => setTemplateId(t.id)}
                  style={{ padding: '11px 11px 9px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', border: `1px solid ${selected ? catColor : 'var(--border)'}`, background: selected ? `${catColor}10` : 'var(--card)', transition: 'all 0.12s', display: 'flex', flexDirection: 'column', gap: 4 }}
                  onMouseEnter={e => { if (!selected) { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.background = 'var(--card-hover)' } }}
                  onMouseLeave={e => { if (!selected) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--card)' } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 17 }}>{t.emoji}</span>
                    {selected && <span style={{ width: 6, height: 6, borderRadius: '50%', background: catColor, flexShrink: 0 }} />}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: selected ? 'var(--text)' : 'var(--dim)', lineHeight: 1.3 }}>{t.name}</div>
                  <div style={{ fontSize: 9, color: 'var(--dimmer)', lineHeight: 1.4, fontFamily: 'Geist Mono, monospace' }}>{t.category}</div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

    </div>
  )
}

function Label({ children, icon, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5, ...style }}>
      {icon && <span style={{ color: 'var(--dimmer)', display: 'flex' }}>{icon}</span>}
      <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{children}</span>
    </div>
  )
}

function MiniToggle({ checked, onChange, label, disabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: disabled ? 0.45 : 1 }}>
      <button
        onClick={() => !disabled && onChange(!checked)}
        style={{ width: 30, height: 17, borderRadius: 9, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', background: checked ? 'var(--accent)' : 'var(--border)', transition: 'background 0.15s', position: 'relative', flexShrink: 0 }}
      >
        <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: checked ? 16 : 3, transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      </button>
      <span style={{ fontSize: 11, color: 'var(--dim)', fontFamily: 'Geist, sans-serif' }}>{label}</span>
    </div>
  )
}

const iStyle = (hasError) => ({
  width: '100%', background: 'var(--card)', border: `1px solid ${hasError ? 'var(--red)' : 'var(--border)'}`,
  borderRadius: 7, padding: '7px 10px', fontSize: 12, color: 'var(--text)', fontFamily: 'Geist, sans-serif',
  outline: 'none', transition: 'border-color 0.12s', boxSizing: 'border-box',
})
