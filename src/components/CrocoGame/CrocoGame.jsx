import { useEffect, useRef, useState, useCallback } from 'react'

const W = 600
const H = 200
const GROUND = H - 30
const GRAVITY = 0.55
const JUMP_V = -11.5
const CROCO_W = 34
const CROCO_H = 32
const OBS_W = 18
const OBS_MIN_H = 28
const OBS_MAX_H = 52

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

function drawCroco(ctx, x, y, frame) {
  ctx.save()
  // body
  ctx.fillStyle = '#4aff91'
  ctx.fillRect(x + 4, y + 8, 24, 20)
  // tail
  ctx.fillRect(x, y + 18, 8, 8)
  // head
  ctx.fillRect(x + 20, y + 4, 14, 12)
  // snout
  ctx.fillStyle = '#3de87e'
  ctx.fillRect(x + 30, y + 6, 8, 8)
  // eye
  ctx.fillStyle = '#000'
  ctx.fillRect(x + 26, y + 5, 3, 3)
  ctx.fillStyle = '#fff'
  ctx.fillRect(x + 27, y + 5, 1, 1)
  // legs – alternate frames
  ctx.fillStyle = '#3de87e'
  if (frame % 2 === 0) {
    ctx.fillRect(x + 8,  y + 26, 6, 6)
    ctx.fillRect(x + 18, y + 24, 6, 6)
  } else {
    ctx.fillRect(x + 8,  y + 24, 6, 6)
    ctx.fillRect(x + 18, y + 26, 6, 6)
  }
  ctx.restore()
}

function drawCactus(ctx, x, y, h) {
  ctx.fillStyle = '#56c936'
  ctx.fillRect(x + 5, y - h, 8, h)         // trunk
  ctx.fillRect(x, y - h + 12, 18, 7)        // arm crossbar
  ctx.fillRect(x, y - h + 4, 6, 10)         // left arm
  ctx.fillRect(x + 12, y - h + 8, 6, 10)    // right arm
}

function drawCloud(ctx, x, y) {
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.beginPath()
  ctx.arc(x,      y,      14, 0, Math.PI * 2)
  ctx.arc(x + 18, y - 6,  18, 0, Math.PI * 2)
  ctx.arc(x + 38, y,      12, 0, Math.PI * 2)
  ctx.fill()
}

function drawGround(ctx) {
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  ctx.fillRect(0, GROUND + 30, W, 1)
}

function drawScore(ctx, score, highScore) {
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = '500 11px "Geist Mono", monospace'
  ctx.textAlign = 'left'
  ctx.fillText(`HI ${String(highScore).padStart(5, '0')}`, 10, 20)
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.textAlign = 'right'
  ctx.fillText(String(score).padStart(5, '0'), W - 10, 20)
}

