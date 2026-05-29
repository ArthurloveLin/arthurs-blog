'use client'

import gsap from 'gsap'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { clamp, sanitizeNotePosition } from '@/components/note-board/utils/board'
import type { NotePosition } from '@/components/note-board/types'

/**
 * Shadow values used at each phase of the lift/release sequence. These differ
 * between the board card and the homepage preview card, so they are injected
 * rather than hardcoded.
 */
export interface StickyDragShadows {
  /** Applied immediately on mount (resting state). */
  resting: string
  /** Applied while the card is lifted (grab + the early frame of release). */
  lifted: string
  /** Box-shadow for the first (rotateX dip) tween of the release sequence. */
  releaseEarly: string
  /** Box-shadow for the settling (elastic) tween of the release sequence. */
  releaseSettle: string
}

interface DragBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

interface UseStickyNoteDragOptions {
  visualRef: RefObject<HTMLDivElement | null>
  paperRef: RefObject<HTMLDivElement | null>
  x: number
  y: number
  rotation: number
  draggable: boolean
  animatePosition: boolean
  shadows: StickyDragShadows
  /** Clamp range for the drag, computed from the current width/bounds/mode. */
  computeDragBounds: () => DragBounds
  /** Whether the release "settle" animation should play after a commit. */
  shouldReleaseOnCommit: (distance: number) => boolean
  onLift?: () => void
  onCommit?: (nextPosition: NotePosition, metrics: { distance: number }) => void
}

interface UseStickyNoteDragResult {
  isDragging: boolean
  activePosition: NotePosition
  dragHandlers: {
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void
    onPointerCancel: () => void
  }
}

/**
 * Encapsulates the sticky-note drag physics shared by the board card
 * (`StickyNoteCardFrame`) and the homepage preview card. Owns the GSAP
 * grab/release timelines, pointer tracking, velocity-based wobble, and the
 * rAF-batched position state. Behaviourally identical to the two inlined
 * copies it replaces — per-card differences (bounds, shadows, release rule)
 * are passed in via options.
 */
