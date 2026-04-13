import type { NoteBoardSlug } from '@/lib/note-board-config'
import type { NoteMessage } from '@/lib/note-boards'
import type { NotePosition, Size } from '@/components/note-board/types'

export const STICKY_COLORS = ['#f8ef9f', '#ffd0a8', '#f8bfd3', '#c9eff3', '#d9ccff']
export const NOTE_CARD_WIDTH = 200
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
  return width >= 1200 ? 4 : width >= 860 ? 3 : width >= 620 ? 2 : 1
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

function getBoardRowLift(row: number, column: number, messageId: string) {
  const rowPattern = [0, 12, 4, 16]
  const baseLift = rowPattern[(row + column) % rowPattern.length] ?? 0
  const drift = seededUnit(messageId, 12) * 6

  return baseLift + drift
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

function getCardWidth(width: number) {
  if (width <= 0) return NOTE_CARD_WIDTH
  return clamp(width - 32, NOTE_CARD_WIDTH, NOTE_CARD_WIDTH)
}

export function computeBoardLayout(
  messages: NoteMessage[],
  width: number,
  measuredHeights: Record<string, number> = {},
) {
  const columns = getBoardColumnCount(width)
  const cardWidth = getCardWidth(width > 0 ? width / columns : NOTE_CARD_WIDTH)
  const gapX = columns > 1 ? 36 : 0
  const gapY = 34
  const usableWidth = Math.max(width, cardWidth)
  const totalWidth = columns * cardWidth + Math.max(columns - 1, 0) * gapX
  const leftInset = clamp((usableWidth - totalWidth) / 2, 0, Math.max(usableWidth - cardWidth, 0))
  const maxX = Math.max(width - cardWidth, 0)
  const columnX = Array.from({ length: columns }, (_, column) => (
    clamp(leftInset + column * (cardWidth + gapX), 0, maxX)
  ))
  const topInset = 10
  let nextRowTop = topInset

  const layouts: BoardLayoutCard[] = messages.map((message, index) => {
    const row = Math.floor(index / columns)
    const column = index % columns

    const cardHeight = getBoardCardHeight(message.id, measuredHeights)
    const xJitter = (seededUnit(message.id, 1) - 0.5) * 14
    const y = nextRowTop + getBoardRowLift(row, column, message.id)
    const x = clamp(columnX[column] + xJitter, 0, maxX)
    const rotation = getBoardRotation(message.id, index, column)

    if (column === columns - 1 || index === messages.length - 1) {
      const rowStart = row * columns
      const rowEnd = Math.min(rowStart + columns, messages.length)
      let rowBottom = nextRowTop

      for (let rowIndex = rowStart; rowIndex < rowEnd; rowIndex += 1) {
        const rowMessage = messages[rowIndex]
        const rowColumn = rowIndex % columns
        const rowCardHeight = getBoardCardHeight(rowMessage.id, measuredHeights)
        const rowY = nextRowTop + getBoardRowLift(row, rowColumn, rowMessage.id)
        rowBottom = Math.max(rowBottom, rowY + rowCardHeight)
      }

      nextRowTop = rowBottom + gapY
    }

    return {
      x,
      y,
      rotation,
      zIndex: messages.length - index,
      colorIndex: getStickyColorIndex(message.id),
    }
  })

  const bottomEdge = layouts.length === 0
    ? 0
    : Math.max(
        ...layouts.map((layout, index) => layout.y + getBoardCardHeight(messages[index].id, measuredHeights)),
      )
  const height = layouts.length === 0 ? 320 : Math.max(320, bottomEdge + 40)

  return { cardWidth, height, layouts }
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