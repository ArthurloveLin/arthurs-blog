import { useCallback, useRef, useState } from 'react'
import type { NoteMessage } from '@/lib/note-boards'
import type { NotePriority } from '@/lib/note-priority'
import type { NoteBoardViewConfig } from '@/lib/note-board-config'
import type { NotePosition, OptimisticMessageSnapshot } from '@/components/note-board/types'
import { applyOptimisticEmojiToMessage, applyOptimisticReactionToMessage, buildOptimisticSnapshot } from '@/components/note-board/utils/board'

export interface UseBoardMutationsProps {
  board: NoteBoardViewConfig
  identity: string | null | undefined
  reactionIdentity: string | undefined
  viewerIdentityAliases: string[]
  messagesRef: React.MutableRefObject<NoteMessage[]>
  customPositionsRef: React.MutableRefObject<Record<string, NotePosition>>
  cardZIndicesRef: React.MutableRefObject<Record<string, number>>
  replaceMessages: (
    nextMessagesOrUpdater: NoteMessage[] | ((current: NoteMessage[]) => NoteMessage[]),
    options?: { resetPositions?: boolean; sort?: boolean; hasMore?: boolean; nextOffset?: number }
  ) => void
  removeMessageFromSurface: (id: string, editingNoteId?: string | null) => void
  restoreMessageSnapshot: (snapshot: OptimisticMessageSnapshot) => void
  showToast: (message: string) => void
  setError: React.Dispatch<React.SetStateAction<string | null>>
  editingMessage: NoteMessage | null
  setEditPriority: React.Dispatch<React.SetStateAction<NotePriority>>
}

