import { useState, useEffect } from 'react'
import { UserIcon, LockIcon } from '../../constants/SimpleSvgExports'
import { SectionTitle, SettingsCard, FieldLabel, FieldDesc, TextInput, SmallBtn } from './Exports'
import { useToast } from '../Toast/useToast.js'

const PRESET_TAGS = [
  'Developer', 'Designer', 'Student',    'Hobbyist',
  'Builder',   'Maker',    'Engineer',   'Researcher',
  'Freelancer','Open Source','Architect','Hacker',
]

export default function UserSection({ settings, saveField, patchLocal }) {
  const toast = useToast()
  const user = settings.user || {}
  const userAvatar = user.avatar || null
  const userTag = user.tag || 'Developer'
  const ghUser = user.github?.username
  const [userName, setUserName] = useState(user.name || '')
  const [tagLocked, setTagLocked] = useState(false)

  // A community user's tag is predefined by the author and can't be changed.
  useEffect(() => {
    if (!ghUser || !window.api) return
    let cancelled = false
    window.api.system.lookupCommunityUser(ghUser)
      .then(cu => { if (!cancelled && cu?.locked) setTagLocked(true) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [ghUser])

  const handleAvatarUpload = async () => {
    if (!window.api) return
    const filePath = await window.api.system.showFilePicker(null, [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg'] },
    ])
    if (!filePath) return
    try {
      const b64 = await window.api.settings.saveAvatar(filePath)
      patchLocal({ user: { avatar: b64 } })
    } catch (e) {
      toast.error('Avatar upload failed', e.message)
    }
  }

  return (
    <>
      <SectionTitle icon={<UserIcon />} title="User" desc="Your name and photo." />

      <SettingsCard>
        <FieldLabel>Avatar</FieldLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'var(--text)', fontFamily: 'Geist Mono, monospace', flexShrink: 0, overflow: 'hidden' }}>
            {userAvatar
              ? <img src={userAvatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (userName.slice(0, 2).toUpperCase() || '??')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SmallBtn onClick={handleAvatarUpload}>Upload Photo</SmallBtn>
            {userAvatar && (
              <SmallBtn onClick={() => saveField({ user: { avatar: null } })}>Remove</SmallBtn>
            )}
            <span style={{ fontSize: 11, color: 'var(--dimmer)' }}>PNG or JPG, max 2MB</span>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard>
        <FieldLabel>Display Name</FieldLabel>
        <FieldDesc>Shown in the sidebar and in the Dashboard greeting.</FieldDesc>
        <TextInput value={userName} onChange={setUserName} onBlur={() => saveField({ user: { name: userName } })} placeholder="Your name" />
      </SettingsCard>

      <SettingsCard>
        <FieldLabel>Tag</FieldLabel>
        <FieldDesc>Shown under your name in the sidebar.</FieldDesc>
        {tagLocked ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--accent-dim)', border: '1px solid var(--accent)',
              borderRadius: 'var(--r-xl)', padding: '6px 14px',
            }}>
              <span style={{ display: 'flex', color: 'var(--accent)' }}><LockIcon size={14} /></span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{userTag}</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
              predefined by the author
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {PRESET_TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => saveField({ user: { tag } })}
                style={{
                  padding: '5px 12px', borderRadius: 'var(--r-xl)', cursor: 'pointer',
                  fontFamily: 'Geist, sans-serif', fontSize: 12,
                  border:     `1px solid ${userTag === tag ? 'var(--accent)' : 'var(--border)'}`,
                  background: userTag === tag ? 'var(--accent-dim)' : 'var(--card)',
                  color:      userTag === tag ? 'var(--text)'       : 'var(--dim)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </SettingsCard>
    </>
  )
}
