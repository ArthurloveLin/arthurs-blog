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

export function computeBoardLayout(messages: NoteMessage[], width: number) {
  const cardWidth = getCardWidth(width > 0 ? width / (width >= 1200 ? 4 : width >= 860 ? 3 : width >= 620 ? 2 : 1) : NOTE_CARD_WIDTH)
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
    const y = row * (220 + gapY) + jitterY
    return { x, y, rotation, zIndex: messages.length - index, colorIndex: getStickyColorIndex(message.id) }
  })

  const height = layouts.length === 0
    ? 320
    : Math.max(...layouts.map((layout) => layout.y)) + 248

  return { cardWidth, height, layouts }
}

export function getDeletePermission(board: NoteBoardSlug, isAdmin: boolean, identity: string, message: NoteMessage) {
  if (board === 'memo') return isAdmin
  return isAdmin || (!!identity && identity === message.author)
}

export function getEditPermission(isAdmin: boolean, identity: string, message: NoteMessage) {
  return isAdmin || (!!identity && identity === message.author)
}

export function getBoardHref(board: NoteBoardSlug) {
  return board === 'memo' ? '/memo' : '/guestbook'
}