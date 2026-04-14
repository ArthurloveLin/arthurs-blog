'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { StickyNoteCard } from '@/components/note-board/components/StickyNoteCard'
import { useElementSize } from '@/components/note-board/hooks/useElementSize'
import previewStyles from '@/components/note-board/styles/NoteBoardPreview.module.css'
import type { NotePosition } from '@/components/note-board/types'
import {
  clamp,
  getBoardHref,
  getStickyColorIndex,
  PREVIEW_CARD_SIZE,
  PREVIEW_REVEAL_THRESHOLD,
  PREVIEW_STACK_LIMIT,
  sanitizeNotePosition,
  seededUnit,
} from '@/components/note-board/utils/board'
import type { NoteBoardViewConfig } from '@/lib/note-board-config'
import type { NoteMessage } from '@/lib/note-boards'

interface StickyStackPreviewProps {
  board: NoteBoardViewConfig
  messages: NoteMessage[]
}

export function StickyStackPreview({ board, messages }: StickyStackPreviewProps) {
  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const visibleMessages = useMemo(
    () => messages.slice(0, Math.min(board.previewLimit, PREVIEW_STACK_LIMIT)),
    [messages, board.previewLimit],
  )
  const [revealedCount, setRevealedCount] = useState(0)
  const maxRevealedCount = Math.max(visibleMessages.length - 1, 0)
  const actualRevealedCount = Math.min(revealedCount, maxRevealedCount)

  const [placedNotesState, setPlacedNotes] = useState<Record<string, NotePosition>>({})
  const placedNotes = useMemo(() => {
    const allowed = new Set(visibleMessages.map((message) => message.id))
    return Object.fromEntries(
      Object.entries(placedNotesState)
        .filter(([id]) => allowed.has(id))
        .map(([id, position]) => [id, sanitizeNotePosition(position)]),
    )
  }, [placedNotesState, visibleMessages])

  const [hasSettledLayout, setHasSettledLayout] = useState(false)
  const [cardZIndices, setCardZIndices] = useState<Record<string, number>>({})
  const zIndexCounterRef = useRef(100)
  const cardWidth = PREVIEW_CARD_SIZE
  const stackX = Math.max(size.width - cardWidth - 28, 0)
  const stackY = Math.max(size.height - PREVIEW_CARD_SIZE - 36, 10)
  const boardHref = getBoardHref(board.slug)
  const hasMeasured = size.width > 0 && size.height > 0

  useEffect(() => {
    if (hasMeasured && !hasSettledLayout) {
      const timer = setTimeout(() => setHasSettledLayout(true), 300)
      return () => clearTimeout(timer)
    }
  }, [hasMeasured, hasSettledLayout])

  function handleCommit(index: number, message: NoteMessage, nextPosition: NotePosition, distance: number) {
    if (index === actualRevealedCount) {
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

  function bringToFront(id: string) {
    setCardZIndices((current) => ({ ...current, [id]: zIndexCounterRef.current++ }))
  }

  return (
    <div ref={containerRef} className={`${previewStyles.preview} transition-opacity duration-700 ease-out ${hasSettledLayout ? 'opacity-100' : 'opacity-0'}`}>
      {visibleMessages.length === 0 ? (
        <div className={previewStyles.empty}>
          <div className={previewStyles.emptyContent}>
            <p>{board.emptyLabel}</p>
            <Link href={boardHref} className={previewStyles.emptyLink}>
              {board.ctaLabel}
            </Link>
          </div>
        </div>
      ) : !hasMeasured ? null : (
        <>
          {visibleMessages.map((message, index) => {
            const placed = placedNotes[message.id]
            const stackDepth = Math.max(index - actualRevealedCount, 0)
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
            const isDraggable = index <= actualRevealedCount

            return (
              <StickyNoteCard.Preview
                key={message.id}
                message={message}
                x={position.x}
                y={position.y}
                rotation={position.rotation}
                zIndex={cardZIndices[message.id] ?? (placed ? visibleMessages.length + index + 4 : visibleMessages.length - index + 2)}
                width={cardWidth}
                bounds={{ width: size.width, height: size.height }}
                colorIndex={getStickyColorIndex(message.id)}
                draggable={isDraggable}
                cta={{ href: boardHref, label: board.ctaLabel }}
                animatePosition={hasSettledLayout}
                onLift={() => bringToFront(message.id)}
                onCommit={(nextPosition, metrics) => handleCommit(index, message, nextPosition, metrics.distance)}
              />
            )
          })}
        </>
      )}
    </div>
  )
}