import type { NoteBoardSlug } from '@/lib/note-board-config'
import type { NoteMessage } from '@/lib/note-boards'
import type { NotePosition, Size, OptimisticMessageSnapshot, NoteBoardListPayload } from '@/components/note-board/types'
import { type NoteSortDirection, type NoteSortMode } from '@/lib/note-priority'

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

export function getStickyColorSeed(message: Pick<NoteMessage, 'id' | 'visual_seed'>) {
  return message.visual_seed ?? message.id
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
  messageId?: string,
): NotePosition {
  const exposedWidth = cardWidth * MOBILE_SIDE_PEEK_RATIO
  const x = side === 'right' ? size.width - exposedWidth : exposedWidth - cardWidth
  const fallbackY = 18 + (index % 4) * 34
  const y = clamp(releaseY, 12, Math.max(size.height - 160, 12)) || fallbackY

  const jitter = messageId ? (seededUnit(messageId, 6) - 0.5) * 6 : (index % 3 - 1) * 2
  const baseRotation = side === 'right' ? 11 : -11

  return {
    x,
    y,
    rotation: baseRotation + jitter,
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
    const colorSeed = getStickyColorSeed(message)
    // Place card in the shortest column to fill gaps
    const col = columnHeights.indexOf(Math.min(...columnHeights))
    const cardHeight = getBoardCardHeight(message.id, measuredHeights)
    const xJitter = (seededUnit(colorSeed, 1) - 0.5) * 8
    const x = clamp(columnX[col] + xJitter, 0, maxX)

    layouts.push({
      x,
      y: columnHeights[col],
      rotation: getBoardRotation(colorSeed, absoluteIndex, col),
      zIndex: messages.length - absoluteIndex,
      colorIndex: getStickyColorIndex(colorSeed),
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

export function sortBoardMessages(
  messages: NoteMessage[],
  sortMode: NoteSortMode,
  sortDirection: NoteSortDirection = 'desc',
) {
  const directionFactor = sortDirection === 'asc' ? -1 : 1

  return [...messages].sort((left, right) => {
    const priorityDifference = (right.priority ?? 1) - (left.priority ?? 1)
    if (sortMode === 'priority' && priorityDifference !== 0) {
      return priorityDifference * directionFactor
    }

    const timeDifference = getMessageSortTimestamp(right) - getMessageSortTimestamp(left)
    if (timeDifference !== 0) {
      return timeDifference * directionFactor
    }

    if (right.created_at !== left.created_at) {
      return right.created_at.localeCompare(left.created_at) * directionFactor
    }

    return right.id.localeCompare(left.id) * directionFactor
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

export function applyOptimisticReactionToMessage(message: NoteMessage, nextReaction: 1 | -1 | 0) {
  let upvotes = message.upvotes
  let downvotes = message.downvotes

  if (message.viewer_reaction === 1) {
    upvotes = Math.max(0, upvotes - 1)
  } else if (message.viewer_reaction === -1) {
    downvotes = Math.max(0, downvotes - 1)
  }

  if (nextReaction === 1) {
    upvotes += 1
  } else if (nextReaction === -1) {
    downvotes += 1
  }

  return {
    ...message,
    upvotes,
    downvotes,
    viewer_reaction: nextReaction,
  }
}

export function applyOptimisticEmojiToMessage(message: NoteMessage, nextEmoji: string) {
  const viewerEmojiSet = new Set(message.viewer_emojis)
  const removingEmoji = viewerEmojiSet.has(nextEmoji)
  const summaryMap = new Map(message.emoji_reactions.map((entry) => [entry.emoji, { ...entry }]))

  if (removingEmoji) {
    viewerEmojiSet.delete(nextEmoji)
    const previous = summaryMap.get(nextEmoji)
    if (previous) {
      const nextCount = previous.count - 1
      if (nextCount > 0) {
        summaryMap.set(nextEmoji, { ...previous, count: nextCount, viewer: false })
      } else {
        summaryMap.delete(nextEmoji)
      }
    }
  } else {
    viewerEmojiSet.add(nextEmoji)
    const current = summaryMap.get(nextEmoji)
    summaryMap.set(nextEmoji, {
      emoji: nextEmoji,
      count: (current?.count ?? 0) + 1,
      viewer: true,
    })
  }

  return {
    ...message,
    viewer_emojis: [...viewerEmojiSet].sort((left, right) => left.localeCompare(right)),
    emoji_reactions: [...summaryMap.values()].sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count
      }

      if (left.viewer !== right.viewer) {
        return Number(right.viewer) - Number(left.viewer)
      }

      return left.emoji.localeCompare(right.emoji)
    }),
  }
}

export function createBoardPayload(
  messages: NoteMessage[],
  archived: boolean,
  sort: NoteSortMode,
  sortDirection: NoteSortDirection,
  nextOffset: number,
  hasMore: boolean,
): NoteBoardListPayload {
  return {
    messages,
    nextOffset,
    hasMore,
    archived,
    sort,
    sortDirection,
  }
}

export function isSameBoardSurfacePayload(
  payload: NoteBoardListPayload,
  messages: NoteMessage[],
  nextOffset: number,
  hasMore: boolean,
) {
  if (payload.nextOffset !== nextOffset || payload.hasMore !== hasMore) {
    return false
  }

  if (payload.messages.length !== messages.length) {
    return false
  }

  for (let index = 0; index < payload.messages.length; index += 1) {
    const left = payload.messages[index]
    const right = messages[index]

    if (
      left.id !== right.id ||
      left.author !== right.author ||
      left.content !== right.content ||
      left.created_at !== right.created_at ||
      left.updated_at !== right.updated_at ||
      left.priority !== right.priority ||
      left.archived !== right.archived ||
      left.parent_id !== right.parent_id ||
      left.upvotes !== right.upvotes ||
      left.downvotes !== right.downvotes ||
      left.viewer_reaction !== right.viewer_reaction ||
      left.viewer_emojis.length !== right.viewer_emojis.length ||
      left.emoji_reactions.length !== right.emoji_reactions.length
    ) {
      return false
    }

    for (let viewerEmojiIndex = 0; viewerEmojiIndex < left.viewer_emojis.length; viewerEmojiIndex += 1) {
      if (left.viewer_emojis[viewerEmojiIndex] !== right.viewer_emojis[viewerEmojiIndex]) {
        return false
      }
    }

    for (let emojiIndex = 0; emojiIndex < left.emoji_reactions.length; emojiIndex += 1) {
      const leftEmoji = left.emoji_reactions[emojiIndex]
      const rightEmoji = right.emoji_reactions[emojiIndex]

      if (
        leftEmoji.emoji !== rightEmoji.emoji ||
        leftEmoji.count !== rightEmoji.count ||
        leftEmoji.viewer !== rightEmoji.viewer
      ) {
        return false
      }
    }
  }

  return true
}

export function buildOptimisticSnapshot(
  id: string,
  messages: NoteMessage[],
  customPositions: Record<string, NotePosition>,
  cardZIndices: Record<string, number>,
): OptimisticMessageSnapshot | null {
  const index = messages.findIndex((message) => message.id === id)
  if (index === -1) return null

  return {
    message: messages[index],
    index,
    customPosition: customPositions[id],
    zIndex: cardZIndices[id],
  }
}

