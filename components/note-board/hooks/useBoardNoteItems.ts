import { useMemo } from 'react'
import type { NoteMessage } from '@/lib/note-boards'
import type { NoteCardViewModel } from '@/components/note-board/types'
import { getDeletePermission, getEditPermission } from '@/components/note-board/utils/board'
import type { NotePriority } from '@/lib/note-priority'
import type { NoteBoardSlug } from '@/lib/note-board-config'

export interface UseBoardNoteItemsProps {
  visibleMessages: NoteMessage[]
  boardSlug: NoteBoardSlug
  isAdmin: boolean
  viewerIdentityAliases: string[]
  editingNoteId: string | null
  editContent: string
  isUpdatingNote: boolean
  priorityUpdatingIds: Record<string, boolean>
  reactionUpdatingIds: Record<string, boolean>
  emojiUpdatingIds: Record<string, boolean>
  freshMessageIds: Record<string, boolean>
  measuredHeights: Record<string, number>
  priorityEnabled: boolean
  updatingNoteIds?: Record<string, boolean>
  
  handleDelete: (id: string, editingNoteId?: string | null) => void
  startEditingNote: (message: NoteMessage) => void
  handleToggleArchive: (message: NoteMessage, editingNoteId?: string | null) => void
  handlePriorityChange: (message: NoteMessage, priority: NotePriority) => void
  handleReaction: (message: NoteMessage, value: 1 | -1) => void
  handleEmojiReaction: (message: NoteMessage, emoji: string) => void
  saveEditingNote: () => Promise<void>
  cancelEditingNote: () => void
  setEditContent: (value: string) => void
}

export function useBoardNoteItems({
  visibleMessages,
  boardSlug,
  isAdmin,
  viewerIdentityAliases,
  editingNoteId,
  editContent,
  isUpdatingNote,
  priorityUpdatingIds,
  reactionUpdatingIds,
  emojiUpdatingIds,
  freshMessageIds,
  measuredHeights,
  priorityEnabled,
  updatingNoteIds,
  handleDelete,
  startEditingNote,
  handleToggleArchive,
  handlePriorityChange,
  handleReaction,
  handleEmojiReaction,
  saveEditingNote,
  cancelEditingNote,
  setEditContent,
}: UseBoardNoteItemsProps) {
  const noteItems = useMemo<NoteCardViewModel[]>(() => visibleMessages.map((message) => {
    const isLocalOptimistic = message.id.startsWith('optimistic-')
    const isPendingSync = message.sync_state === 'pending' || isLocalOptimistic
    const canManagePending = !isLocalOptimistic && viewerIdentityAliases.includes(message.author)
    const canDelete = isPendingSync
      ? canManagePending
      : getDeletePermission(boardSlug, isAdmin, viewerIdentityAliases, message)
    const canEdit = isPendingSync
      ? canManagePending
      : getEditPermission(isAdmin, viewerIdentityAliases, message)
    const isEditing = editingNoteId === message.id
    const isPriorityUpdating = Boolean(priorityUpdatingIds[message.id])
    const isOptimisticEditing = Boolean(updatingNoteIds?.[message.id])

    return {
      message,
      canDelete,
      canEdit,
      isEditing,
      isPriorityUpdating,
      isOptimisticEditing,
      isOptimistic: isLocalOptimistic,
      isFresh: Boolean(freshMessageIds[message.id]),
      actions: {
        delete: canDelete ? { onClick: () => void handleDelete(message.id, editingNoteId) } : undefined,
        edit: canEdit ? { onClick: () => startEditingNote(message) } : undefined,
        archive: canEdit && !isPendingSync ? { archived: message.archived, onToggle: () => void handleToggleArchive(message, editingNoteId) } : undefined,
      },
      priorityControl: priorityEnabled ? {
        value: message.priority ?? 0,
        onChange: canEdit ? (priority) => void handlePriorityChange(message, priority) : undefined,
        disabled: isPriorityUpdating || !canEdit,
      } : undefined,
      reactionControl: {
        upvotes: message.upvotes,
        downvotes: message.downvotes,
        viewerReaction: message.viewer_reaction,
        emojiReactions: message.emoji_reactions,
        viewerEmojis: message.viewer_emojis,
        pending: isPendingSync || Boolean(reactionUpdatingIds[message.id]),
        emojiPending: isPendingSync || Boolean(emojiUpdatingIds[message.id]),
        onReact: isPendingSync ? () => undefined : (value) => void handleReaction(message, value),
        onEmojiReact: isPendingSync ? () => undefined : (emoji) => void handleEmojiReaction(message, emoji),
      },
      inlineEditor: isEditing ? {
        value: editContent,
        isSaving: isUpdatingNote,
        onChange: setEditContent,
        onSave: () => void saveEditingNote(),
        onCancel: cancelEditingNote,
        surfaceMinHeight: measuredHeights[message.id],
      } : undefined,
    }
  }), [
    visibleMessages,
    boardSlug,
    isAdmin,
    viewerIdentityAliases,
    editingNoteId,
    editContent,
    isUpdatingNote,
    priorityUpdatingIds,
    reactionUpdatingIds,
    emojiUpdatingIds,
    freshMessageIds,
    measuredHeights,
    priorityEnabled,
    updatingNoteIds,
    handleDelete,
    startEditingNote,
    handleToggleArchive,
    handlePriorityChange,
    handleReaction,
    handleEmojiReaction,
    saveEditingNote,
    cancelEditingNote,
    setEditContent,
  ])

  return { noteItems }
}