export function useBoardMutations({
  board,
  identity,
  reactionIdentity,
  viewerIdentityAliases,
  messagesRef,
  customPositionsRef,
  cardZIndicesRef,
  replaceMessages,
  removeMessageFromSurface,
  restoreMessageSnapshot,
  showToast,
  setError,
  editingMessage,
  setEditPriority,
}: UseBoardMutationsProps) {
  const [priorityUpdatingIds, setPriorityUpdatingIds] = useState<Record<string, boolean>>({})
  const [reactionUpdatingIds, setReactionUpdatingIds] = useState<Record<string, boolean>>({})
  const [emojiUpdatingIds, setEmojiUpdatingIds] = useState<Record<string, boolean>>({})
  const pendingOptimisticIdsRef = useRef<Set<string>>(new Set())

  const handleReaction = useCallback(async (message: NoteMessage, value: 1 | -1) => {
    if (!reactionIdentity || reactionUpdatingIds[message.id]) return

    const snapshot = messagesRef.current.find((entry) => entry.id === message.id)
    if (!snapshot) return

    const nextReaction = message.viewer_reaction === value ? 0 : value

    setReactionUpdatingIds((current) => ({ ...current, [message.id]: true }))
    replaceMessages((current) => current.map((entry) => entry.id === message.id ? applyOptimisticReactionToMessage(entry, nextReaction) : entry), {
      sort: false,
    })

    try {
      const response = await fetch(`/api/comments/${message.id}/reaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: reactionIdentity, reaction: nextReaction }),
      })

      if (!response.ok) {
        throw new Error('互动更新失败，请稍后再试。')
      }

      const summary = await response.json() as Pick<NoteMessage, 'upvotes' | 'downvotes' | 'viewer_reaction'>
      replaceMessages((current) => current.map((entry) => entry.id === message.id ? { ...entry, ...summary } : entry), {
        sort: false,
      })
    } catch (reactionError) {
      replaceMessages((current) => current.map((entry) => entry.id === message.id ? snapshot : entry), {
        sort: false,
      })
      showToast(reactionError instanceof Error ? reactionError.message : '互动更新失败，请稍后再试。')
    } finally {
      setReactionUpdatingIds((current) => {
        const next = { ...current }
        delete next[message.id]
        return next
      })
    }
  }, [reactionIdentity, reactionUpdatingIds, messagesRef, replaceMessages, showToast])

  const handleEmojiReaction = useCallback(async (message: NoteMessage, emoji: string) => {
    if (!reactionIdentity || emojiUpdatingIds[message.id]) return

    const snapshot = messagesRef.current.find((entry) => entry.id === message.id)
    if (!snapshot) return

    setEmojiUpdatingIds((current) => ({ ...current, [message.id]: true }))
    replaceMessages((current) => current.map((entry) => entry.id === message.id ? applyOptimisticEmojiToMessage(entry, emoji) : entry), {
      sort: false,
    })

    try {
      const response = await fetch(`/api/comments/${message.id}/emoji`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: reactionIdentity, emoji }),
      })

      if (!response.ok) {
        throw new Error('表情互动更新失败，请稍后再试。')
      }

      const summary = await response.json() as Pick<NoteMessage, 'emoji_reactions' | 'viewer_emojis'>
      replaceMessages((current) => current.map((entry) => entry.id === message.id ? { ...entry, ...summary } : entry), {
        sort: false,
      })
    } catch (emojiError) {
      replaceMessages((current) => current.map((entry) => entry.id === message.id ? snapshot : entry), {
        sort: false,
      })
      showToast(emojiError instanceof Error ? emojiError.message : '表情互动更新失败，请稍后再试。')
    } finally {
      setEmojiUpdatingIds((current) => {
        const next = { ...current }
        delete next[message.id]
        return next
      })
    }
  }, [emojiUpdatingIds, reactionIdentity, messagesRef, replaceMessages, showToast])

  const handleDelete = useCallback(async (id: string, editingNoteId?: string | null) => {
    if (!identity || pendingOptimisticIdsRef.current.has(id)) return

    const snapshot = buildOptimisticSnapshot(id, messagesRef.current, customPositionsRef.current, cardZIndicesRef.current)
    if (!snapshot) return

    setError(null)
    pendingOptimisticIdsRef.current.add(id)
    removeMessageFromSurface(id, editingNoteId)

    try {
      const response = await fetch(`/api/note-boards/${board.slug}/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity, identities: viewerIdentityAliases }),
      })

      if (!response.ok) {
        throw new Error(response.status === 403 ? '当前身份没有删除权限。' : '删除失败，请稍后重试。')
      }
    } catch (deleteError) {
      restoreMessageSnapshot(snapshot)
      showToast(deleteError instanceof Error ? deleteError.message : '删除失败，请稍后重试。')
    } finally {
      pendingOptimisticIdsRef.current.delete(id)
    }
  }, [board.slug, identity, removeMessageFromSurface, restoreMessageSnapshot, showToast, viewerIdentityAliases, messagesRef, customPositionsRef, cardZIndicesRef, setError])

  const handleToggleArchive = useCallback(async (message: NoteMessage, editingNoteId?: string | null) => {
    if (!identity || pendingOptimisticIdsRef.current.has(message.id)) return

    setError(null)
    pendingOptimisticIdsRef.current.add(message.id)
    const snapshot = buildOptimisticSnapshot(message.id, messagesRef.current, customPositionsRef.current, cardZIndicesRef.current)
    removeMessageFromSurface(message.id, editingNoteId)

    try {
      const response = await fetch(`/api/note-boards/${board.slug}/${message.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity, identities: viewerIdentityAliases, archived: !message.archived }),
      })

      if (!response.ok) {
        throw new Error(response.status === 403 ? '当前身份没有归档权限。' : '归档状态更新失败，请稍后再试。')
      }
    } catch (archiveError) {
      if (snapshot) {
        restoreMessageSnapshot(snapshot)
      }
        showToast(archiveError instanceof Error ? archiveError.message : '归档状态更新失败，请稍后再试。')
    } finally {
      pendingOptimisticIdsRef.current.delete(message.id)
    }
  }, [board.slug, identity, removeMessageFromSurface, restoreMessageSnapshot, showToast, viewerIdentityAliases, messagesRef, customPositionsRef, cardZIndicesRef, setError])

  const handlePriorityChange = useCallback(async (message: NoteMessage, priority: NotePriority) => {
    if (!identity || priority === message.priority || priorityUpdatingIds[message.id]) return

    setPriorityUpdatingIds((current) => ({ ...current, [message.id]: true }))
    setError(null)

    try {
      const response = await fetch(`/api/note-boards/${board.slug}/${message.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity, identities: viewerIdentityAliases, priority }),
      })

      if (!response.ok) {
        throw new Error(response.status === 403 ? '当前身份没有编辑权限。' : '优先级更新失败，请稍后再试。')
      }

      const updatedMessage = (await response.json()) as NoteMessage
      replaceMessages((current) => current.map((currentMessage) => currentMessage.id === updatedMessage.id
        ? {
          ...updatedMessage,
          upvotes: currentMessage.upvotes,
          downvotes: currentMessage.downvotes,
          viewer_reaction: currentMessage.viewer_reaction,
          emoji_reactions: currentMessage.emoji_reactions,
          viewer_emojis: currentMessage.viewer_emojis,
        }
        : currentMessage))
      if (editingMessage?.id === updatedMessage.id) {
        setEditPriority(updatedMessage.priority)
      }
    } catch (updateError) {
      showToast(updateError instanceof Error ? updateError.message : '优先级更新失败，请稍后再试。')
    } finally {
      setPriorityUpdatingIds((current) => {
        const next = { ...current }
        delete next[message.id]
        return next
      })
    }
  }, [board.slug, editingMessage, identity, priorityUpdatingIds, replaceMessages, showToast, viewerIdentityAliases, setError, setEditPriority])

  return {
    priorityUpdatingIds,
    reactionUpdatingIds,
    emojiUpdatingIds,
    handleReaction,
    handleEmojiReaction,
    handleDelete,
    handleToggleArchive,
    handlePriorityChange,
  }
}
