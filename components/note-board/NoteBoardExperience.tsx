'use client'

import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { formatCommentTimestamp } from '@/lib/date-format'
import type { NoteBoardSlug, NoteBoardViewConfig } from '@/lib/note-board-config'
import type { NoteMessage } from '@/lib/note-boards'

const STICKY_COLORS = ['#f8ef9f', '#ffd0a8', '#f8bfd3', '#c9eff3', '#d9ccff']
const NOTE_CARD_WIDTH = 184
const PREVIEW_CARD_SIZE = 184
const PREVIEW_STACK_LIMIT = 6
const PREVIEW_REVEAL_THRESHOLD = 112
const MOBILE_STACK_LIMIT = 4

interface Size {
  width: number
  height: number
}

interface NotePosition {
  x: number
  y: number
  rotation: number
}

interface NoteBoardPageProps {
  board: NoteBoardViewConfig
  initialMessages: NoteMessage[]
}

interface StickyStackPreviewProps {
  board: NoteBoardViewConfig
  messages: NoteMessage[]
}

interface MobileStickyDeckProps {
  board: NoteBoardViewConfig
  messages: NoteMessage[]
  activeIndex: number
  canGoPrevious: boolean
  canGoNext: boolean
  onPrevious: () => void
  onNext: () => void
  canDeleteMessage: (message: NoteMessage) => boolean
  onDeleteMessage: (id: string) => void
}

interface StickyNoteCardProps {
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
  ctaHref?: string
  ctaLabel?: string
  animatePosition?: boolean
  onDelete?: () => void
  onLift?: () => void
  onCommit?: (nextPosition: NotePosition, metrics: { distance: number }) => void
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function sanitizeNotePosition(position: NotePosition): NotePosition {
  return {
    x: Number.isFinite(position.x) ? position.x : 0,
    y: Number.isFinite(position.y) ? position.y : 0,
    rotation: Number.isFinite(position.rotation) ? position.rotation : 0,
  }
}

function seededUnit(seed: string, salt: number) {
  let hash = salt * 374761393
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash ^ seed.charCodeAt(index)) * 668265263
  }

  const normalized = Math.sin(hash) * 43758.5453
  return normalized - Math.floor(normalized)
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const update = () => {
      setSize({ width: element.clientWidth, height: element.clientHeight })
    }

    update()

    const observer = new ResizeObserver(update)
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return [ref, size] as const
}

function getCardWidth(width: number) {
  if (width <= 0) return NOTE_CARD_WIDTH
  return clamp(width - 32, NOTE_CARD_WIDTH, NOTE_CARD_WIDTH)
}

function computeBoardLayout(messages: NoteMessage[], width: number) {
  const cardWidth = getCardWidth(width > 0 ? width / (width >= 1200 ? 4 : width >= 860 ? 3 : width >= 620 ? 2 : 1) : 260)
  const columns = width >= 1200 ? 4 : width >= 860 ? 3 : width >= 620 ? 2 : 1
  const gapX = 26
  const gapY = 30
  const columnWidth = columns === 1 ? cardWidth : Math.max((width - gapX * (columns - 1)) / columns, cardWidth)

  const layouts = messages.map((message, index) => {
    const row = Math.floor(index / columns)
    const column = index % columns
    const jitterX = (seededUnit(message.id, 1) - 0.5) * 34
    const jitterY = (seededUnit(message.id, 2) - 0.5) * 24
    const rotation = (seededUnit(message.id, 3) - 0.5) * 12
    const x = clamp(column * (columnWidth + gapX) + jitterX, 0, Math.max(width - cardWidth, 0))
    const y = row * (204 + gapY) + jitterY
    return { x, y, rotation, zIndex: messages.length - index, colorIndex: index }
  })

  const height = layouts.length === 0
    ? 320
    : Math.max(...layouts.map((layout) => layout.y)) + 232

  return { cardWidth, height, layouts }
}

function getDeletePermission(board: NoteBoardSlug, isAdmin: boolean, identity: string, message: NoteMessage) {
  if (board === 'memo') return isAdmin
  return isAdmin || (!!identity && identity === message.author)
}

