import { useState, useEffect, useRef } from 'react'
import { GitIcon, CheckIcon, XCircleIcon } from '../../constants/SimpleSvgExports'
import { SectionTitle, SettingsCard, FieldLabel, FieldDesc, TextInput, InfoBox, SmallBtn } from './Exports'
import { useToast } from '../Toast/useToast.js'
import { codeStyle } from './shared.js'

const GITHUB_MARK = 'M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z'

const SETUP_STEPS = [
  { n: 1, text: 'Open the GitHub page that creates a token (a password for apps)', btn: 'Open GitHub →', url: 'https://github.com/settings/tokens/new?scopes=repo,read:user&description=Croco+Dev+Manager' },
  { n: 2, text: 'Leave "repo" and "read:user" ticked, then click "Generate token"' },
  { n: 3, text: 'Paste the token below and click "Test Connection"' },
]

const linkBtn = { marginLeft: 8, fontSize: 11, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontFamily: 'Geist, sans-serif' }

export default function GitHubSection({ settings, saveField, patchLocal }) {
  const toast = useToast()
  const gh = settings.user?.github || {}
  const [ghUsername, setGhUsername] = useState(gh.username || '')
  // ghToken only ever holds a value the user just typed this session —
  // settings_get never returns the real stored token (it lives in the OS
  // keyring), so "is a token on file" is tracked separately.
  const [ghToken, setGhToken] = useState('')
  const [ghTokenStored, setGhTokenStored] = useState(!!gh.tokenStored)
  const [ghTestStatus, setGhTestStatus] = useState(null) // null | 'testing' | {ok, login, message}
  const secretsFallbackActive = !!settings.app?.secretsFallbackActive
  const [oauthEnabled, setOauthEnabled] = useState(true) // optimistic; corrected by the check below
  const [oauthData, setOauthData] = useState(null) // {user_code, verification_uri, device_code, interval}
  const [oauthPolling, setOauthPolling] = useState(false)
  const oauthPollRef = useRef(null) // { timerId, inFlight } — lets us clear/reschedule and avoid overlapping polls

  useEffect(() => {
    window.api?.github?.oauthConfigured().then(v => setOauthEnabled(!!v)).catch(() => {})
  }, [])

  // Stops any in-flight poll timer, so a previous click/unmount can't leave an
  // orphaned poller racing a fresh attempt.
  const stopOauthPolling = () => {
    if (oauthPollRef.current?.timerId) clearInterval(oauthPollRef.current.timerId)
    oauthPollRef.current = null
  }
  useEffect(() => stopOauthPolling, [])

  const ghConnected = ghUsername.trim() !== '' && (ghTokenStored || ghToken.trim() !== '')

  const handleTestGithub = async () => {
    if (!ghToken.trim()) return
    setGhTestStatus('testing')
    const result = await window.api.settings.testGithub(ghToken).catch(e => ({ ok: false, message: e.message }))
    setGhTestStatus(result)
    if (result?.ok && result.login) setGhUsername(result.login)
  }

  // The personal access token is the one field here that needs an explicit
  // save: it's a secret written to the OS keyring, so it shouldn't fire on
  // blur — a stray tab-away mid-paste would store a half-typed token.
  const handleSaveGithubToken = async () => {
    if (!ghToken.trim() || !window.api) return
    await window.api.settings.setGithubToken(ghToken.trim()).catch(console.error)
    setGhTokenStored(true)
    setGhToken('')
    toast.success('GitHub token saved')
  }

  const handleOAuthStart = async () => {
    setGhTestStatus(null)
    stopOauthPolling()
    try {
      const data = await window.api.github.oauthStart()
      setOauthData(data)
      await window.api.system.openExternal(data.verification_uri)
      setOauthPolling(true)

      // GitHub's device codes expire (~15 min). Without a client-side deadline
      // too, a poll that never resolves (e.g. an org needing admin approval
      // keeps returning authorization_pending) would leave the UI stuck.
      const deadline = Date.now() + (data.expires_in || 900) * 1000
      const state = { timerId: null, inFlight: false }
      oauthPollRef.current = state

      const finish = (status) => {
        clearInterval(state.timerId)
        oauthPollRef.current = null
        setOauthPolling(false)
        setOauthData(null)
        setGhTestStatus(status)
      }

      const tick = async () => {
        if (state.inFlight) return // previous poll still in flight — don't pile up requests
        if (Date.now() > deadline) {
          finish({ ok: false, message: 'GitHub login timed out before it was approved. Try again, or paste a token below instead.' })
          return
        }
        state.inFlight = true
        try {
          const res = await window.api.github.oauthPoll(data.device_code)
          if (res?.status === 'success') {
            const login = res.login || ''
            const token = res.token || ''
            finish({ ok: true, login })
            setGhUsername(login)
            // Token goes straight to the OS keyring, never through settings.update.
            if (token) {
              await window.api.settings.setGithubToken(token).catch(console.error)
              setGhTokenStored(true)
            }
            await saveField({ user: { github: { username: login } } })
            if (login) {
              const cu = await window.api.system.lookupCommunityUser(login).catch(() => null)
              if (cu) patchLocal({ user: { tag: cu.tag } })
            }
          } else if (res?.status === 'access_denied' || res?.status === 'expired_token') {
            finish({ ok: false, message: 'Login was denied or expired.' })
          } else if (res?.status === 'slow_down') {
            // GitHub is asking us to back off — restart the timer at a longer interval
            clearInterval(state.timerId)
            state.timerId = setInterval(tick, ((data.interval || 5) + 5) * 1000)
          }
          // 'authorization_pending' → keep polling silently
        } catch (e) {
          finish({ ok: false, message: `Login error: ${e?.toString() || 'Unknown error'}` })
        } finally {
          state.inFlight = false
        }
      }
      state.timerId = setInterval(tick, (data.interval || 5) * 1000)
    } catch (e) {
      setOauthPolling(false)
      setGhTestStatus({ ok: false, message: e?.toString() || 'Failed to start GitHub login.' })
    }
  }

  return (
    <>
      <SectionTitle icon={<GitIcon />} title="GitHub" desc="Connect GitHub to upload your projects from inside Croco." />

      <SettingsCard>
        <FieldLabel>How to Connect</FieldLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {SETUP_STEPS.map(step => (
            <div key={step.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                {step.n}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 12, color: 'var(--dim)' }}>{step.text}</span>
                {step.btn && (
                  <button onClick={() => window.api?.system.openExternal(step.url)} style={linkBtn}>{step.btn}</button>
                )}
              </div>
            </div>
          ))}
        </div>
        <InfoBox style={{ marginTop: 12 }}>
          Croco needs Git installed on your computer. <span style={{ color: 'var(--blue)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => window.api?.system.openExternal('https://git-scm.com/downloads')}>Download git</span> if you see a "cannot initialize repository" error.
        </InfoBox>
      </SettingsCard>

      <SettingsCard>
        <FieldLabel>GitHub Username</FieldLabel>
        <FieldDesc>Used to link your projects to GitHub.</FieldDesc>
        <TextInput value={ghUsername} onChange={setGhUsername} onBlur={() => saveField({ user: { github: { username: ghUsername } } })} placeholder="your-username" mono />
      </SettingsCard>

      <SettingsCard>
        <FieldLabel>Connect GitHub Account</FieldLabel>
        <FieldDesc>The easiest way: log in on GitHub's website and you're done.</FieldDesc>
        {!oauthEnabled ? (
          <InfoBox style={{ marginTop: 10 }}>Quick login isn't available in this version. Use a token below instead.</InfoBox>
        ) : !oauthData ? (
          <button
            onClick={handleOAuthStart}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, marginTop: 10,
              padding: '10px 18px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
              background: ghConnected ? 'rgba(74,255,145,0.06)' : 'var(--base)',
              color: 'var(--text)', fontSize: 13,
              fontWeight: 500, fontFamily: 'Geist, sans-serif', cursor: 'pointer',
              transition: 'border-color var(--transition-fast)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d={GITHUB_MARK} /></svg>
            {ghConnected ? `Reconnect as @${ghUsername}` : 'Login with GitHub'}
          </button>
        ) : (
          <div style={{ marginTop: 10, padding: '12px 16px', borderRadius: 'var(--r-md)', background: 'var(--base)', border: '1px solid var(--border)', fontSize: 13 }}>
            <div style={{ color: 'var(--dim)', marginBottom: 6 }}>Type this code on <span style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--text)' }}>github.com/login/device</span>:</div>
            <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 22, fontWeight: 700, letterSpacing: 5, color: 'var(--orange)', marginBottom: 6 }}>
              {oauthData.user_code}
            </div>
            {oauthPolling && <div style={{ fontSize: 11, color: 'var(--dimmer)' }}>Waiting for you to approve on GitHub…</div>}
            <button
              onClick={() => { stopOauthPolling(); setOauthData(null); setOauthPolling(false) }}
              style={{ marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', fontSize: 11, textDecoration: 'underline', fontFamily: 'Geist, sans-serif' }}
            >Cancel</button>
          </div>
        )}
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <FieldLabel>Token</FieldLabel>
          <FieldDesc>
            Use this if the login button above doesn't work. Create one at github.com/settings/tokens with the <code style={codeStyle}>repo</code> option ticked.
            {ghTokenStored && ' A token is already saved. Paste a new one to replace it.'}
          </FieldDesc>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <TextInput type="password" value={ghToken} onChange={setGhToken} placeholder={ghTokenStored ? '••••••••  (saved, paste to replace)' : 'ghp_...'} mono />
            <SmallBtn onClick={handleSaveGithubToken} disabled={!ghToken.trim()}>Save Token</SmallBtn>
            <SmallBtn onClick={handleTestGithub}>{ghTestStatus === 'testing' ? 'Testing…' : 'Test Connection'}</SmallBtn>
          </div>
          {secretsFallbackActive && (
            <InfoBox style={{ marginTop: 10 }}>
              Your computer's secure password storage isn't available, so this token is saved in an encrypted file on this computer instead.
            </InfoBox>
          )}
        </div>
        {ghTestStatus && ghTestStatus !== 'testing' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, color: ghTestStatus.ok ? 'var(--green)' : 'var(--red)', fontFamily: 'Geist Mono, monospace' }}>
            {ghTestStatus.ok
              ? <><CheckIcon size={12} /> Connected as @{ghTestStatus.login}</>
              : <><XCircleIcon size={12} /> {ghTestStatus.message}</>}
          </div>
        )}
      </SettingsCard>

      <SettingsCard>
        <FieldLabel>Connection Status</FieldLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: ghConnected ? 'var(--green)' : 'var(--dimmer)',
            boxShadow: ghConnected ? '0 0 0 3px rgba(74,255,145,0.15)' : 'none',
          }} />
          {ghConnected ? (
            <span style={{ fontSize: 13, color: 'var(--text)' }}>
              Connected as <span style={{ color: 'var(--blue)', fontFamily: 'Geist Mono, monospace' }}>@{ghUsername}</span>
            </span>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--dimmer)' }}>Not connected. Follow the steps above.</span>
          )}
          {ghConnected && (
            <SmallBtn onClick={() => window.api?.system.openExternal(`https://github.com/${ghUsername}`)}>
              View Profile
            </SmallBtn>
          )}
        </div>
      </SettingsCard>
    </>
  )
}
