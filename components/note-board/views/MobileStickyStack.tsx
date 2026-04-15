'use client'

import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { StickyNoteCard } from '@/components/note-board/components/StickyNoteCard'
import { useElementSize } from '@/components/note-board/hooks/useElementSize'
import type { NoteCardViewModel, NotePosition } from '@/components/note-board/types'
import {
  getMobileSideParkPosition,
  getMobileStackPosition,
  getStickyColorIndex,
  MOBILE_COLLECT_STAGGER_MS,
  NOTE_CARD_WIDTH,
  PREVIEW_REVEAL_THRESHOLD,
} from '@/components/note-board/utils/board'

interface MobileStickyStackProps {
  items: NoteCardViewModel[]
}

export function MobileStickyStack({ items }: MobileStickyStackProps) {
  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const [revealedCount, setRevealedCount] = useState(0)
  const [placedNotesState, setPlacedNotes] = useState<Record<string, NotePosition>>({})
  const [isCollecting, setIsCollecting] = useState(false)
  const collectTimersRef = useRef<number[]>([])

  const cardWidth = Math.min(NOTE_CARD_WIDTH, Math.max(0, size.width - 32))
  const hasMeasured = size.width > 0 && size.height > 0
  const visibleItems = useMemo(() => items.map((item) => item), [items])
  const placedNotes = useMemo(() => {
    const allowed = new Set(visibleItems.map((item) => item.message.id))
    return Object.fromEntries(Object.entries(placedNotesState).filter(([id]) => allowed.has(id)))
  }, [placedNotesState, visibleItems])
  const activeRevealedCount = Math.min(revealedCount, visibleItems.length)
  const parkedCount = Object.keys(placedNotes).length

  useEffect(() => {
    return () => {
      collectTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  function parkMessageAt(index: number) {
    const item = visibleItems[index]
    if (!item) return

    setPlacedNotes((current) => ({
      ...current,
      [item.message.id]: getMobileSideParkPosition(index % 2 === 0 ? 'right' : 'left', 18 + (index % 4) * 34, index, size, cardWidth),
    }))
  }

  function handleCommit(index: number, messageId: string, nextPosition: NotePosition, distance: number) {
    if (isCollecting || index !== activeRevealedCount) return

    if (distance >= PREVIEW_REVEAL_THRESHOLD) {
      const releaseCenter = nextPosition.x + cardWidth / 2
      const parkSide = releaseCenter >= size.width / 2 ? 'right' : 'left'

      setPlacedNotes((current) => ({
        ...current,
        [messageId]: getMobileSideParkPosition(parkSide, nextPosition.y, index, size, cardWidth),
      }))
      setRevealedCount((current) => Math.min(current + 1, visibleItems.length))
      return
    }

    setPlacedNotes((current) => {
      const next = { ...current }
      delete next[messageId]
      return next
    })
  }

  function handleNext() {
    if (isCollecting || activeRevealedCount >= visibleItems.length) return
    parkMessageAt(activeRevealedCount)
    setRevealedCount((current) => Math.min(current + 1, visibleItems.length))
  }

  function handlePrev() {
    if (isCollecting || activeRevealedCount <= 0) return

    const previousIndex = activeRevealedCount - 1
    const previousItem = visibleItems[previousIndex]
    if (!previousItem) return

    setPlacedNotes((current) => {
      const next = { ...current }
      delete next[previousItem.message.id]
      return next
    })
    setRevealedCount(previousIndex)
  }

  function handleCollect() {
    if (isCollecting || parkedCount === 0) return

    collectTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    collectTimersRef.current = []
    setIsCollecting(true)
    setRevealedCount(0)

    const idsInOriginalOrder = visibleItems
      .map((item) => item.message.id)
      .filter((id) => id in placedNotes)

    idsInOriginalOrder.forEach((id, index) => {
      const timer = window.setTimeout(() => {
        setPlacedNotes((current) => {
          const next = { ...current }
          delete next[id]
          return next
        })
      }, index * MOBILE_COLLECT_STAGGER_MS)

      collectTimersRef.current.push(timer)
    })

    const doneTimer = window.setTimeout(() => {
      setIsCollecting(false)
      collectTimersRef.current = []
    }, idsInOriginalOrder.length * MOBILE_COLLECT_STAGGER_MS + 520)

    collectTimersRef.current.push(doneTimer)
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-[24px] border border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),rgba(248,250,252,0.88)_45%,rgba(241,245,249,0.92))] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]"
        style={{ height: 380 }}
      >
        {!hasMeasured ? null : (
          <>
            {visibleItems.map((item, index) => {
              const { message, actions, priorityControl, isPriorityUpdating, canEdit, reactionControl, isOptimistic, isFresh } = item
              const stackIndex = index - activeRevealedCount
              const placed = placedNotes[message.id]
              const position = placed
                ? placed
                : getMobileStackPosition(Math.max(stackIndex, 0), size, cardWidth, message.id)

              const isDraggable = !isCollecting && index === activeRevealedCount && activeRevealedCount < visibleItems.length
              const isPastWithoutPlacement = index < activeRevealedCount && !placed
              const isHiddenBehindStack = !placed && stackIndex >= 5

              return (
                <div
                  key={message.id}
                  className="absolute left-0 top-0 h-0 w-0 overflow-visible"
                  style={{
                    opacity: isPastWithoutPlacement || isHiddenBehindStack ? 0 : 1,
                    transition: 'opacity 300ms ease',
                    pointerEvents: isDraggable ? 'auto' : 'none',
                    zIndex: placed ? 30 + index : visibleItems.length - index + 2,
                  }}
                >
                  <StickyNoteCard.Board
                    message={message}
                    x={position.x}
                    y={position.y}
                    rotation={position.rotation}
                    zIndex={placed ? 30 + index : visibleItems.length - index + 2}
                    width={cardWidth}
                    bounds={{ width: size.width, height: size.height }}
                    colorIndex={getStickyColorIndex(message.id)}
                    draggable={isDraggable}
                    surface="mobile-stack"
                    actions={actions}
                    reactionControl={reactionControl}
                    priorityControl={priorityControl ? {
                      ...priorityControl,
                      disabled: isPriorityUpdating || priorityControl.disabled || !canEdit,
                    } : undefined}
                    isOptimistic={isOptimistic}
                    isFresh={isFresh}
                    onLift={() => {}}
                    onCommit={(nextPosition, metrics) => handleCommit(index, message.id, nextPosition, metrics.distance)}
                  />
                </div>
              )
            })}
          </>
        )}
      </div>
      <div className="flex flex-col items-center gap-3">
        <span className="text-sm font-mono text-muted-foreground">
          {visibleItems.length === 0 ? 0 : Math.min(activeRevealedCount + 1, visibleItems.length)} / {visibleItems.length}
        </span>
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={handlePrev}
            disabled={activeRevealedCount === 0 || isCollecting}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card text-foreground transition hover:bg-accent disabled:opacity-50"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={handleCollect}
            disabled={parkedCount === 0 || isCollecting}
            className="flex h-10 items-center justify-center gap-2 rounded-full border border-border/70 bg-card px-4 text-xs font-medium text-foreground transition hover:bg-accent disabled:opacity-50"
          >
            <RotateCcw size={14} />
            归位
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={activeRevealedCount >= visibleItems.length || isCollecting}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card text-foreground transition hover:bg-accent disabled:opacity-50"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}