export default function CrocoGame({ onClose }) {
  const canvasRef  = useRef(null)
  const stateRef   = useRef(null)
  const rafRef     = useRef(null)
  const [phase,    setPhase]    = useState('idle')  // idle | playing | dead
  const [score,    setScore]    = useState(0)
  const [highScore, setHighScore] = useState(0)

  useEffect(() => {
    window.api?.settings?.get().then(s => {
      setHighScore(s?.game?.highScore || 0)
    }).catch(() => {})
  }, [])

  const initState = useCallback(() => ({
    croco:      { x: 60, y: GROUND, vy: 0, onGround: true },
    obstacles:  [],
    clouds:     [{ x: 80, y: 40 }, { x: 300, y: 55 }, { x: 520, y: 35 }],
    speed:      5,
    frame:      0,
    tick:       0,
    score:      0,
    nextObsDist: rand(200, 340),
    dead:       false,
  }), [])

  const jump = useCallback(() => {
    if (!stateRef.current) return
    const s = stateRef.current
    if (s.onGround !== false && s.croco.onGround) {
      s.croco.vy = JUMP_V
      s.croco.onGround = false
    }
  }, [])

  const start = useCallback(() => {
    stateRef.current = initState()
    setPhase('playing')
    setScore(0)
  }, [initState])

  const handleKey = useCallback((e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault()
      if (phase === 'idle' || phase === 'dead') start()
      else jump()
    }
    if (e.code === 'Escape') onClose?.()
  }, [phase, jump, start, onClose])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  useEffect(() => {
    if (phase !== 'playing') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const loop = () => {
      const s = stateRef.current
      if (!s || s.dead) return

      s.tick++
      s.score = Math.floor(s.tick / 6)
      if (s.tick % 6 === 0) setScore(s.score)

      // speed ramp
      s.speed = 5 + Math.floor(s.score / 200) * 0.6

      // croco physics
      s.croco.vy += GRAVITY
      s.croco.y  += s.croco.vy
      if (s.croco.y >= GROUND) { s.croco.y = GROUND; s.croco.vy = 0; s.croco.onGround = true }

      // leg frame
      if (s.croco.onGround) s.frame++

      // clouds parallax
      s.clouds.forEach(c => { c.x -= 0.6; if (c.x < -80) c.x = W + 60 })

      // obstacles
      s.nextObsDist -= s.speed
      if (s.nextObsDist <= 0) {
        s.obstacles.push({ x: W, h: rand(OBS_MIN_H, OBS_MAX_H) })
        s.nextObsDist = rand(260, 480) - Math.min(s.score * 0.15, 120)
      }
      s.obstacles.forEach(o => { o.x -= s.speed })
      s.obstacles = s.obstacles.filter(o => o.x > -OBS_W)

      // collision (AABB with 5px shrink)
      const cx = s.croco.x + 5, cy = s.croco.y - CROCO_H + 5
      const cw = CROCO_W - 10, ch = CROCO_H - 10
      for (const o of s.obstacles) {
        const ox = o.x + 3, oy = GROUND - o.h, ow = OBS_W - 6, oh = o.h
        if (cx < ox + ow && cx + cw > ox && cy < oy + oh && cy + ch > oy) {
          s.dead = true
          setPhase('dead')
          const newHS = Math.max(s.score, highScore)
          setHighScore(newHS)
          if (newHS > highScore) {
            window.api?.settings?.update({ game: { highScore: newHS } }).catch(() => {})
          }
          break
        }
      }

      // draw
      ctx.clearRect(0, 0, W, H)
      drawGround(ctx)
      s.clouds.forEach(c => drawCloud(ctx, c.x, c.y))
      s.obstacles.forEach(o => drawCactus(ctx, o.x, GROUND + 30, o.h))
      drawCroco(ctx, s.croco.x, s.croco.y - CROCO_H + 30, s.frame)
      drawScore(ctx, s.score, highScore)

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase, highScore])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 14,
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, background: '#0b0f1a', cursor: 'pointer', display: 'block' }}
          onClick={() => { if (phase === 'idle' || phase === 'dead') start(); else jump() }}
        />

        {phase === 'idle' && (
          <Overlay>
            <div style={{ fontSize: 22, marginBottom: 4 }}>🐊</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Croco Run</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontFamily: 'Geist Mono, monospace' }}>SPACE or tap to start</div>
          </Overlay>
        )}

        {phase === 'dead' && (
          <Overlay>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginBottom: 3 }}>GAME OVER</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Geist Mono, monospace', marginBottom: 10 }}>
              {score >= highScore ? '🏆 New high score!' : `Score: ${score}`}
            </div>
            <button
              onClick={start}
              style={{ padding: '5px 16px', borderRadius: 6, border: 'none', background: '#4aff91', color: '#000', fontSize: 11, fontWeight: 700, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}>
              Restart
            </button>
          </Overlay>
        )}
      </div>

      <div style={{ display: 'flex', gap: 20, fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'Geist Mono, monospace' }}>
        <span>SPACE / ↑ jump</span>
        <span>ESC / click outside to close</span>
      </div>
    </div>
  )
}

function Overlay({ children }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', borderRadius: 12,
      background: 'rgba(11,15,26,0.78)',
    }}>
      {children}
    </div>
  )
}
