import { useLayoutEffect, useRef } from 'react'
import { springFrames, prefersReducedMotion } from '../lib/spring'

// Animates a parent's direct children smoothly sliding to their new
// positions whenever `side` changes (e.g. flipping a container between
// flex-direction 'row' and 'row-reverse' to move a panel from the left edge
// to the right). Neither `order` nor `flex-direction` is an animatable CSS
// property — the browser can't tween a discrete reflow like that — so this
// uses the classic FLIP technique instead: measure each child's position
// before the change, let React/CSS apply the new layout instantly, then
// animate away the resulting delta with a real spring (see lib/spring.js)
// via the Web Animations API rather than a single CSS transition curve —
// a plain cubic-bezier transition reads as "eased", not "springy" (no
// actual overshoot), which is the generic-not-Apple feeling a single-curve
// transition always has.
//
// `containerRef` must point at the flex container whose *direct children*
// should be treated as the panels to animate (their DOM order stays fixed —
// only CSS decides which edge each one renders at). `side` is any value
// whose identity change should trigger the flip (e.g. 'left'/'right').
export default function useSideSwapFlip(containerRef, side) {
  const prevSideRef = useRef(side)
  const prevRectsRef = useRef(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const kids = Array.from(container.children)

    if (prevSideRef.current !== side && prevRectsRef.current) {
      const oldRects = prevRectsRef.current
      const reduceMotion = prefersReducedMotion()
      kids.forEach((el, i) => {
        const old = oldRects[i]
        if (!old) return
        const now = el.getBoundingClientRect()
        const dx = old.left - now.left
        if (!dx) return
        // Cancel any in-flight flip on this element (e.g. the user toggled
        // twice in quick succession) so the new one starts clean instead of
        // fighting a still-running animation.
        el.getAnimations?.().forEach(a => a.cancel())
        if (reduceMotion) return // already at its resting position — no motion to play
        // The Natural style is explicitly "no bounce/overshoot, ever" (see
        // index.css) — a critically-damped spring (damping high enough
        // relative to stiffness) settles smoothly with zero overshoot,
        // instead of the gentle bounce every other Style gets.
        const natural = document.documentElement.classList.contains('style-natural')
        const { frames, durationMs } = springFrames(dx, 0, natural ? { damping: 40 } : undefined)
        el.animate(
          frames.map(x => ({ transform: `translateX(${x}px)` })),
          { duration: durationMs, easing: 'linear', fill: 'forwards' }
        )
      })
    }

    prevSideRef.current = side
    prevRectsRef.current = kids.map(el => el.getBoundingClientRect())
  })
}
