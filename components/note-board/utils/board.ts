import type { NoteBoardSlug } from '@/lib/note-board-config'
import type { NoteMessage } from '@/lib/note-boards'
import type { NotePosition, Size } from '@/components/note-board/types'
import { type NoteSortMode } from '@/lib/note-priority'

export const STICKY_COLORS = ['#f8ef9f', '#ffd0a8', '#f8bfd3', '#c9eff3', '#d9ccff']
export const NOTE_CARD_WIDTH = 200
export const MOBILE_VIEWPORT_MAX_WIDTH = 767
export const PREVIEW_CARD_SIZE = 200
export const PREVIEW_STACK_LIMIT = 6
export const PREVIEW_REVEAL_THRESHOLD = 112
export const MOBILE_SIDE_PEEK_RATIO = 0.22
export const MOBILE_COLLECT_STAGGER_MS = 110
const DEFAULT_BOARD_CARD_HEIGHT = 212

function normalizeIdentities(identity: string | string[]) {
  return (Array.isArray(identity) ? identity : [identity]).filter(Boolean)
}

interface BoardLayoutCard {
  x: number
  y: number
  rotation: number
  zIndex: number
  colorIndex: number
}

function getBoardColumnCount(width: number) {
  return width >= 900 ? 4 : width >= 680 ? 3 : width >= 460 ? 2 : 1
}

function getBoardCardHeight(messageId: string, measuredHeights: Record<string, number>) {
  const measuredHeight = measuredHeights[messageId]

  if (!Number.isFinite(measuredHeight) || measuredHeight <= 0) {
    return DEFAULT_BOARD_CARD_HEIGHT
  }

  return measuredHeight
}

function getBoardRotation(messageId: string, index: number, column: number) {
  const baseSign = (index + column) % 2 === 0 ? -1 : 1
  const sign = seededUnit(messageId, 4) > 0.82 ? baseSign * -1 : baseSign
  const magnitude = 1.6 + seededUnit(messageId, 3) * 5.4

  return sign * magnitude
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function sanitizeNotePosition(position: NotePosition): NotePosition {
  return {
    x: Number.isFinite(position.x) ? position.x : 0,
    y: Number.isFinite(position.y) ? position.y : 0,
    rotation: Number.isFinite(position.rotation) ? position.rotation : 0,
  }
}

export function seededUnit(seed: string, salt: number) {
  let hash = salt * 374761393
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash ^ seed.charCodeAt(index)) * 668265263
  }

  const normalized = Math.sin(hash) * 43758.5453
  return normalized - Math.floor(normalized)
}

export function getStickyColorIndex(seed: string) {
  return Math.floor(seededUnit(seed, 7) * STICKY_COLORS.length)
}

export function getMobileStackPosition(stackIndex: number, size: Size, cardWidth: number, messageId: string): NotePosition {
  return {
    x: (size.width - cardWidth) / 2 + Math.min(stackIndex, 4) * 4,
    y: 40 + Math.min(stackIndex, 4) * 5,
    rotation: (seededUnit(messageId, 5) - 0.5) * 6,
  }
}

export function getMobileSideParkPosition(
  side: 'left' | 'right',
  releaseY: number,
  index: number,
  size: Size,
  cardWidth: number,
): NotePosition {
  const exposedWidth = cardWidth * MOBILE_SIDE_PEEK_RATIO
  const x = side === 'right' ? size.width - exposedWidth : exposedWidth - cardWidth
  const fallbackY = 18 + (index % 4) * 34
  const y = clamp(releaseY, 12, Math.max(size.height - 160, 12)) || fallbackY

  return {
    x,
    y,
    rotation: side === 'right' ? 11 : -11,
  }
}

export function computeBoardLayout(
  messages: NoteMessage[],
  width: number,
  measuredHeights: Record<string, number> = {},
) {
  const columns = getBoardColumnCount(width)
  const cardWidth = NOTE_CARD_WIDTH // Fixed 200px — same as hero preview
  const gapY = 34

  // Distribute columns with space-evenly: equal gaps between columns and on both sides
  const availableSpacing = Math.max(width - columns * cardWidth, 0)
  const gapX = columns > 0 ? availableSpacing / (columns + 1) : 0

  const maxX = Math.max(width - cardWidth, 0)
  const columnX = Array.from({ length: columns }, (_, i) =>
    clamp(gapX + i * (cardWidth + gapX), 0, maxX),
  )
  const topInset = 10

  // Masonry: track each column's current bottom Y independently
  const columnHeights = Array.from({ length: columns }, () => topInset)

  const layouts: BoardLayoutCard[] = []

  messages.forEach((message, absoluteIndex) => {
    // Place card in the shortest column to fill gaps
    const col = columnHeights.indexOf(Math.min(...columnHeights))
    const cardHeight = getBoardCardHeight(message.id, measuredHeights)
    const xJitter = (seededUnit(message.id, 1) - 0.5) * 8
    const x = clamp(columnX[col] + xJitter, 0, maxX)

    layouts.push({
      x,
      y: columnHeights[col],
      rotation: getBoardRotation(message.id, absoluteIndex, col),
      zIndex: messages.length - absoluteIndex,
      colorIndex: getStickyColorIndex(message.id),
    })

    columnHeights[col] += cardHeight + gapY
  })

  const bottomEdge = columns > 0 ? Math.max(...columnHeights) - gapY : 0
  const height = layouts.length === 0 ? 320 : Math.max(320, bottomEdge + 40)

  return { cardWidth, height, layouts }
}

function getMessageSortTimestamp(message: NoteMessage) {
  const parsed = Date.parse(message.updated_at ?? message.created_at)

  if (Number.isFinite(parsed)) {
    return parsed
  }

  const fallback = Date.parse(message.created_at)
  return Number.isFinite(fallback) ? fallback : 0
}

export function sortBoardMessages(messages: NoteMessage[], sortMode: NoteSortMode) {
  return [...messages].sort((left, right) => {
    if (sortMode === 'priority' && right.priority !== left.priority) {
      return right.priority - left.priority
    }

    const timeDifference = getMessageSortTimestamp(right) - getMessageSortTimestamp(left)
    if (timeDifference !== 0) {
      return timeDifference
    }

    if (right.created_at !== left.created_at) {
      return right.created_at.localeCompare(left.created_at)
    }

    return right.id.localeCompare(left.id)
  })
}

export function getDeletePermission(board: NoteBoardSlug, isAdmin: boolean, identity: string | string[], message: NoteMessage) {
  if (board === 'memo') return isAdmin

  const identities = normalizeIdentities(identity)
  return isAdmin || identities.includes(message.author)
}

export function getEditPermission(isAdmin: boolean, identity: string | string[], message: NoteMessage) {
  const identities = normalizeIdentities(identity)
  return isAdmin || identities.includes(message.author)
}

export function getBoardHref(board: NoteBoardSlug) {
  return board === 'memo' ? '/memo' : '/guestbook'
}
