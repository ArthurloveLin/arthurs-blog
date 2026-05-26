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
  getStickyColorSeed,
  MOBILE_COLLECT_STAGGER_MS,
  NOTE_CARD_WIDTH,
  PREVIEW_REVEAL_THRESHOLD,
} from '@/components/note-board/utils/board'
import { KNOWLEDGE_CARD_MOBILE_GUTTER, KNOWLEDGE_CARD_MOBILE_MAX_WIDTH } from '@/components/note-board/utils/knowledge-card'
import type { MemoHabitCurrentState } from '@/lib/memo-habits'

interface MobileStickyStackProps {
  items: NoteCardViewModel[]
  knowledgeMode?: boolean
  habitStatesByNote?: Record<string, Record<string, MemoHabitCurrentState>>
  onOpenHabitDetail?: (noteId: string, itemKey: string) => void
  onCompleteHabitItem?: (noteId: string, itemKey: string) => void
}

export function MobileStickyStack({ items, knowledgeMode = false, habitStatesByNote, onOpenHabitDetail, onCompleteHabitItem }: MobileStickyStackProps) {
  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const [parkedIds, setParkedIds] = useState<string[]>([])
  const [placedPositions, setPlacedPositions] = useState<Record<string, NotePosition>>({})
  const [isCollecting, setIsCollecting] = useState(false)
  const collectTimersRef = useRef<number[]>([])

  const cardWidth = knowledgeMode
    ? Math.min(KNOWLEDGE_CARD_MOBILE_MAX_WIDTH, Math.max(0, size.width - KNOWLEDGE_CARD_MOBILE_GUTTER))
    : Math.min(NOTE_CARD_WIDTH, Math.max(0, size.width - 32))
  const hasMeasured = size.width > 0 && size.height > 0
  const visibleItems = items
  const validParkedIds = useMemo(() => {
    const allowed = new Set(items.map((item) => item.message.id))
    return parkedIds.filter((id) => allowed.has(id))
  }, [parkedIds, items])

  const placedNotes = useMemo(() => {
    return Object.fromEntries(
      validParkedIds.map((id) => [id, placedPositions[id]]).filter(([, pos]) => pos)
    )
  }, [validParkedIds, placedPositions])

  const parkedSet = useMemo(() => new Set(validParkedIds), [validParkedIds])
  const parkedCount = validParkedIds.length

  useEffect(() => {
    return () => {
      collectTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  function parkMessage(messageId: string, index: number) {
    setPlacedPositions((current) => ({
      ...current,
      [messageId]: getMobileSideParkPosition(index % 2 === 0 ? 'right' : 'left', 18 + (index % 4) * 34, index, size, cardWidth, messageId),
    }))
    setParkedIds((current) => [...current, messageId])
  }

  function handleCommit(messageId: string, isDraggable: boolean, nextPosition: NotePosition, distance: number) {
    if (isCollecting || !isDraggable) return

    if (distance >= PREVIEW_REVEAL_THRESHOLD) {
      const releaseCenter = nextPosition.x + cardWidth / 2
      const parkSide = releaseCenter >= size.width / 2 ? 'right' : 'left'

      setPlacedPositions((current) => ({
        ...current,
        [messageId]: getMobileSideParkPosition(parkSide, nextPosition.y, parkedCount, size, cardWidth, messageId),
      }))
      setParkedIds((current) => [...current, messageId])
      return
    }

    setPlacedPositions((current) => {
      const next = { ...current }
      delete next[messageId]
      return next
    })
    setParkedIds((current) => current.filter((id) => id !== messageId))
  }

  function handleNext() {
    const activeItem = visibleItems.find((item) => !parkedSet.has(item.message.id))
    if (isCollecting || !activeItem) return
    parkMessage(activeItem.message.id, parkedCount)
  }

  function handlePrev() {
    if (isCollecting || validParkedIds.length === 0) return

    const lastParkedId = validParkedIds[validParkedIds.length - 1]
    if (!lastParkedId) return

    setParkedIds((current) => current.filter((id) => id !== lastParkedId))
    setPlacedPositions((current) => {
      const next = { ...current }
      delete next[lastParkedId]
      return next
    })
  }

  function handleCollect() {
    if (isCollecting || parkedCount === 0) return

    collectTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    collectTimersRef.current = []
    setIsCollecting(true)

    validParkedIds.forEach((id, index) => {
      const timer = window.setTimeout(() => {
        setParkedIds((current) => current.filter((pid) => pid !== id))
        setPlacedPositions((current) => {
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
    }, validParkedIds.length * MOBILE_COLLECT_STAGGER_MS + 520)

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
            {(() => {
              let unplacedCounter = 0
              return visibleItems.map((item, index) => {
                const { message, actions, priorityControl, isPriorityUpdating, canEdit, reactionControl, checklistControl, isOptimistic, isOptimisticEditing, isFresh } = item
                const placed = placedNotes[message.id]
                const isParked = parkedSet.has(message.id)
                const stackIndex = isParked ? -1 : unplacedCounter++
                
                const position = placed
                  ? placed
                  : getMobileStackPosition(Math.max(stackIndex, 0), size, cardWidth, message.id)

                const isDraggable = !isCollecting && stackIndex === 0
                const isHiddenBehindStack = !isParked && stackIndex >= 5

                return (
                  <div
                    key={message.id}
                    className="absolute left-0 top-0 h-0 w-0 overflow-visible"
                    style={{
                      opacity: isHiddenBehindStack ? 0 : 1,
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
                      colorIndex={getStickyColorIndex(getStickyColorSeed(message))}
                      draggable={isDraggable}
                      surface="mobile-stack"
                      actions={actions}
                      reactionControl={reactionControl}
                      checklistControl={checklistControl}
                      priorityControl={priorityControl ? {
                        ...priorityControl,
                        disabled: isPriorityUpdating || priorityControl.disabled || !canEdit,
                      } : undefined}
                      habitStates={habitStatesByNote?.[message.id]}
                      onOpenHabitDetail={onOpenHabitDetail}
                     onCompleteHabitItem={onCompleteHabitItem}
                     isOptimistic={isOptimistic}
                     isOptimisticEditing={isOptimisticEditing}
                     isFresh={isFresh}
                     onLift={() => {}}
                     onCommit={(nextPosition, metrics) => handleCommit(message.id, isDraggable, nextPosition, metrics.distance)}
                    />
                  </div>
                )
              })
            })()}
          </>
        )}
      </div>
      <div className="flex flex-col items-center gap-3">
        <span className="text-sm font-mono text-muted-foreground">
          {visibleItems.length === 0 ? 0 : Math.min(parkedCount + 1, visibleItems.length)} / {visibleItems.length}
        </span>
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={handlePrev}
            disabled={parkedCount === 0 || isCollecting}
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
            disabled={parkedCount >= visibleItems.length || isCollecting}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card text-foreground transition hover:bg-accent disabled:opacity-50"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}