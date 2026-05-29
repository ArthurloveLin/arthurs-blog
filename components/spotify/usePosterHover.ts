'use client'

import gsap from 'gsap'
import { useEffect, useRef } from 'react'

const RESTING_SHADOW =
  '0 14px 22px -10px rgba(15, 10, 0, 0.28), inset 0 20px 28px -10px rgba(0, 0, 0, 0.22)'
const LIFTED_SHADOW =
  '-2px 22px 48px -6px rgba(0, 0, 0, 0.2), inset 0 16px 22px -10px rgba(0, 0, 0, 0.18)'

/**
 * Shared "pinned paper" hover animation for poster cards. Tilts the surface on
 * a 3D axis, lifts it with an elastic settle, and cross-fades the drop shadow.
 * Owns the surface/paper refs plus the resting-rotation init and unmount
 * cleanup, so consumers only attach the refs and the two handlers.
 */
export function usePosterHover(restRotation: number) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)

  // Initialise resting rotation.
  useEffect(() => {
    if (!surfaceRef.current) return
    gsap.set(surfaceRef.current, { rotation: restRotation })
  }, [restRotation])

  // Kill any in-flight tweens if the card unmounts mid-hover.
  useEffect(() => {
    const surface = surfaceRef.current
    const paper = paperRef.current

    return () => {
      if (surface) gsap.killTweensOf(surface)
      if (paper) gsap.killTweensOf(paper)
    }
  }, [])

  function handleMouseEnter() {
    const surface = surfaceRef.current
    const paper = paperRef.current
    if (!surface || !paper) return

    gsap.killTweensOf(surface)
    gsap.killTweensOf(paper)

    const tl = gsap.timeline()
    tl.to(surface, { rotateX: 6, duration: 0.22 })
      .to(paper, { boxShadow: LIFTED_SHADOW, duration: 0.22 }, 0)
      .to(
        surface,
        {
          rotation: restRotation * 0.25,
          rotateX: 4,
          scale: 1.04,
          y: -8,
          ease: 'elastic.out(0.75, 0.5)',
          duration: 0.65,
        },
        0.14
      )
      .to(paper, { boxShadow: LIFTED_SHADOW, ease: 'elastic.out(0.75, 0.5)', duration: 0.65 }, 0.14)
  }

  function handleMouseLeave() {
    const surface = surfaceRef.current
    const paper = paperRef.current
    if (!surface || !paper) return

    gsap.killTweensOf(surface)
    gsap.killTweensOf(paper)

    const tl = gsap.timeline()
    tl.to(surface, { rotateX: 12, duration: 0.18 })
      .to(paper, { boxShadow: RESTING_SHADOW, duration: 0.18 }, 0)
      .to(
        surface,
        {
          rotation: restRotation,
          rotateX: 0,
          scale: 1,
          y: 0,
          ease: 'elastic.out(0.8, 0.5)',
          duration: 0.6,
        },
        0.12
      )
      .to(paper, { boxShadow: RESTING_SHADOW, ease: 'elastic.out(0.8, 0.5)', duration: 0.6 }, 0.12)
  }

  return { surfaceRef, paperRef, handleMouseEnter, handleMouseLeave }
}
