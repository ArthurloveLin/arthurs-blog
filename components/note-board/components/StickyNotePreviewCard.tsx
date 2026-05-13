'use client'

import gsap from 'gsap'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NoteContent } from '@/components/note-board/components/NoteContent'
import styles from '@/components/note-board/styles/StickyNote.module.css'
import type {
  NotePosition,
  Size,
  StickyNoteCardLinkAction,
} from '@/components/note-board/types'
import {
  clamp,
  PREVIEW_CARD_SIZE,
  sanitizeNotePosition,
  STICKY_COLORS,
} from '@/components/note-board/utils/board'
import { formatCommentTimeLabel } from '@/lib/date-format'
import type { NoteMessage } from '@/lib/note-boards'

interface StickyNotePreviewCardProps {
  message: Pick<NoteMessage, 'id' | 'author' | 'content' | 'created_at' | 'updated_at'>
  x: number
  y: number
  rotation: number
  zIndex: number
  width: number
  bounds: Size
  colorIndex: number
  draggable: boolean
  cta?: StickyNoteCardLinkAction
  animatePosition?: boolean
  onLift?: () => void
  onCommit?: (nextPosition: NotePosition, metrics: { distance: number }) => void
}

const RESTING_NOTE_SHADOW = '0 12px 18px -14px rgba(15, 23, 42, 0.22), inset 0 24px 30px -12px rgba(0, 0, 0, 0.26)'
const LIFTED_NOTE_SHADOW = '-1px 14px 40px -4px rgba(0, 0, 0, 0.12), inset 0 18px 24px -12px rgba(0, 0, 0, 0.22)'
const RELEASE_NOTE_SHADOW = '-1px 10px 5px -4px rgba(0, 0, 0, 0.2), inset 0 24px 30px -12px rgba(0, 0, 0, 0.3)'

export function StickyNotePreviewCard({
  message,
  x,
  y,
  rotation,
  zIndex,
  width,
  bounds,
  colorIndex,
  draggable,
  cta,
  animatePosition = true,
  onLift,
  onCommit,
}: StickyNotePreviewCardProps) {
  const visualRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)
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
  }, [])

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
      boxShadow: RESTING_NOTE_SHADOW,
    })
  }, [])

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
  }, [animatePosition, rotation])

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
        boxShadow: LIFTED_NOTE_SHADOW,
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
        boxShadow: LIFTED_NOTE_SHADOW,
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
        boxShadow: RELEASE_NOTE_SHADOW,
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
        boxShadow: RESTING_NOTE_SHADOW,
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

    const minX = 0
    const maxX = Math.max(bounds.width - width, 0)
    const minY = 0
    const maxY = Math.max(bounds.height - PREVIEW_CARD_SIZE, 0)
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
    releaseNoteAnimation(settledRotation)
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

  return (
    <article
      className={[
        'absolute touch-none select-none',
        styles.sticky,
        styles.paperFrame,
        styles.previewCard,
        isDragging ? styles.dragging : '',
      ].filter(Boolean).join(' ')}
      style={{
        width,
        zIndex: isDragging ? 999 : zIndex,
        transform: `translate3d(${activePosition.x}px, ${activePosition.y}px, 0)`,
        transition: isDragging
          ? 'none'
          : animatePosition
            ? 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1), filter 180ms ease'
            : 'none',
        cursor: draggable ? (isDragging ? 'grabbing' : 'grab') : 'default',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <div ref={visualRef} className={styles.noteSurface}>
        <div
          ref={paperRef}
          className={[styles.paper, styles.previewPaper].join(' ')}
          style={{
            backgroundColor: STICKY_COLORS[colorIndex % STICKY_COLORS.length],
          }}
        >
          <div className={styles.meta}>
            <div className={styles.metaCopy}>
              <p className={styles.author}>{message.author}</p>
              <p className={[styles.time, styles.metaTime, styles.timePreview].join(' ')}>
                {formatCommentTimeLabel(message.created_at, message.updated_at)}
              </p>
            </div>
            {cta ? (
              <div className={styles.actions}>
                <Link
                  href={cta.href}
                  aria-label={cta.label}
                  className={styles.iconLink}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <ArrowRight size={18} strokeWidth={1.85} />
                  <span className={styles.iconTooltip}>{cta.label}</span>
                </Link>
              </div>
            ) : null}
          </div>
          <NoteContent content={message.content} variant="preview" />
          <p className="text-[10px] font-bold tracking-widest text-slate-500/70">
            {formatCommentTimeLabel(message.created_at, message.updated_at)}
          </p>
        </div>
      </div>
    </article>
  )
}