export function useStickyNoteDrag({
  visualRef,
  paperRef,
  x,
  y,
  rotation,
  draggable,
  animatePosition,
  shadows,
  computeDragBounds,
  shouldReleaseOnCommit,
  onLift,
  onCommit,
}: UseStickyNoteDragOptions): UseStickyNoteDragResult {
  const dragOriginRef = useRef<NotePosition | null>(null)
  const dragPointerRef = useRef<{ startClientX: number; startClientY: number } | null>(null)
  const velocityRef = useRef({ lastClientX: 0, lastClientY: 0, lastTime: 0, velocityX: 0, velocityY: 0 })
  const visualRotationRef = useRef(rotation)
  const frameRef = useRef<number | null>(null)
  const queuedDragPositionRef = useRef<NotePosition | null>(null)
  const latestDragPositionRef = useRef<NotePosition | null>(null)
  const [dragPosition, setDragPosition] = useState<NotePosition | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    const visual = visualRef.current
    const paper = paperRef.current

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
      }

      if (visual) {
        gsap.killTweensOf(visual)
      }

      if (paper) {
        gsap.killTweensOf(paper)
      }
    }
  }, [paperRef, visualRef])

  useLayoutEffect(() => {
    const visual = visualRef.current
    const paper = paperRef.current

    if (!visual || !paper) return

    gsap.set(visual, {
      rotateX: 5,
      scale: 1,
      y: 0,
      force3D: true,
      transformOrigin: '50% 50%',
    })
    gsap.set(paper, {
      boxShadow: shadows.resting,
    })
  }, [paperRef, visualRef, shadows.resting])

  useLayoutEffect(() => {
    if (dragOriginRef.current) return

    const visual = visualRef.current
    if (!visual) return

    gsap.killTweensOf(visual)
    visualRotationRef.current = rotation
    gsap.to(visual, {
      rotation,
      duration: animatePosition ? 0.52 : 0,
      ease: 'power3.out',
      overwrite: 'auto',
    })
  }, [animatePosition, rotation, visualRef])

  function scheduleDragPosition(nextPosition: NotePosition) {
    latestDragPositionRef.current = nextPosition
    queuedDragPositionRef.current = nextPosition

    if (frameRef.current !== null) return

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null

      if (!queuedDragPositionRef.current) return

      setDragPosition(queuedDragPositionRef.current)
      queuedDragPositionRef.current = null
    })
  }

  function grabNoteAnimation() {
    const visual = visualRef.current
    const paper = paperRef.current

    if (!visual || !paper) return

    gsap.killTweensOf(visual)
    gsap.killTweensOf(paper)

    const timeline = gsap.timeline()
    timeline
      .to(visual, {
        rotateX: 30,
        duration: 0.3,
      })
      .to(paper, {
        boxShadow: shadows.lifted,
        duration: 0.3,
      }, 0)
      .to(visual, {
        rotation: visualRotationRef.current,
        rotateX: 5,
        scale: 1.08,
        y: -6,
        ease: 'elastic.out(0.8, 0.5)',
        duration: 0.7,
      }, 0.15)
      .to(paper, {
        boxShadow: shadows.lifted,
        ease: 'elastic.out(0.8, 0.5)',
        duration: 0.7,
      }, 0.15)
  }

  function releaseNoteAnimation(targetRotation: number) {
    const visual = visualRef.current
    const paper = paperRef.current

    if (!visual || !paper) return

    visualRotationRef.current = targetRotation
    gsap.killTweensOf(visual)
    gsap.killTweensOf(paper)

    const timeline = gsap.timeline()
    timeline
      .to(visual, {
        rotateX: 30,
        duration: 0.24,
      })
      .to(paper, {
        boxShadow: shadows.releaseEarly,
        duration: 0.24,
      }, 0)
      .to(visual, {
        rotation: targetRotation,
        rotateX: 5,
        scale: 1,
        y: 0,
        ease: 'elastic.out(0.8, 0.5)',
        duration: 0.65,
      }, 0.18)
      .to(paper, {
        boxShadow: shadows.releaseSettle,
        ease: 'elastic.out(0.8, 0.5)',
        duration: 0.65,
      }, 0.18)
  }

  const activePosition = isDragging && dragPosition ? dragPosition : { x, y, rotation }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!draggable) return

    onLift?.()
    dragOriginRef.current = { x, y, rotation }
    dragPointerRef.current = { startClientX: event.clientX, startClientY: event.clientY }
    velocityRef.current = {
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      lastTime: event.timeStamp,
      velocityX: 0,
      velocityY: 0,
    }
    setIsDragging(true)
    latestDragPositionRef.current = { x, y, rotation }
    queuedDragPositionRef.current = null
    setDragPosition({ x, y, rotation })
    visualRotationRef.current = rotation
    grabNoteAnimation()
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragOriginRef.current || !dragPointerRef.current || !isDragging) return

    const deltaX = event.clientX - dragPointerRef.current.startClientX
    const deltaY = event.clientY - dragPointerRef.current.startClientY
    const elapsed = Math.max(event.timeStamp - velocityRef.current.lastTime, 16)
    const instantVelocityX = (event.clientX - velocityRef.current.lastClientX) / elapsed
    const instantVelocityY = (event.clientY - velocityRef.current.lastClientY) / elapsed
    const velocityX = velocityRef.current.velocityX * 0.32 + instantVelocityX * 0.68
    const velocityY = velocityRef.current.velocityY * 0.32 + instantVelocityY * 0.68
    const wobble = clamp(velocityX * -140, -9, 9)

    const { minX, maxX, minY, maxY } = computeDragBounds()
    const nextX = clamp(dragOriginRef.current.x + deltaX, minX, maxX)
    const nextY = clamp(dragOriginRef.current.y + deltaY, minY, maxY)
    const nextRotation = clamp(dragOriginRef.current.rotation + clamp(deltaX * 0.016, -7, 7) + wobble * 0.42, -18, 18)

    velocityRef.current = {
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      lastTime: event.timeStamp,
      velocityX,
      velocityY,
    }

    visualRotationRef.current = nextRotation

    if (visualRef.current) {
      gsap.to(visualRef.current, {
        rotation: nextRotation,
        duration: 0.5,
        ease: 'elastic.out(1.8, 0.6)',
        overwrite: 'auto',
      })
    }

    scheduleDragPosition({ x: nextX, y: nextY, rotation: nextRotation })
  }

  function commitDrag() {
    if (!dragOriginRef.current) return

    const origin = dragOriginRef.current
    const finalPosition = latestDragPositionRef.current ?? dragPosition ?? { x, y, rotation }
    const settledRotation = clamp(
      visualRotationRef.current + clamp(velocityRef.current.velocityX * -120, -7, 7) * 0.4,
      -18,
      18,
    )
    const nextPosition = sanitizeNotePosition({
      x: finalPosition.x,
      y: finalPosition.y,
      rotation: settledRotation,
    })
    const distance = Math.hypot(finalPosition.x - origin.x, finalPosition.y - origin.y)

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    dragOriginRef.current = null
    dragPointerRef.current = null
    velocityRef.current = { lastClientX: 0, lastClientY: 0, lastTime: 0, velocityX: 0, velocityY: 0 }
    if (shouldReleaseOnCommit(distance)) {
      releaseNoteAnimation(settledRotation)
    }
    latestDragPositionRef.current = null
    queuedDragPositionRef.current = null
    setIsDragging(false)
    setDragPosition(null)
    onCommit?.(nextPosition, { distance })
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!draggable) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    commitDrag()
  }

  function handlePointerCancel() {
    if (!draggable) return
    commitDrag()
  }

  return {
    isDragging,
    activePosition,
    dragHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
  }
}
