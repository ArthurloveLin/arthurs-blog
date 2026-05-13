import type { NoteBoardSlug } from '@/lib/note-board-config'

export type NoteBoardViewMode = 'sticky' | 'stream'

export function normalizeNoteBoardViewMode(value: unknown): NoteBoardViewMode {
  return value === 'stream' ? 'stream' : 'sticky'
}

export function getNoteBoardViewModeStorageKey(board: NoteBoardSlug) {
  return `${board}-view-mode`
}

export function getNoteBoardViewModeCookieName(board: NoteBoardSlug) {
  return `note-board-view-mode-${board}`
}