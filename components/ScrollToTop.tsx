'use client'

import { useLayoutEffect } from 'react'

/**
 * ScrollToTop
 * Resets scroll to the top synchronously on mount.
 *
 * Must run *before* the browser paints and before React's View Transition
 * captures the incoming snapshot. Otherwise the article is snapshotted while
 * still scrolled to the list's position, the shared cover is captured off-screen,
 * and the forward morph silently degrades to a fade (the bug that created this
 * component — commit ee83d5a). useLayoutEffect gives us that synchronous,
 * pre-paint timing.
 *
 * We deliberately do NOT defer a second scroll via setTimeout: it fires in a
 * later macrotask, after the snapshot is already taken, so it cannot fix a
 * degraded morph — it only risks a visible jump mid-transition.
 */
export default function ScrollToTop() {
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return null
}
