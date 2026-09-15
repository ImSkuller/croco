import { useLayoutEffect, useRef } from 'react'

// Animates a parent's direct children smoothly sliding to their new
// positions whenever `side` changes (e.g. flipping a container between
// flex-direction 'row' and 'row-reverse' to move a panel from the left edge
// to the right). Neither `order` nor `flex-direction` is an animatable CSS
// property — the browser can't tween a discrete reflow like that — so this
// uses the classic FLIP technique instead: measure each child's position
// before the change, let React/CSS apply the new layout instantly, then
// measure again and animate away the resulting delta with a transform.
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
      kids.forEach((el, i) => {
        const old = oldRects[i]
        if (!old) return
        const now = el.getBoundingClientRect()
        const dx = old.left - now.left
        if (!dx) return
        el.style.transition = 'none'
        el.style.transform = `translateX(${dx}px)`
        // Force a reflow so the browser commits the "start" position above
        // before the transition below is applied — without this the two
        // style writes would get batched and the element would just snap
        // straight to its resting position with no animation at all.
        void el.offsetWidth
        el.style.transition = 'transform var(--transition-spring)'
        el.style.transform = ''
      })
    }

    prevSideRef.current = side
    prevRectsRef.current = kids.map(el => el.getBoundingClientRect())
  })
}
