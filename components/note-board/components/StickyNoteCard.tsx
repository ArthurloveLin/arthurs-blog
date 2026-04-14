'use client'

import { Archive, ArchiveRestore, ArrowRight, PencilLine, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { NoteActionButton } from '@/components/note-board/components/NoteActionButton'
import { NoteContent } from '@/components/note-board/components/NoteContent'
import { NoteEditor } from '@/components/note-board/components/NoteEditor'
import { PriorityPicker } from '@/components/note-board/components/PriorityPicker'
import styles from '@/components/note-board/styles/StickyNote.module.css'
import type { NotePosition, Size } from '@/components/note-board/types'
import {
  clamp,
  MOBILE_SIDE_PEEK_RATIO,
  PREVIEW_CARD_SIZE,
  sanitizeNotePosition,
  STICKY_COLORS,
} from '@/components/note-board/utils/board'
import { formatCommentTimeLabel } from '@/lib/date-format'
import { DEFAULT_NOTE_PRIORITY, NOTE_PRIORITY_META, type NotePriority } from '@/lib/note-priority'
import type { NoteMessage } from '@/lib/note-boards'

export interface StickyNoteCardProps {
  message: NoteMessage
  x: number
  y: number
  rotation: number
  zIndex: number
  width: number
  bounds: Size
  colorIndex: number
  draggable: boolean
  variant: 'preview' | 'board'
  showDelete?: boolean
  showEdit?: boolean
  showArchive?: boolean
  showPriority?: boolean
  priorityDisabled?: boolean
  ctaHref?: string
  ctaLabel?: string
  animatePosition?: boolean
  dragBoundsMode?: 'contained' | 'mobile-stack'
  isInlineEditing?: boolean
  inlineEditContent?: string
  isSavingInline?: boolean
  onDelete?: () => void
  onEdit?: () => void
  onToggleArchive?: () => void
  onPriorityChange?: (value: NotePriority) => void
  onLift?: () => void
  onCommit?: (nextPosition: NotePosition, metrics: { distance: number }) => void
  onHeightChange?: (height: number) => void
  onInlineEditChange?: (value: string) => void
  onInlineSave?: () => void
  onInlineCancel?: () => void
}

export function StickyNoteCard({
  message,
  x,
  y,
  rotation,
  zIndex,
  width,
  bounds,
  colorIndex,
  draggable,
  variant,
  showDelete = false,
  showEdit = false,
  showArchive = false,
  showPriority = false,
  priorityDisabled = false,
  ctaHref,
  ctaLabel,
  animatePosition = true,
  dragBoundsMode = 'contained',
  isInlineEditing = false,
  inlineEditContent = '',
  isSavingInline = false,
  onDelete,
  onEdit,
  onToggleArchive,
  onPriorityChange,
  onLift,
  onCommit,
  onHeightChange,
  onInlineEditChange,
  onInlineSave,
  onInlineCancel,
}: StickyNoteCardProps) {
  const articleRef = useRef<HTMLElement>(null)
  const dragOriginRef = useRef<NotePosition | null>(null)
  const dragPointerRef = useRef<{ startClientX: number; startClientY: number } | null>(null)
  const velocityRef = useRef({ lastClientX: 0, lastClientY: 0, lastTime: 0, velocityX: 0, velocityY: 0 })
  const frameRef = useRef<number | null>(null)
  const queuedDragPositionRef = useRef<NotePosition | null>(null)
  const latestDragPositionRef = useRef<NotePosition | null>(null)
  const measuredHeightRef = useRef(0)
  const [dragPosition, setDragPosition] = useState<NotePosition | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const isPreview = variant === 'preview'

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!onHeightChange || typeof ResizeObserver === 'undefined') return

    const element = articleRef.current
    if (!element) return

    const emitHeight = () => {
      const nextHeight = Math.ceil(element.offsetHeight)

      if (nextHeight <= 0 || nextHeight === measuredHeightRef.current) {
        return
      }

      measuredHeightRef.current = nextHeight
      onHeightChange(nextHeight)
    }

    emitHeight()

    const observer = new ResizeObserver(() => emitHeight())
    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [inlineEditContent, isInlineEditing, onHeightChange])

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

    const minX = dragBoundsMode === 'mobile-stack' ? -width * 0.72 : 0
    const maxX = dragBoundsMode === 'mobile-stack'
      ? Math.max(bounds.width - width * MOBILE_SIDE_PEEK_RATIO, minX)
      : Math.max(bounds.width - width, minX)
    const minY = dragBoundsMode === 'mobile-stack' ? -24 : 0
    const maxY = dragBoundsMode === 'mobile-stack'
      ? Math.max(bounds.height - 148, minY)
      : Math.max(bounds.height - (isPreview ? PREVIEW_CARD_SIZE : 200), minY)
    const nextX = clamp(dragOriginRef.current.x + deltaX, minX, maxX)
    const nextY = clamp(dragOriginRef.current.y + deltaY, minY, maxY)
    const nextRotation = dragOriginRef.current.rotation + clamp(deltaX * 0.016, -7, 7) + wobble * 0.42

    velocityRef.current = {
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      lastTime: event.timeStamp,
      velocityX,
      velocityY,
    }

    scheduleDragPosition({ x: nextX, y: nextY, rotation: nextRotation })
  }

  function commitDrag() {
    if (!dragOriginRef.current) return

    const origin = dragOriginRef.current
    const finalPosition = latestDragPositionRef.current ?? dragPosition ?? { x, y, rotation }
    const settledRotation = clamp(finalPosition.rotation + clamp(velocityRef.current.velocityX * -120, -7, 7) * 0.4, -18, 18)
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
      ref={articleRef}
      className={[
        'absolute touch-none select-none',
        styles.sticky,
        styles.paperFrame,
        isPreview ? styles.previewCard : '',
        isDragging ? styles.dragging : '',
      ].filter(Boolean).join(' ')}
      style={{
        width,
        zIndex: isDragging ? 999 : zIndex,
        transform: `translate3d(${activePosition.x}px, ${activePosition.y}px, 0) rotate(${activePosition.rotation}deg)`,
        transition: isDragging
          ? 'transform 140ms cubic-bezier(0.22, 1, 0.36, 1), filter 120ms ease'
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
      {showPriority && !isPreview ? (
        onPriorityChange ? (
          <PriorityPicker
            value={message.priority ?? DEFAULT_NOTE_PRIORITY}
            onChange={onPriorityChange}
            disabled={priorityDisabled}
            triggerVariant="tape"
            rootClassName={styles.tapeAnchor}
            buttonClassName={[styles.tapeButton, isDragging ? styles.tapeButtonDragging : ''].filter(Boolean).join(' ')}
            menuAlign="start"
            menuDirection="down"
          />
        ) : (
          <div
            className={[styles.tape, isDragging ? styles.tapeDragging : ''].join(' ')}
            style={{ backgroundColor: NOTE_PRIORITY_META[message.priority ?? DEFAULT_NOTE_PRIORITY].color }}
          />
        )
      ) : null}
      <div
        className={[styles.paper, isPreview ? styles.previewPaper : styles.boardPaper].join(' ')}
        style={{
          backgroundColor: STICKY_COLORS[colorIndex % STICKY_COLORS.length],
          transform: `translate3d(0, ${isDragging ? -6 : 0}px, 0) scale(${isDragging ? 1.03 : 1})`,
          boxShadow: isDragging
            ? '0 22px 42px -16px rgba(15, 23, 42, 0.28), inset 0 18px 24px -12px rgba(0, 0, 0, 0.22)'
            : '0 12px 18px -14px rgba(15, 23, 42, 0.22), inset 0 24px 30px -12px rgba(0, 0, 0, 0.26)',
        }}
      >
        <div className={styles.meta}>
          <div className={styles.metaCopy}>
            <p className={styles.author}>{message.author}</p>
            <p className={[styles.time, styles.metaTime, isPreview ? styles.timePreview : styles.timeBoard].join(' ')}>
              {formatCommentTimeLabel(message.created_at, message.updated_at)}
            </p>
          </div>
          <div className={styles.actions}>
            {ctaHref && ctaLabel ? (
              <Link
                href={ctaHref}
                aria-label={ctaLabel}
                className={styles.iconLink}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <ArrowRight size={18} strokeWidth={1.85} />
                <span className={styles.iconTooltip}>{ctaLabel}</span>
              </Link>
            ) : null}

            {showArchive && onToggleArchive ? (
              <NoteActionButton label={message.archived ? '取消归档' : '归档便签'} onClick={onToggleArchive}>
                {message.archived ? <ArchiveRestore size={16} strokeWidth={1.9} /> : <Archive size={16} strokeWidth={1.9} />}
              </NoteActionButton>
            ) : null}
            {showEdit && onEdit && !isPreview && !isInlineEditing ? (
              <NoteActionButton label="编辑便签" onClick={onEdit}>
                <PencilLine size={16} strokeWidth={1.9} />
              </NoteActionButton>
            ) : null}
            {showDelete && onDelete && !isInlineEditing ? (
              <NoteActionButton label="删除便签" onClick={onDelete}>
                <Trash2 size={16} strokeWidth={1.85} />
              </NoteActionButton>
            ) : null}
          </div>
        </div>
        {isInlineEditing ? (
          <div onPointerDown={(event) => event.stopPropagation()}>
            <NoteEditor
              value={inlineEditContent}
              onChange={onInlineEditChange ?? (() => {})}
              placeholder="直接修改这张便签的原始文本，checklist 状态也在这里编辑。"
              saveLabel="保存"
              isSaving={isSavingInline}
              onSave={onInlineSave ?? (() => {})}
              onCancel={onInlineCancel}
              saveDisabled={!inlineEditContent.trim()}
              maxLength={180}
              minHeightClassName="min-h-[80px]"
              shellClassName="overflow-hidden rounded-[14px] border border-black/10 bg-white/30"
              toolbarClassName="px-2 py-1.5 text-[10px] text-slate-700"
              buttonSize="sm"
              autoFocus
            />
          </div>
        ) : (
          <NoteContent content={message.content} variant={variant} />
        )}
      </div>
    </article>
  )
}