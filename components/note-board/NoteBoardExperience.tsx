'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { formatCommentTimestamp } from '@/lib/date-format'
import type { NoteBoardSlug, NoteBoardViewConfig } from '@/lib/note-board-config'
import type { NoteMessage } from '@/lib/note-boards'

const STICKY_COLORS = ['#f8ef9f', '#ffd0a8', '#f8bfd3', '#c9eff3', '#d9ccff']
const PREVIEW_REVEAL_THRESHOLD = 112

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
  onDelete?: () => void
  onCommit?: (nextPosition: NotePosition, metrics: { distance: number }) => void
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
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
  if (width <= 0) return 228
  return clamp(width - 32, 196, 228)
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
    const y = row * (214 + gapY) + jitterY
    return { x, y, rotation, zIndex: messages.length - index, colorIndex: index }
  })

  const height = layouts.length === 0
    ? 320
    : Math.max(...layouts.map((layout) => layout.y)) + 260

  return { cardWidth, height, layouts }
}

function getDeletePermission(board: NoteBoardSlug, isAdmin: boolean, identity: string, message: NoteMessage) {
  if (board === 'memo') return isAdmin
  return isAdmin || (!!identity && identity === message.author)
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
  onDelete,
  onCommit,
}: StickyNoteCardProps) {
  const dragOriginRef = useRef<NotePosition | null>(null)
  const dragPointerRef = useRef<{ startClientX: number; startClientY: number } | null>(null)
  const [dragPosition, setDragPosition] = useState<NotePosition | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const activePosition = isDragging && dragPosition ? dragPosition : { x, y, rotation }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!draggable) return

    dragOriginRef.current = { x, y, rotation }
    dragPointerRef.current = { startClientX: event.clientX, startClientY: event.clientY }
    setIsDragging(true)
    setDragPosition({ x, y, rotation })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragOriginRef.current || !dragPointerRef.current || !isDragging) return

    const deltaX = event.clientX - dragPointerRef.current.startClientX
    const deltaY = event.clientY - dragPointerRef.current.startClientY
    const nextX = clamp(dragOriginRef.current.x + deltaX, 0, Math.max(bounds.width - width, 0))
    const nextY = clamp(dragOriginRef.current.y + deltaY, 0, Math.max(bounds.height - 180, 0))
    const nextRotation = dragOriginRef.current.rotation + clamp(deltaX * 0.03, -8, 8)

    setDragPosition({ x: nextX, y: nextY, rotation: nextRotation })
  }

  function commitDrag() {
    if (!dragOriginRef.current) return

    const origin = dragOriginRef.current
    const finalPosition = dragPosition ?? { x, y, rotation }
    const distance = Math.hypot(finalPosition.x - origin.x, finalPosition.y - origin.y)
    dragOriginRef.current = null
    dragPointerRef.current = null
    setIsDragging(false)
    setDragPosition(null)
    onCommit?.(finalPosition, { distance })
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
      className="note-board-sticky absolute touch-none select-none"
      style={{
        width,
        zIndex: isDragging ? 999 : zIndex,
        transform: `translate3d(${activePosition.x}px, ${activePosition.y}px, 0) rotate(${activePosition.rotation}deg) scale(${isDragging ? 1.03 : 1})`,
        transition: isDragging ? 'box-shadow 120ms ease, filter 120ms ease' : 'transform 460ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 160ms ease, filter 160ms ease',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      data-dragging={isDragging ? 'true' : 'false'}
    >
      <div className="note-board-sticky__pin" />
      <div
        className="note-board-sticky__paper"
        style={{ backgroundColor: STICKY_COLORS[colorIndex % STICKY_COLORS.length] }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700/70">{message.author}</p>
            {variant === 'board' ? (
              <p className="mt-1 text-[11px] text-slate-600/70">{formatCommentTimestamp(message.created_at)}</p>
            ) : null}
          </div>
          {showDelete && onDelete ? (
            <button
              type="button"
              className="rounded-full px-2 py-1 text-sm leading-none text-slate-600/60 transition hover:bg-black/6 hover:text-slate-900"
              onClick={(event) => {
                event.stopPropagation()
                onDelete()
              }}
            >
              ×
            </button>
          ) : null}
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-900/90">{message.content}</p>
        {variant === 'preview' ? (
          <p className="mt-4 text-[11px] text-slate-600/75">{formatCommentTimestamp(message.created_at)}</p>
        ) : null}
      </div>
    </article>
  )
}

export function StickyStackPreview({ board, messages }: StickyStackPreviewProps) {
  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const [revealedCount, setRevealedCount] = useState(0)
  const [placedNotes, setPlacedNotes] = useState<Record<string, NotePosition>>({})
  const visibleMessages = useMemo(() => messages.slice(0, board.previewLimit), [messages, board.previewLimit])
  const cardWidth = getCardWidth(size.width > 0 ? Math.min(size.width, 260) : 260)
  const stackX = Math.max(size.width - cardWidth - 26, 0)
  const stackY = 26

  function handleCommit(index: number, message: NoteMessage, nextPosition: NotePosition, distance: number) {
    if (index === revealedCount) {
      if (distance >= PREVIEW_REVEAL_THRESHOLD) {
        setPlacedNotes((current) => ({ ...current, [message.id]: nextPosition }))
        setRevealedCount((current) => Math.min(current + 1, visibleMessages.length))
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
    <div className="note-board-preview-shell">
      <div ref={containerRef} className="note-board-preview">
        {visibleMessages.length === 0 ? (
          <div className="note-board-preview__empty">{board.emptyLabel}</div>
        ) : (
          <>
            {visibleMessages.map((message, index) => {
              const placed = placedNotes[message.id]
              const stackIndex = Math.max(index - revealedCount, 0)
              const position = placed ?? {
                x: stackX - Math.min(stackIndex, 4) * 3,
                y: stackY + Math.min(stackIndex, 4) * 5,
                rotation: (seededUnit(message.id, 5) - 0.5) * 6,
              }

              return (
                <StickyNoteCard
                  key={message.id}
                  message={message}
                  x={position.x}
                  y={position.y}
                  rotation={position.rotation}
                  zIndex={visibleMessages.length - index}
                  width={cardWidth}
                  bounds={{ width: size.width, height: size.height }}
                  colorIndex={index}
                  draggable={index <= revealedCount}
                  variant="preview"
                  onCommit={(nextPosition, metrics) => handleCommit(index, message, nextPosition, metrics.distance)}
                />
              )
            })}
            <div className="note-board-preview__hint">
              <p>{board.heroHint}</p>
              <Link href={`/${board.slug}`} transitionTypes={['nav-forward']} className="note-board-preview__cta">
                {board.ctaLabel}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function NoteBoardPage({ board, initialMessages }: NoteBoardPageProps) {
  const { identity, isAdmin, loading } = useAuth()
  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const [messages, setMessages] = useState(initialMessages)
  const [customPositions, setCustomPositions] = useState<Record<string, NotePosition>>({})
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isScattered, setIsScattered] = useState(false)
  const [nextOffset, setNextOffset] = useState(initialMessages.length)
  const [hasMore, setHasMore] = useState(initialMessages.length >= board.initialPageLimit)
  const [isPending, startTransition] = useTransition()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const canWrite = board.slug === 'guestbook' || isAdmin
  const { cardWidth, height, layouts } = useMemo(() => computeBoardLayout(messages, size.width), [messages, size.width])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsScattered(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])

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
    setCustomPositions((current) => {
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
    <div className="space-y-8">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-[28px] border border-border/60 bg-card/70 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur-sm">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{board.title}</p>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">{board.intro}</p>
        </div>
        <div className="rounded-[28px] border border-border/60 bg-card/70 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur-sm">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Board Status</p>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {board.slug === 'guestbook'
              ? '公开留言板，任何访客都能留下便签。'
              : 'Memo 对外展示，但只有 admin 可以新增或删除便签。'}
          </p>
          <p className="mt-3 text-sm text-muted-foreground/80">当前已加载 {messages.length} 张便签。</p>
        </div>
      </section>

      <section className="space-y-6">
        <div
          ref={containerRef}
          className="note-board-canvas relative overflow-hidden rounded-[32px] border border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),rgba(248,250,252,0.88)_45%,rgba(241,245,249,0.92))] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]"
          style={{ minHeight: Math.max(height, 420) }}
        >
          {messages.length === 0 ? (
            <div className="flex min-h-[280px] items-center justify-center rounded-[24px] border border-dashed border-border/70 bg-white/55 text-center text-sm text-muted-foreground">
              {board.emptyLabel}
            </div>
          ) : (
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
                    zIndex={layout?.zIndex ?? messages.length - index}
                    width={cardWidth}
                    bounds={{ width: size.width, height: Math.max(height, 420) }}
                    colorIndex={layout?.colorIndex ?? index}
                    draggable={isScattered}
                    variant="board"
                    showDelete={getDeletePermission(board.slug, isAdmin, identity, message)}
                    onDelete={() => handleDelete(message.id)}
                    onCommit={(nextPosition) => {
                      setCustomPositions((current) => ({ ...current, [message.id]: nextPosition }))
                    }}
                  />
                )
              })}
            </div>
          )}
        </div>

        {hasMore ? (
          <div className="flex justify-center">
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

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-[28px] border border-border/60 bg-card/75 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.05)] backdrop-blur-sm">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Write</p>
          {canWrite ? (
            <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={180}
                placeholder={board.slug === 'guestbook' ? '写下想贴在主页上的留言。' : '写一条新的 Memo 便签。'}
                className="min-h-[140px] w-full rounded-[24px] border border-border/70 bg-background/70 px-4 py-4 text-sm leading-7 text-foreground outline-none transition placeholder:text-muted-foreground/45 focus:border-foreground/15 focus:ring-2 focus:ring-primary/12"
              />
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-muted-foreground">当前身份：{loading ? '加载中…' : identity}</p>
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
        </div>
        <div className="rounded-[28px] border border-border/60 bg-card/75 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.05)] backdrop-blur-sm">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Interaction</p>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            进入页面后，便签会从一叠纸张散开到当前时间顺序的位置。之后每张便签都可以继续拖拽到你想看的位置。
          </p>
        </div>
      </section>
    </div>
  )
}
