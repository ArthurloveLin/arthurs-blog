import type { EmojiReactionEntry } from '@/lib/comment-emojis'
import type { NoteMessage } from '@/lib/note-boards'
import type { ReactionValue } from '@/lib/comment-reactions'
import type { NotePriority, NoteSortDirection, NoteSortMode } from '@/lib/note-priority'

export interface Size {
  width: number
  height: number
}

export interface NotePosition {
  x: number
  y: number
  rotation: number
}

export interface NoteBoardListPayload {
  messages: NoteMessage[]
  nextOffset: number
  hasMore: boolean
  archived: boolean
  sort: NoteSortMode
  sortDirection: NoteSortDirection
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
  surfaceMinHeight?: number
}

export interface StickyNoteCardReactionControl {
  upvotes: number
  downvotes: number
  viewerReaction: ReactionValue
  emojiReactions: EmojiReactionEntry[]
  viewerEmojis: string[]
  pending?: boolean
  emojiPending?: boolean
  onReact: (value: 1 | -1) => void
  onEmojiReact: (emoji: string) => void
}

export interface StickyNoteCardChecklistControl {
  pending?: boolean
  onToggle?: (lineIndex: number) => void
}

export interface NoteCardViewModel {
  message: NoteMessage
  canDelete: boolean
  canEdit: boolean
  actions: StickyNoteCardActions
  priorityControl?: StickyNoteCardPriorityControl
  reactionControl: StickyNoteCardReactionControl
  checklistControl?: StickyNoteCardChecklistControl
  inlineEditor?: StickyNoteCardInlineEditor
  isEditing: boolean
  isPriorityUpdating: boolean
  isOptimistic: boolean
  isOptimisticEditing?: boolean
  isFresh: boolean
}