function getBoardHref(board: NoteBoardSlug) {
  return board === 'memo' ? '/memo' : '/guestbook'
}

function NoteListCard({
  message,
  showDelete,
  onDelete,
}: {
  message: NoteMessage
  showDelete: boolean
  onDelete?: () => void
}) {
  return (
    <article className="rounded-[24px] border border-border/60 bg-background/80 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.06)] sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{message.author}</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatCommentTimestamp(message.created_at)}</p>
        </div>
        {showDelete && onDelete ? (
          <button
            type="button"
            className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground transition hover:border-foreground/20 hover:bg-accent hover:text-foreground"
            onClick={onDelete}
          >
            删除
          </button>
        ) : null}
      </div>
      <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-foreground/90">{message.content}</p>
    </article>
  )
}

function StickyNoteCard({
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
  ctaHref,
  ctaLabel,
  animatePosition = true,
  onDelete,
  onLift,
  onCommit,
}: StickyNoteCardProps) {
  const dragOriginRef = useRef<NotePosition | null>(null)
  const dragPointerRef = useRef<{ startClientX: number; startClientY: number } | null>(null)
  const velocityRef = useRef({ lastClientX: 0, lastClientY: 0, lastTime: 0, velocityX: 0, velocityY: 0 })
  const frameRef = useRef<number | null>(null)
  const queuedDragPositionRef = useRef<NotePosition | null>(null)
  const latestDragPositionRef = useRef<NotePosition | null>(null)
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
    const nextX = clamp(dragOriginRef.current.x + deltaX, 0, Math.max(bounds.width - width, 0))
    const nextY = clamp(dragOriginRef.current.y + deltaY, 0, Math.max(bounds.height - (isPreview ? PREVIEW_CARD_SIZE : 180), 0))
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
      className={`note-board-sticky absolute touch-none select-none note-board-sticky--paper ${isPreview ? 'note-board-sticky--preview' : 'note-board-sticky--board'}`}
      style={{
        width,
        zIndex: isDragging ? 999 : zIndex,
        transform: isPreview
          ? `translate3d(${activePosition.x}px, ${activePosition.y}px, 0) rotate(${activePosition.rotation}deg)`
          : `translate3d(${activePosition.x}px, ${activePosition.y}px, 0) rotate(${activePosition.rotation}deg)`,
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
      data-dragging={isDragging ? 'true' : 'false'}
    >
      <div
        className={`note-board-sticky__paper ${isPreview ? 'note-board-sticky__paper--preview' : 'note-board-sticky__paper--board'}`}
        style={{
          backgroundColor: STICKY_COLORS[colorIndex % STICKY_COLORS.length],
          transform: `rotateX(${isDragging ? 24 : 5}deg) scale(${isDragging ? 1.08 : 1})`,
          boxShadow: isDragging
            ? '-1px 14px 40px -4px rgba(0, 0, 0, 0.16), inset 0 18px 24px -12px rgba(0, 0, 0, 0.28)'
            : '-1px 10px 5px -4px rgba(0, 0, 0, 0.12), inset 0 24px 30px -12px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div className="note-board-sticky__meta">
          <div>
            <p className="note-board-sticky__author">{message.author}</p>
            {variant === 'board' ? (
              <p className="note-board-sticky__time note-board-sticky__time--board">{formatCommentTimestamp(message.created_at)}</p>
            ) : null}
          </div>
          <div className="note-board-sticky__actions">
            {ctaHref && ctaLabel ? (
              <Link
                href={ctaHref}
                aria-label={ctaLabel}
                className="note-board-sticky__icon-link"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <ArrowRight size={18} strokeWidth={1.85} />
                <span className="note-board-sticky__icon-tooltip">{ctaLabel}</span>
              </Link>
            ) : null}
            {showDelete && onDelete ? (
              <button
                type="button"
                className="rounded-full px-2 py-1 text-sm leading-none text-slate-700/70 transition hover:bg-black/10 hover:text-slate-900"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  onDelete()
                }}
              >
                ×
              </button>
            ) : null}
          </div>
        </div>
        <p className={`note-board-sticky__text ${isPreview ? 'note-board-sticky__text--preview' : 'note-board-sticky__text--board'}`}>{message.content}</p>
        {variant === 'preview' ? (
          <p className="note-board-sticky__time">{formatCommentTimestamp(message.created_at)}</p>
        ) : null}
      </div>
    </article>
  )
}

export function StickyStackPreview({ board, messages }: StickyStackPreviewProps) {
  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const visibleMessages = useMemo(
    () => messages.slice(0, Math.min(board.previewLimit, PREVIEW_STACK_LIMIT)),
    [messages, board.previewLimit],
  )
  const [revealedCount, setRevealedCount] = useState(0)
  const [placedNotes, setPlacedNotes] = useState<Record<string, NotePosition>>({})
  const [cardZIndices, setCardZIndices] = useState<Record<string, number>>(() =>
    Object.fromEntries(visibleMessages.map((message, index) => [message.id, visibleMessages.length - index + 2])),
  )
  const zIndexCounterRef = useRef(visibleMessages.length + 6)
  const cardWidth = PREVIEW_CARD_SIZE
  const stackX = Math.max(size.width - cardWidth - 28, 0)
  const stackY = Math.max(size.height - PREVIEW_CARD_SIZE - 36, 10)
  const boardHref = getBoardHref(board.slug)
  const hasMeasured = size.width > 0 && size.height > 0
  const maxRevealedCount = Math.max(visibleMessages.length - 1, 0)
  const effectiveRevealedCount = Math.min(revealedCount, maxRevealedCount)
  const sanitizedPlacedNotes = useMemo(() => {
    const allowedIds = new Set(visibleMessages.map((message) => message.id))

    return Object.fromEntries(
      Object.entries(placedNotes)
        .filter(([id]) => allowedIds.has(id))
        .map(([id, position]) => [id, sanitizeNotePosition(position)]),
    )
  }, [placedNotes, visibleMessages])

  function bringCardToFront(id: string) {
    setCardZIndices((current) => ({ ...current, [id]: zIndexCounterRef.current++ }))
  }

  function handleCommit(index: number, message: NoteMessage, nextPosition: NotePosition, distance: number) {
    if (index === effectiveRevealedCount) {
      if (distance >= PREVIEW_REVEAL_THRESHOLD) {
        setPlacedNotes((current) => ({ ...current, [message.id]: nextPosition }))
        setRevealedCount((current) => Math.min(current + 1, maxRevealedCount))
        return
      }

      setPlacedNotes((current) => {
        const next = { ...current }
        delete next[message.id]
        return next
      })
      return
    }

    setPlacedNotes((current) => ({ ...current, [message.id]: nextPosition }))
  }

  return (
    <div ref={containerRef} className="note-board-preview">
      {visibleMessages.length === 0 ? (
        <div className="note-board-preview__empty">
          <div className="note-board-preview__empty-content">
            <p>{board.emptyLabel}</p>
            <Link href={boardHref} className="note-board-preview__empty-link">
              {board.ctaLabel}
            </Link>
          </div>
        </div>
      ) : !hasMeasured ? null : (
        <>
          {visibleMessages.map((message, index) => {
            const placed = sanitizedPlacedNotes[message.id]
            const stackDepth = Math.max(index - effectiveRevealedCount, 0)
            const position = placed
              ? {
                  x: clamp(placed.x, 0, Math.max(size.width - cardWidth, 0)),
                  y: clamp(placed.y, 0, Math.max(size.height - PREVIEW_CARD_SIZE, 0)),
                  rotation: placed.rotation,
                }
              : {
                  x: clamp(stackX - Math.min(stackDepth, 4) * 5, 0, Math.max(size.width - cardWidth, 0)),
                  y: clamp(stackY + Math.min(stackDepth, 4) * 6, 0, Math.max(size.height - PREVIEW_CARD_SIZE, 0)),
                   rotation: (seededUnit(message.id, 5) - 0.5) * 6,
                 }
            const isDraggable = index <= effectiveRevealedCount

            return (
              <StickyNoteCard
                key={message.id}
                message={message}
                x={position.x}
                y={position.y}
                rotation={position.rotation}
                zIndex={cardZIndices[message.id] ?? (placed ? visibleMessages.length + index + 4 : visibleMessages.length - index + 2)}
                width={cardWidth}
                bounds={{ width: size.width, height: size.height }}
                colorIndex={index}
                draggable={isDraggable}
                variant="preview"
                ctaHref={boardHref}
                ctaLabel={board.ctaLabel}
                animatePosition={hasMeasured}
                onLift={() => bringCardToFront(message.id)}
                onCommit={(nextPosition, metrics) => handleCommit(index, message, nextPosition, metrics.distance)}
              />
            )
          })}
        </>
      )}
    </div>
  )
}

function MobileStickyDeck({
  board,
  messages,
  activeIndex,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
  canDeleteMessage,
  onDeleteMessage,
}: MobileStickyDeckProps) {
  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const activeMessages = useMemo(
    () => messages.slice(activeIndex, activeIndex + MOBILE_STACK_LIMIT),
    [messages, activeIndex],
  )
  const cardWidth = clamp(size.width - 28, 216, 320)
  const stackX = Math.max((size.width - cardWidth) / 2, 0)
  const stackY = 18

  return (
    <div className="space-y-4 md:hidden">
      <div
        ref={containerRef}
        className="note-board-canvas relative overflow-hidden rounded-[28px] border border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),rgba(248,250,252,0.88)_45%,rgba(241,245,249,0.92))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]"
        style={{ minHeight: 320 }}
      >
        {messages.length === 0 ? (
          <div className="flex min-h-[240px] items-center justify-center rounded-[24px] border border-dashed border-border/70 bg-white/55 text-center text-sm text-muted-foreground">
            {board.emptyLabel}
          </div>
        ) : size.width <= 0 ? null : (
          <div className="relative min-h-[272px]">
            {activeMessages
              .slice()
              .reverse()
              .map((message, reverseIndex) => {
                const index = activeMessages.length - reverseIndex - 1
                const stackDepth = index

                return (
                  <StickyNoteCard
                    key={message.id}
                    message={message}
                    x={clamp(stackX - stackDepth * 5, 0, Math.max(size.width - cardWidth, 0))}
                    y={stackY + stackDepth * 6}
                    rotation={(seededUnit(message.id, 7) - 0.5) * 6}
                    zIndex={activeMessages.length - stackDepth + 2}
                    width={cardWidth}
                    bounds={{ width: size.width, height: 320 }}
                    colorIndex={activeIndex + index}
                    draggable={false}
                    variant="preview"
                    showDelete={index === 0 && canDeleteMessage(message)}
                    onDelete={index === 0 ? () => onDeleteMessage(message.id) : undefined}
                    animatePosition
                  />
                )
              })}
          </div>
        )}
      </div>

      {messages.length > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-[22px] border border-border/60 bg-card/75 px-4 py-3 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border/70 px-4 text-sm text-foreground transition hover:border-foreground/20 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-35"
            onClick={onPrevious}
            disabled={!canGoPrevious}
            aria-label="上一张便签"
          >
            <ChevronLeft size={16} />
            上一张
          </button>
          <p className="text-xs text-muted-foreground">
            {activeIndex + 1} / {messages.length}
          </p>
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border/70 px-4 text-sm text-foreground transition hover:border-foreground/20 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-35"
            onClick={onNext}
            disabled={!canGoNext}
            aria-label="下一张便签"
          >
            下一张
            <ChevronRight size={16} />
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function NoteBoardPage({ board, initialMessages }: NoteBoardPageProps) {
  const { identity, isAdmin, loading } = useAuth()
  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const [messages, setMessages] = useState(initialMessages)
  const [customPositions, setCustomPositions] = useState<Record<string, NotePosition>>({})
  const [cardZIndices, setCardZIndices] = useState<Record<string, number>>(() =>
    Object.fromEntries(initialMessages.map((message, index) => [message.id, initialMessages.length - index + 1])),
  )
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isScattered, setIsScattered] = useState(false)
  const [displayMode, setDisplayMode] = useState<'sticky' | 'list'>('sticky')
  const [mobileActiveIndex, setMobileActiveIndex] = useState(0)
  const [nextOffset, setNextOffset] = useState(initialMessages.length)
  const [hasMore, setHasMore] = useState(initialMessages.length >= board.initialPageLimit)
  const [isPending, startTransition] = useTransition()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const zIndexCounterRef = useRef(initialMessages.length + 2)
  const canWrite = board.slug === 'guestbook' || isAdmin
  const { cardWidth, height, layouts } = useMemo(() => computeBoardLayout(messages, size.width), [messages, size.width])
  const hasMeasured = size.width > 0 && size.height > 0
  const activeMobileIndex = clamp(mobileActiveIndex, 0, Math.max(messages.length - 1, 0))
  const showStickyBoard = displayMode === 'sticky'
  const showListBoard = displayMode === 'list'

  function canDeleteMessage(message: NoteMessage) {
    return getDeletePermission(board.slug, isAdmin, identity, message)
  }

  useEffect(() => {
    if (!hasMeasured) return

    const frame = window.requestAnimationFrame(() => setIsScattered(true))
    return () => window.cancelAnimationFrame(frame)
  }, [hasMeasured])

  useEffect(() => {
    setCardZIndices((current) => {
      const next: Record<string, number> = {}

      for (const message of messages) {
        next[message.id] = current[message.id] ?? zIndexCounterRef.current++
      }

      return next
    })
  }, [messages])

  function bringCardToFront(id: string) {
    setCardZIndices((current) => ({ ...current, [id]: zIndexCounterRef.current++ }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.trim() || !identity || !canWrite || isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/note-boards/${board.slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: identity, content: draft.trim() }),
      })

      if (!response.ok) {
        throw new Error(response.status === 403 ? '当前身份没有写入权限。' : '便签保存失败，请稍后再试。')
      }

      const message = (await response.json()) as NoteMessage
      setMessages((current) => [message, ...current])
      setNextOffset((current) => current + 1)
      setMobileActiveIndex(0)
      setDraft('')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '便签保存失败，请稍后再试。')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    const response = await fetch(`/api/note-boards/${board.slug}/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity }),
    })

    if (!response.ok) {
      setError(response.status === 403 ? '当前身份没有删除权限。' : '删除失败，请稍后重试。')
      return
    }

    setMessages((current) => current.filter((message) => message.id !== id))
    setMobileActiveIndex((current) => Math.max(Math.min(current, messages.length - 2), 0))
    setCustomPositions((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    setCardZIndices((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  async function handleLoadMore() {
    const response = await fetch(`/api/note-boards/${board.slug}?offset=${nextOffset}&limit=${board.pageSize}`)
    if (!response.ok) {
      setError('更多便签加载失败，请稍后重试。')
      return
    }

    const payload = await response.json() as { messages: NoteMessage[]; nextOffset: number; hasMore: boolean }
    startTransition(() => {
      setMessages((current) => [...current, ...payload.messages])
      setNextOffset(payload.nextOffset)
      setHasMore(payload.hasMore)
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-border/60 bg-card/75 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{board.title}</p>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
              {board.slug === 'guestbook'
                ? '拖动便签整理视线顺序，拿起和放下会带出更明显的纸张反馈。'
                : 'Memo 维持相同的便签交互，公开展示但仅 admin 可维护内容。'}
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 sm:block">
            <p className="text-xs text-muted-foreground/80">当前已加载 {messages.length} 张便签</p>
            <div className="mt-3 inline-flex rounded-full border border-border/70 bg-background/70 p-1">
              <button
                type="button"
                className={`rounded-full px-3 py-1.5 text-xs transition ${showStickyBoard ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setDisplayMode('sticky')}
              >
                便签视图
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1.5 text-xs transition ${showListBoard ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setDisplayMode('list')}
              >
                列表视图
              </button>
            </div>
          </div>
        </div>

        {showStickyBoard ? (
          <MobileStickyDeck
            board={board}
            messages={messages}
            activeIndex={activeMobileIndex}
            canGoPrevious={activeMobileIndex > 0}
            canGoNext={activeMobileIndex < messages.length - 1}
            onPrevious={() => setMobileActiveIndex((current) => Math.max(current - 1, 0))}
            onNext={() => setMobileActiveIndex((current) => Math.min(current + 1, Math.max(messages.length - 1, 0)))}
            canDeleteMessage={canDeleteMessage}
            onDeleteMessage={handleDelete}
          />
        ) : null}

        {showStickyBoard ? (
          <div className="hidden md:block">
            <div
              ref={containerRef}
              className="note-board-canvas relative overflow-hidden rounded-[28px] border border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),rgba(248,250,252,0.88)_45%,rgba(241,245,249,0.92))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] sm:p-6"
              style={{ minHeight: Math.max(height, 420) }}
            >
              {messages.length === 0 ? (
                <div className="flex min-h-[280px] items-center justify-center rounded-[24px] border border-dashed border-border/70 bg-white/55 text-center text-sm text-muted-foreground">
                  {board.emptyLabel}
                </div>
              ) : !hasMeasured ? null : (
                <div className="relative" style={{ minHeight: Math.max(height, 320) }}>
                  {messages.map((message, index) => {
                    const layout = layouts[index]
                    const fallbackX = Math.max((size.width - cardWidth) / 2, 0) + Math.min(index, 4) * 2
                    const fallbackY = 22 + Math.min(index, 4) * 4
                    const custom = customPositions[message.id]
                    const position = custom ?? {
                      x: isScattered ? layout?.x ?? fallbackX : fallbackX,
                      y: isScattered ? layout?.y ?? fallbackY : fallbackY,
                      rotation: isScattered ? layout?.rotation ?? 0 : (index % 2 === 0 ? -2 : 2),
                    }

                    return (
                      <StickyNoteCard
                        key={message.id}
                        message={message}
                        x={position.x}
                        y={position.y}
                        rotation={position.rotation}
                        zIndex={cardZIndices[message.id] ?? layout?.zIndex ?? messages.length - index}
                        width={cardWidth}
                        bounds={{ width: size.width, height: Math.max(height, 420) }}
                        colorIndex={layout?.colorIndex ?? index}
                        draggable={isScattered}
                        variant="board"
                        showDelete={canDeleteMessage(message)}
                        onDelete={() => handleDelete(message.id)}
                        onLift={() => bringCardToFront(message.id)}
                        onCommit={(nextPosition) => {
                          setCustomPositions((current) => ({ ...current, [message.id]: nextPosition }))
                        }}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {showListBoard ? (
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-border/70 bg-background/55 px-4 py-8 text-center text-sm text-muted-foreground">
                {board.emptyLabel}
              </div>
            ) : (
              messages.map((message) => (
                <NoteListCard
                  key={message.id}
                  message={message}
                  showDelete={canDeleteMessage(message)}
                  onDelete={() => handleDelete(message.id)}
                />
              ))
            )}
          </div>
        ) : null}

        {hasMore ? (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              className="rounded-full border border-border/70 bg-card px-5 py-2 text-sm text-foreground transition hover:border-foreground/20 hover:bg-accent"
              onClick={handleLoadMore}
              disabled={isPending}
            >
              {isPending ? '正在展开更多便签…' : '加载更多便签'}
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-[28px] border border-border/60 bg-card/75 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.05)] backdrop-blur-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {board.slug === 'guestbook' ? '留言区' : 'Memo 编辑区'}
            </p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {board.slug === 'guestbook'
                ? '任何访客都可以写一张新的便签。'
                : '页面对外公开，但只有 admin 可以新增或删除 Memo。'}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">当前身份：{loading ? '加载中…' : identity}</p>
        </div>

        {canWrite ? (
          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={180}
              placeholder={board.slug === 'guestbook' ? '写下想贴在主页上的留言。' : '写一条新的 Memo 便签。'}
              className="min-h-[140px] w-full rounded-[24px] border border-border/70 bg-background/70 px-4 py-4 text-sm leading-7 text-foreground outline-none transition placeholder:text-muted-foreground/45 focus:border-foreground/15 focus:ring-2 focus:ring-primary/12"
            />
            <div className="flex items-center justify-end gap-4">
              <button
                type="submit"
                disabled={isSubmitting || !draft.trim()}
                className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {isSubmitting ? '保存中…' : '贴上便签'}
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-4 text-sm leading-7 text-muted-foreground">这个页面当前为只读模式，只有 admin 可以维护 Memo 内容。</p>
        )}
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </section>
    </div>
  )
}
