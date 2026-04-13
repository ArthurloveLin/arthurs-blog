import type { NoteMessage } from '@/lib/note-boards'

export interface Size {
  width: number
  height: number
}

export interface NotePosition {
  x: number
  y: number
  rotation: number
}

export interface ChecklistItemDraft {
  id: string
  text: string
  checked: boolean
  lineIndex?: number
}

export interface TextSelectionRange {
  start: number
  end: number
}

export interface TextEditResult {
  value: string
  selection: TextSelectionRange
}

export interface ToastNotice {
  id: number
  message: string
}

export interface OptimisticMessageSnapshot {
  message: NoteMessage
  index: number
  customPosition?: NotePosition
  zIndex?: number
}