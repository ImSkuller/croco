import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderIcon, CheckCircleIcon } from '../constants/SimpleSvgExports'

const IDE_OPTIONS = [
  { value: 'vscode',   label: 'Visual Studio Code', emoji: '🔵' },
  { value: 'cursor',   label: 'Cursor',             emoji: '⚫' },
  { value: 'zed',      label: 'Zed',                emoji: '⚡' },
  { value: 'neovim',   label: 'Neovim',             emoji: '🟢' },
  { value: 'idea',     label: 'IntelliJ IDEA',      emoji: '🔴' },
  { value: 'webstorm', label: 'WebStorm',            emoji: '🔵' },
]

const PRESET_TAGS = [
  'Developer', 'Designer', 'Student',    'Hobbyist',
  'Builder',   'Maker',    'Engineer',   'Researcher',
  'Freelancer','Open Source','Architect','Hacker',
]

const TOTAL_STEPS = 9

export default function Onboarding() {
  const navigate = useNavigate()

  const [step,           setStep]           = useState(1)
  const [name,           setName]           = useState('')
  const [projectPath,    setProjectPath]    = useState('D:/Projects')
  const [ide,            setIde]            = useState('vscode')
  const [ghToken,        setGhToken]        = useState('')
  const [ghInfo,         setGhInfo]         = useState(null)
  const [ghValidating,   setGhValidating]   = useState(false)
  const [ghError,        setGhError]        = useState('')
  const [oauthEnabled,   setOauthEnabled]   = useState(false)
  const [oauthData,      setOauthData]      = useState(null)
  const [oauthPolling,   setOauthPolling]   = useState(false)
  const [communityUser,  setCommunityUser]  = useState(null)
  const [userTag,        setUserTag]        = useState('Developer')
  const [dataLocation,   setDataLocation]   = useState('appdata')
  const [customDataPath, setCustomDataPath] = useState('')
  const [appDataPath,    setAppDataPath]    = useState('')
  const [storageBackend, setStorageBackend] = useState('json')
  const [closeBehavior,  setCloseBehavior]  = useState('tray')
  const [nameError,      setNameError]      = useState('')
  const oauthPollRef = useRef(null) // { timerId, inFlight } — lets us clear/reschedule and avoid overlapping poll requests

  useEffect(() => {
    window.api?.system.userData().then(p => setAppDataPath(p || '')).catch(() => {})
    window.api?.github?.oauthConfigured().then(v => setOauthEnabled(!!v)).catch(() => {})
  }, [])

  const stopOauthPolling = () => {
    if (oauthPollRef.current?.timerId) clearInterval(oauthPollRef.current.timerId)
    oauthPollRef.current = null
  }

  useEffect(() => stopOauthPolling, [])

  const goNext = () => {
    if (step === 1 && !name.trim()) { setNameError('Please enter your name'); return }
    if (step < TOTAL_STEPS) setStep(p => p + 1)
  }
  const goBack = () => { if (step > 1) setStep(p => p - 1) }

  const pickFolder = async (setter, defaultPath) => {
    if (!window.api) return
    const picked = await window.api.system.showFolderPicker(defaultPath)
    if (picked) setter(picked)
  }

  const validateGithub = async () => {
    if (!ghToken.trim() || ghValidating) return
    setGhValidating(true)
    setGhError('')
    try {
      const info = await window.api.settings.testGithub(ghToken.trim())
      if (info?.ok) {
        setGhInfo({ ok: true, login: info.login, name: info.name, avatar: info.avatarUrl, token: ghToken.trim() })
        const cu = await window.api.system.lookupCommunityUser(info.login).catch(() => null)
        if (cu) { setCommunityUser(cu); setUserTag(cu.tag) }
      } else {
        setGhError('Invalid token — check the token has repo and read:user scope, or skip.')
      }
    } catch {
      setGhError('Network error — skip for now and connect GitHub later in Settings.')
    }
    setGhValidating(false)
  }

  const startOAuth = async () => {
    setGhError('')
    stopOauthPolling()
    try {
      const data = await window.api.github.oauthStart()
      setOauthData(data)
      await window.api.system.openExternal(data.verification_uri)
      pollOAuth(data)
    } catch (e) {
      setGhError(e?.toString() || 'Failed to start GitHub login.')
    }
  }

  const pollOAuth = (data) => {
    setOauthPolling(true)
    // GitHub's device codes expire (~15 min) — without a client-side
    // deadline too, a poll response that never resolves to success/error
    // (e.g. an org requiring admin approval keeps returning
    // authorization_pending) leaves the UI stuck on "Waiting for
    // authorisation" forever with no way out but Cancel.
    const deadline = Date.now() + (data.expires_in || 900) * 1000
    const state = { timerId: null, inFlight: false }
    oauthPollRef.current = state

    const finish = (errorMessage) => {
      clearInterval(state.timerId)
      oauthPollRef.current = null
      setOauthPolling(false)
      setOauthData(null)
      if (errorMessage) setGhError(errorMessage)
    }

    const tick = async () => {
      if (state.inFlight) return // previous poll still in flight — don't pile up requests
      if (Date.now() > deadline) {
        finish('GitHub login timed out before it was approved. Try again, or paste a personal access token below instead.')
        return
      }
      state.inFlight = true
      try {
        const res = await window.api.github.oauthPoll(data.device_code)
        if (res?.status === 'success') {
          finish(null)
          setGhToken(res.token)
          setGhInfo({ ok: true, login: res.login, name: res.name, avatar: res.avatar, token: res.token })
          const cu = await window.api.system.lookupCommunityUser(res.login).catch(() => null)
          if (cu) { setCommunityUser(cu); setUserTag(cu.tag) }
        } else if (res?.status === 'access_denied' || res?.status === 'expired_token') {
          finish('GitHub login was denied or expired. Try again.')
        } else if (res?.status === 'slow_down') {
          // GitHub is asking us to back off — restart the timer at a longer interval
          clearInterval(state.timerId)
          state.timerId = setInterval(tick, ((data.interval || 5) + 5) * 1000)
        }
        // 'authorization_pending' → keep polling silently
      } catch (e) {
        finish(`GitHub login error: ${e?.toString() || 'Unknown error'}`)
      } finally {
        state.inFlight = false
      }
    }
    state.timerId = setInterval(tick, (data.interval || 5) * 1000)
  }

  const skipGithub = () => {
    setGhInfo({ skipped: true })
    setStep(p => p + 1)
  }

  const finish = async () => {
    if (!window.api) { navigate('/'); return }
    const dataPath = (dataLocation === 'custom' && customDataPath.trim()) ? customDataPath.trim() : ''
    await window.api.settings.update({
      user:     { name: name.trim(), github: { username: ghInfo?.login || '', token: ghInfo?.token || '' }, tag: userTag },
      paths:    { publicProjects: projectPath },
      defaults: { ide },
      app:      { onboarded: true, closeBehavior, dataPath, storageBackend },
    }).catch(console.error)
    navigate('/')
  }

  const isLastStep = step === TOTAL_STEPS
  const isGhStep   = step === 4

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', background: 'var(--base)', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 520 }}>

        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 40 }}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} style={{
              width:      i + 1 === step ? 24 : 8,
              height:     8,
              borderRadius: 4,
              background: i + 1 < step
                ? 'var(--green)'
                : i + 1 === step
                  ? 'var(--orange)'
                  : 'var(--border)',
              transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
            }} />
          ))}
        </div>

        {/* Step 1 — Name */}
        {step === 1 && (
          <StepCard>
            <div style={{ fontSize: 40, marginBottom: 16 }}>👋</div>
            <StepTitle>Welcome to Croco</StepTitle>
            <StepDesc>The project manager built for developers. Let's get you set up in a few quick steps.</StepDesc>
            <div style={{ marginTop: 28 }}>
              <FieldLabel>What should we call you?</FieldLabel>
              <input
                value={name}
                onChange={e => { setName(e.target.value); if (nameError) setNameError('') }}
                onKeyDown={e => e.key === 'Enter' && goNext()}
                placeholder="Your name"
                autoFocus
                style={{
                  width: '100%', background: 'var(--card)',
                  border: `1px solid ${nameError ? 'var(--red)' : 'var(--border)'}`,
                  borderRadius: 10, padding: '12px 16px', fontSize: 14,
                  color: 'var(--text)', fontFamily: 'Geist, sans-serif',
                  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.12s',
                }}
              />
              {nameError && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{nameError}</div>}
            </div>
          </StepCard>
        )}

        {/* Step 2 — Projects folder */}
        {step === 2 && (
          <StepCard>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📁</div>
            <StepTitle>Where are your projects?</StepTitle>
            <StepDesc>The root folder where Croco will look for and create projects. You can change this later in Settings.</StepDesc>
            <div style={{ marginTop: 28 }}>
              <FieldLabel>Projects folder</FieldLabel>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={projectPath}
                  onChange={e => setProjectPath(e.target.value)}
                  style={{
                    flex: 1, background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '12px 16px', fontSize: 13,
                    color: 'var(--text)', fontFamily: 'Geist Mono, monospace',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
                <BrowseBtn onClick={() => pickFolder(setProjectPath, projectPath)} />
              </div>
            </div>
          </StepCard>
        )}

        {/* Step 3 — IDE */}
        {step === 3 && (
          <StepCard>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⌨️</div>
            <StepTitle>Pick your IDE</StepTitle>
            <StepDesc>Your default editor for opening projects. You can override this per-project later.</StepDesc>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 28 }}>
              {IDE_OPTIONS.map(opt => (
                <OptionBtn
                  key={opt.value}
                  active={ide === opt.value}
                  onClick={() => setIde(opt.value)}
                >
                  <span style={{ fontSize: 18 }}>{opt.emoji}</span>
                  {opt.label}
                  {ide === opt.value && <span style={{ marginLeft: 'auto', color: 'var(--orange)' }}>✓</span>}
                </OptionBtn>
              ))}
            </div>
          </StepCard>
        )}

        {/* Step 4 — GitHub connect */}
        {step === 4 && (
          <StepCard>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔗</div>
            <StepTitle>Connect GitHub</StepTitle>
            <StepDesc>Link your GitHub account to enable repo creation, commits, and GitHub features. Optional — skip anytime.</StepDesc>

            {!ghInfo ? (
              <div style={{ marginTop: 24 }}>
                {/* OAuth button — only shown when OAuth App is configured */}
                {oauthEnabled && !oauthData && (
                  <button
                    onClick={startOAuth}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      width: '100%', padding: '13px 0', borderRadius: 10, border: '1px solid var(--border)',
                      background: 'var(--card)', color: 'var(--text)', fontSize: 14,
                      fontWeight: 500, fontFamily: 'Geist, sans-serif', cursor: 'pointer',
                      marginBottom: 14, transition: 'border-color 0.12s',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                    Login with GitHub
                  </button>
                )}

                {/* Device flow code display */}
                {oauthData && (
                  <div style={{
                    background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
                    padding: '18px 20px', marginBottom: 14, textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 10 }}>
                      A browser tab opened. Enter this code on GitHub:
                    </div>
                    <div style={{
                      fontFamily: 'Geist Mono, monospace', fontSize: 24, fontWeight: 700,
                      letterSpacing: 6, color: 'var(--orange)', marginBottom: 10,
                    }}>
                      {oauthData.user_code}
                    </div>
                    {oauthPolling && (
                      <div style={{ fontSize: 11, color: 'var(--dimmer)' }}>Waiting for authorisation…</div>
                    )}
                    <button
                      onClick={() => { stopOauthPolling(); setOauthData(null); setOauthPolling(false); }}
                      style={{
                        marginTop: 10, background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--dimmer)', fontSize: 11, textDecoration: 'underline',
                        fontFamily: 'Geist, sans-serif',
                      }}
                    >Cancel</button>
                  </div>
                )}

                {oauthEnabled && !oauthData && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 14px' }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    <span style={{ fontSize: 11, color: 'var(--dimmer)', whiteSpace: 'nowrap' }}>or use a Personal Access Token</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  </div>
                )}

                {!oauthData && (
                  <>
                    <FieldLabel>Personal Access Token</FieldLabel>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        value={ghToken}
                        onChange={e => { setGhToken(e.target.value); setGhError('') }}
                        onKeyDown={e => e.key === 'Enter' && validateGithub()}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        autoFocus={!oauthEnabled}
                        type="password"
                        style={{
                          flex: 1, background: 'var(--card)',
                          border: `1px solid ${ghError ? 'var(--red)' : 'var(--border)'}`,
                          borderRadius: 10, padding: '12px 16px', fontSize: 13,
                          color: 'var(--text)', fontFamily: 'Geist Mono, monospace',
                          outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.12s',
                        }}
                      />
                      <button
                        onClick={validateGithub}
                        disabled={!ghToken.trim() || ghValidating}
                        style={{
                          padding: '12px 18px', borderRadius: 10, border: 'none',
                          background: 'var(--orange)', color: '#fff', fontSize: 13,
                          fontWeight: 500, fontFamily: 'Geist, sans-serif',
                          cursor: ghToken.trim() && !ghValidating ? 'pointer' : 'default',
                          opacity: ghToken.trim() && !ghValidating ? 1 : 0.45,
                          transition: 'all 0.12s', whiteSpace: 'nowrap',
                        }}
                      >
                        {ghValidating ? '…' : 'Validate'}
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--dimmer)', marginTop: 6 }}>
                      Create one at <span style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--dim)' }}>github.com/settings/tokens</span> — needs <code style={{ background: 'var(--card)', padding: '1px 4px', borderRadius: 4 }}>repo</code> + <code style={{ background: 'var(--card)', padding: '1px 4px', borderRadius: 4 }}>read:user</code> scope.
                    </div>
                    {ghError && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 6 }}>{ghError}</div>}
                  </>
                )}
              </div>
            ) : (
              <div style={{ marginTop: 28 }}>
                {ghInfo.ok && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    background: 'var(--card)', border: '1px solid var(--green)',
                    borderRadius: 12, padding: '16px 20px',
                    animation: 'pmFadeUp 0.3s cubic-bezier(0.16,1,0.3,1) both',
                  }}>
                    {ghInfo.avatar && (
                      <img src={ghInfo.avatar} alt="" style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>@{ghInfo.login}</div>
                      {ghInfo.name && <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>{ghInfo.name}</div>}
                    </div>
                    <span style={{ fontSize: 20, color: 'var(--green)' }}>✓</span>
                  </div>
                )}
                {ghInfo.skipped && (
                  <div style={{ fontSize: 13, color: 'var(--dimmer)', textAlign: 'center', fontFamily: 'Geist Mono, monospace', padding: '16px 0' }}>
                    Skipped — connect GitHub later in Settings.
                  </div>
                )}
                <button
                  onClick={() => { stopOauthPolling(); setGhInfo(null); setGhToken(''); setCommunityUser(null); setOauthData(null); setOauthPolling(false) }}
                  style={{
                    display: 'block', margin: '10px auto 0', background: 'none', border: 'none',
                    cursor: 'pointer', color: 'var(--dimmer)', fontSize: 12,
                    fontFamily: 'Geist, sans-serif', textDecoration: 'underline',
                  }}
                >
                  Use a different account
                </button>
              </div>
            )}
          </StepCard>
        )}

        {/* Step 5 — Tag */}
        {step === 5 && (
          <StepCard>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🏷️</div>
            {communityUser ? (
              <>
                <StepTitle>Your tag is special!</StepTitle>
                <StepDesc>
                  Hey {name}! Your tag has been predefined by the author of Croco. 😄
                </StepDesc>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10, marginTop: 24,
                  background: 'rgba(255,107,53,0.12)', border: '1px solid var(--orange)',
                  borderRadius: 24, padding: '10px 22px',
                }}>
                  <span style={{ fontSize: 16 }}>🔒</span>
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--orange)', letterSpacing: -0.3 }}>
                    {communityUser.tag}
                  </span>
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
                  This tag cannot be changed.
                </div>
              </>
            ) : (
              <>
                <StepTitle>Pick your tag</StepTitle>
                <StepDesc>Shown under your name in the sidebar. You can change this later in Settings.</StepDesc>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 24 }}>
                  {PRESET_TAGS.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setUserTag(tag)}
                      style={{
                        padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
                        fontFamily: 'Geist, sans-serif', fontSize: 12, textAlign: 'center',
                        border:     `1px solid ${userTag === tag ? 'var(--orange)' : 'var(--border)'}`,
                        background: userTag === tag ? 'rgba(255,107,53,0.1)' : 'var(--card)',
                        color:      userTag === tag ? 'var(--text)'           : 'var(--dim)',
                        transition: 'all 0.12s',
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </>
            )}
          </StepCard>
        )}

        {/* Step 6 — Data storage */}
        {step === 6 && (
          <StepCard>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🗄️</div>
            <StepTitle>Data storage</StepTitle>
            <StepDesc>Where should Croco store your projects, notes, and todos?</StepDesc>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
              {[
                {
                  id:    'appdata',
                  label: 'App Data',
                  badge: 'Recommended',
                  desc:  appDataPath || '%APPDATA%/croco',
                  icon:  '🖥️',
                },
                {
                  id:    'custom',
                  label: 'Custom Folder',
                  badge: null,
                  desc:  customDataPath || 'Choose a folder — great for Dropbox / OneDrive sync',
                  icon:  '📂',
                },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setDataLocation(opt.id)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                    fontFamily: 'Geist, sans-serif', textAlign: 'left',
                    border:     `1px solid ${dataLocation === opt.id ? 'var(--orange)' : 'var(--border)'}`,
                    background: dataLocation === opt.id ? 'rgba(255,107,53,0.08)' : 'var(--card)',
                    transition: 'all 0.12s',
                  }}
                >
                  <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{opt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: dataLocation === opt.id ? 'var(--text)' : 'var(--dim)' }}>
                        {opt.label}
                      </span>
                      {opt.badge && (
                        <span style={{ fontSize: 10, background: 'var(--border)', padding: '1px 6px', borderRadius: 4, color: 'var(--dim)', fontFamily: 'Geist Mono, monospace' }}>
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', marginTop: 3, wordBreak: 'break-all' }}>
                      {opt.desc}
                    </div>
                  </div>
                  {dataLocation === opt.id && <span style={{ color: 'var(--orange)', flexShrink: 0, marginTop: 2 }}>✓</span>}
                </button>
              ))}
            </div>
            {dataLocation === 'custom' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input
                  value={customDataPath}
                  onChange={e => setCustomDataPath(e.target.value)}
                  placeholder="Choose a folder…"
                  style={{
                    flex: 1, background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '10px 14px', fontSize: 12,
                    color: 'var(--text)', fontFamily: 'Geist Mono, monospace',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
                <BrowseBtn onClick={() => pickFolder(setCustomDataPath, customDataPath)} />
              </div>
            )}
          </StepCard>
        )}

        {/* Step 7 — Storage Backend */}
        {step === 7 && (
          <StepCard>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🗃️</div>
            <StepTitle>Storage backend</StepTitle>
            <StepDesc>How should Croco store your projects, notes, and todos? Activity is always in SQLite.</StepDesc>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
              {[
                {
                  id:    'json',
                  label: 'JSON Files',
                  badge: 'Default',
                  icon:  '📄',
                  pros:  ['Human-readable files', 'Easy to back up manually'],
                  cons:  ['Slower with large datasets'],
                },
                {
                  id:    'sqlite',
                  label: 'SQLite Database',
                  badge: null,
                  icon:  '🗄️',
                  pros:  ['Faster queries', 'Atomic writes — no data loss'],
                  cons:  ['Binary format — not hand-editable'],
                },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setStorageBackend(opt.id)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                    fontFamily: 'Geist, sans-serif', textAlign: 'left',
                    border:     `1px solid ${storageBackend === opt.id ? 'var(--orange)' : 'var(--border)'}`,
                    background: storageBackend === opt.id ? 'rgba(255,107,53,0.08)' : 'var(--card)',
                    transition: 'all 0.12s',
                  }}
                >
                  <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{opt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: storageBackend === opt.id ? 'var(--text)' : 'var(--dim)' }}>
                        {opt.label}
                      </span>
                      {opt.badge && (
                        <span style={{ fontSize: 10, background: 'var(--border)', padding: '1px 6px', borderRadius: 4, color: 'var(--dim)', fontFamily: 'Geist Mono, monospace' }}>
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {opt.pros.map(p => <div key={p} style={{ fontSize: 11, color: '#4aff91' }}>+ {p}</div>)}
                      {opt.cons.map(c => <div key={c} style={{ fontSize: 11, color: 'var(--dimmer)' }}>– {c}</div>)}
                    </div>
                  </div>
                  {storageBackend === opt.id && <span style={{ color: 'var(--orange)', flexShrink: 0, marginTop: 2 }}>✓</span>}
                </button>
              ))}
            </div>
          </StepCard>
        )}

        {/* Step 8 — Close behavior */}
        {step === 8 && (
          <StepCard>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🪟</div>
            <StepTitle>When you close the window</StepTitle>
            <StepDesc>What should happen when you click the X on the title bar?</StepDesc>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
              {[
                {
                  id:    'tray',
                  label: 'Minimize to Tray',
                  badge: 'Default',
                  desc:  'Croco keeps running in the background. Access it from the system tray icon.',
                  icon:  '🔔',
                },
                {
                  id:    'quit',
                  label: 'Quit the App',
                  badge: null,
                  desc:  'Fully closes Croco. Running dev servers will be stopped.',
                  icon:  '❌',
                },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setCloseBehavior(opt.id)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                    fontFamily: 'Geist, sans-serif', textAlign: 'left',
                    border:     `1px solid ${closeBehavior === opt.id ? 'var(--orange)' : 'var(--border)'}`,
                    background: closeBehavior === opt.id ? 'rgba(255,107,53,0.08)' : 'var(--card)',
                    transition: 'all 0.12s',
                  }}
                >
                  <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{opt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: closeBehavior === opt.id ? 'var(--text)' : 'var(--dim)' }}>
                        {opt.label}
                      </span>
                      {opt.badge && (
                        <span style={{ fontSize: 10, background: 'var(--border)', padding: '1px 6px', borderRadius: 4, color: 'var(--dim)', fontFamily: 'Geist Mono, monospace' }}>
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--dimmer)', marginTop: 3, lineHeight: 1.5 }}>
                      {opt.desc}
                    </div>
                  </div>
                  {closeBehavior === opt.id && <span style={{ color: 'var(--orange)', flexShrink: 0, marginTop: 2 }}>✓</span>}
                </button>
              ))}
            </div>
          </StepCard>
        )}

        {/* Step 9 — Done */}
        {step === 9 && (
          <StepCard>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(74,255,145,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4aff91' }}>
                <CheckCircleIcon />
              </div>
            </div>
            <StepTitle>You're all set, {name || 'there'}!</StepTitle>
            <StepDesc>Here's a summary of what we've configured:</StepDesc>
            <div style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '16px 20px', marginTop: 20,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <SummaryRow label="Name"          value={name || '—'} />
              <SummaryRow label="Tag"           value={userTag} />
              {ghInfo?.login && <SummaryRow label="GitHub" value={`@${ghInfo.login}`} mono />}
              <SummaryRow label="Projects"      value={projectPath} mono />
              <SummaryRow label="IDE"           value={IDE_OPTIONS.find(o => o.value === ide)?.label || ide} />
              <SummaryRow label="Data Storage"  value={dataLocation === 'custom' && customDataPath ? customDataPath : 'App Data (Default)'} mono />
              <SummaryRow label="Storage"       value={storageBackend === 'sqlite' ? 'SQLite Database' : 'JSON Files'} />
              <SummaryRow label="Close Window"  value={closeBehavior === 'tray' ? 'Minimize to Tray' : 'Quit App'} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--dimmer)', marginTop: 10, textAlign: 'center' }}>
              All of this can be changed anytime in Settings.
            </div>
          </StepCard>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 }}>
          <button
            onClick={goBack}
            disabled={step === 1}
            style={{
              padding: '10px 18px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--dim)', fontSize: 13, fontFamily: 'Geist, sans-serif',
              cursor: step === 1 ? 'default' : 'pointer',
              opacity: step === 1 ? 0 : 1,
              transition: 'all 0.12s',
            }}
          >
            ← Back
          </button>

          <div style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
            {step} / {TOTAL_STEPS}
          </div>

          {isGhStep && !ghInfo ? (
            <button
              onClick={skipGithub}
              style={{
                padding: '10px 20px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--dim)', fontSize: 13, fontFamily: 'Geist, sans-serif',
                cursor: 'pointer', transition: 'all 0.12s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-bright)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              Skip →
            </button>
          ) : !isLastStep ? (
            <button
              onClick={goNext}
              style={{
                padding: '10px 24px', borderRadius: 8, border: 'none',
                background: 'var(--orange)', color: '#fff', fontSize: 13,
                fontWeight: 500, fontFamily: 'Geist, sans-serif', cursor: 'pointer',
                transition: 'opacity 0.12s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={finish}
              style={{
                padding: '10px 24px', borderRadius: 8, border: 'none',
                background: '#4aff91', color: '#000', fontSize: 13,
                fontWeight: 600, fontFamily: 'Geist, sans-serif', cursor: 'pointer',
                transition: 'opacity 0.12s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Let's Go →
            </button>
          )}
        </div>

      </div>
    </div>
  )
}

function StepCard({ children }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '36px 32px', textAlign: 'center',
      boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
      animation: 'pmFadeUp 0.35s cubic-bezier(0.16,1,0.3,1) both',
    }}>
      {children}
    </div>
  )
}

function StepTitle({ children }) {
  return (
    <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: '0 0 10px', letterSpacing: -0.5 }}>
      {children}
    </h1>
  )
}

function StepDesc({ children }) {
  return (
    <p style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6, margin: 0 }}>
      {children}
    </p>
  )
}

function FieldLabel({ children }) {
  return (
    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--dim)', display: 'block', marginBottom: 8, textAlign: 'left' }}>
      {children}
    </label>
  )
}

function OptionBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
        fontFamily: 'Geist, sans-serif', fontSize: 13, textAlign: 'left',
        border:     `1px solid ${active ? 'var(--orange)' : 'var(--border)'}`,
        background: active ? 'rgba(255,107,53,0.08)' : 'var(--card)',
        color:      active ? 'var(--text)'            : 'var(--dim)',
        transition: 'all 0.12s',
      }}
    >
      {children}
    </button>
  )
}

function BrowseBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)',
        background: 'var(--card)', color: 'var(--dim)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', transition: 'all 0.12s', flexShrink: 0,
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-bright)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <FolderIcon />
    </button>
  )
}

function SummaryRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text)', fontFamily: mono ? 'Geist Mono, monospace' : 'Geist, sans-serif', textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}
