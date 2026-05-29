'use client'

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useRef } from 'react'
import { NoteContent } from '@/components/note-board/components/NoteContent'
import { useNoteColorTheme } from '@/components/note-board/contexts/NoteColorThemeContext'
import { useStickyNoteDrag } from '@/components/note-board/hooks/useStickyNoteDrag'
import styles from '@/components/note-board/styles/StickyNote.module.css'
import type {
  NotePosition,
  Size,
  StickyNoteCardLinkAction,
} from '@/components/note-board/types'
import {
  PREVIEW_CARD_SIZE,
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
  const { theme } = useNoteColorTheme()
  const noteSlot = theme.slots[colorIndex % theme.slots.length] ?? theme.slots[0]

  const { isDragging, activePosition, dragHandlers } = useStickyNoteDrag({
    visualRef,
    paperRef,
    x,
    y,
    rotation,
    draggable,
    animatePosition,
    shadows: {
      resting: RESTING_NOTE_SHADOW,
      lifted: LIFTED_NOTE_SHADOW,
      releaseEarly: RELEASE_NOTE_SHADOW,
      releaseSettle: RESTING_NOTE_SHADOW,
    },
    computeDragBounds: () => ({
      minX: 0,
      maxX: Math.max(bounds.width - width, 0),
      minY: 0,
      maxY: Math.max(bounds.height - PREVIEW_CARD_SIZE, 0),
    }),
    shouldReleaseOnCommit: () => true,
    onLift,
    onCommit,
  })

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
      {...dragHandlers}
    >
      <div ref={visualRef} className={styles.noteSurface}>
        <div
          ref={paperRef}
          className={[styles.paper, styles.previewPaper].join(' ')}
          style={{
            background: `linear-gradient(180deg, ${noteSlot.bg} 0%, ${noteSlot.bg} 72%, ${noteSlot.bg2} 100%)`,
            color: noteSlot.ink,
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
          <p className="text-[10px] font-bold tracking-widest" style={{ color: noteSlot.ink, opacity: 0.5 }}>
            {formatCommentTimeLabel(message.created_at, message.updated_at)}
          </p>
        </div>
      </div>
    </article>
  )
}
