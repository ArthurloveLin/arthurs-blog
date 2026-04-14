import type { NoteMessage } from '@/lib/note-boards'
import type { NotePriority } from '@/lib/note-priority'

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

export interface StickyNoteCardLinkAction {
  href: string
  label: string
}

export interface StickyNoteCardToggleAction {
  onToggle: () => void
  archived?: boolean
}

export interface StickyNoteCardButtonAction {
  onClick: () => void
}

export interface StickyNoteCardActions {
  cta?: StickyNoteCardLinkAction
  archive?: StickyNoteCardToggleAction
  edit?: StickyNoteCardButtonAction
  delete?: StickyNoteCardButtonAction
}

export interface StickyNoteCardPriorityControl {
  value: NotePriority
  onChange?: (value: NotePriority) => void
  disabled?: boolean
}

export interface StickyNoteCardInlineEditor {
  value: string
  isSaving: boolean
  onChange: (value: string) => void
  onSave: () => void
  onCancel?: () => void
}

export interface NoteCardViewModel {
  message: NoteMessage
  canDelete: boolean
  canEdit: boolean
  actions: StickyNoteCardActions
  priorityControl?: StickyNoteCardPriorityControl
  inlineEditor?: StickyNoteCardInlineEditor
  isEditing: boolean
  isPriorityUpdating: boolean
}