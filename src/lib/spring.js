// A lightweight, dependency-free approximation of Apple-style spring
// motion. The Web Animations API (Element.animate()) has no native spring
// easing — only cubic-bezier/steps — so a single bezier curve was the best
// a CSS `transition` could do, and it reads as "eased", not "springy": no
// actual overshoot-and-settle, just a fast-then-slow curve. This instead
// simulates a real damped harmonic oscillator at a fixed timestep and bakes
// the samples into a keyframe list, the standard trick for getting true
// spring physics into something WAAPI can play back (it interpolates
// linearly between adjacent samples, which — sampled at 60fps — is
// indistinguishable from the continuous curve).
//
// Tuned to read as "Apple-ish": quick initial acceleration, a small
// overshoot past the target, one soft settle — not a bouncy toy.
export function springFrames(from, to, { stiffness = 320, damping = 26, mass = 1, precision = 0.4, maxDurationMs = 700, stepMs = 1000 / 60 } = {}) {
  let x = from
  let v = 0
  const dt = stepMs / 1000
  const frames = [x]
  let t = 0
  while (t < maxDurationMs) {
    const springForce = -stiffness * (x - to)
    const dampingForce = -damping * v
    const a = (springForce + dampingForce) / mass
    v += a * dt
    x += v * dt
    frames.push(x)
    t += stepMs
    if (Math.abs(x - to) < precision && Math.abs(v) < precision) break
  }
  frames.push(to)
  return { frames, durationMs: frames.length * stepMs }
}

export function prefersReducedMotion() {
  return document.documentElement.classList.contains('motion-reduced')
    || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}
