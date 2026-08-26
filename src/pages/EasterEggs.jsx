import { useNavigate } from 'react-router-dom'
import { ArrowLeftIcon } from '../constants/SimpleSvgExports'
import { modKeyHint } from '../lib/platform'

const EGGS = [
  {
    id: 'croco-run',
    emoji: '🐊',
    title: 'Croco Run',
    desc: 'A mini endless-runner game hidden inside the app.',
    how: [
      'Click your profile picture 5 times quickly in the sidebar.',
      `Or type croco:game in the search palette (${modKeyHint('K')}).`,
    ],
  },
  {
    id: 'easter-egg-page',
    emoji: '🥚',
    title: 'Easter Egg List',
    desc: 'This very page — a list of all hidden features.',
    how: [`Type croco:easter-egg in the search palette (${modKeyHint('K')}).`],
  },
  {
    id: 'babum',
    emoji: '🎵',
    title: 'ba bum ba bum',
    desc: 'A special audio easter egg.',
    how: [`Type croco:babumbabum in the search palette (${modKeyHint('K')}).`],
  },
  {
    id: 'leetcode',
    emoji: '🧩',
    title: 'LeetCode',
    desc: 'Quick-launch the LeetCode problem set in your browser — for when the compile finishes early.',
    how: [`Type croco:leetcode in the search palette (${modKeyHint('K')}).`],
  },
]

export default function EasterEggs() {
  const navigate = useNavigate()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 28px', height: 54, flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', display: 'flex', padding: 4, borderRadius: 6, transition: 'color 0.12s' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--dim)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--dimmer)'}
        >
          <ArrowLeftIcon />
        </button>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--dim)' }}>Croco</span>
        <span style={{ color: 'var(--dimmer)' }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Easter Eggs</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="pm-page" style={{ padding: 28, maxWidth: 640 }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: -0.5, marginBottom: 6 }}>
              🥚 Hidden Easter Eggs
            </div>
            <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>
              Croco has a few hidden surprises. Here's how to find them all.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {EGGS.map(egg => (
              <div
                key={egg.id}
                style={{
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '18px 20px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 24 }}>{egg.emoji}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{egg.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>{egg.desc}</div>
                  </div>
                </div>
                <div style={{ paddingLeft: 36 }}>
                  {egg.how.map((h, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'Geist Mono, monospace', flexShrink: 0, marginTop: 2 }}>{i + 1}.</span>
                      <span style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.5 }}>{h}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 32, padding: '14px 18px', borderRadius: 10, background: 'rgba(74,255,145,0.04)', border: '1px solid rgba(74,255,145,0.12)', fontSize: 12, color: 'var(--dimmer)', lineHeight: 1.6 }}>
            More easter eggs may be added in future updates. Keep exploring!
          </div>
        </div>
      </div>
    </div>
  )
}
