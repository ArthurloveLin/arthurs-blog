import { useCallback, useEffect, useMemo, useState } from 'react'
import { createCommentRecord, type Comment } from '@/lib/comments'
import { createEngagementRequestHeaders, fetchEngagementPublicApi } from '@/lib/engagement-public-api'
import { createGuestbookNoteMessage, humanizeGuestbookMutationError } from '@/lib/guestbook-comments'
import type { NoteMessage } from '@/lib/note-boards'
import { NOTE_MAX_LENGTH } from '@/lib/input-limits'
import { DEFAULT_NOTE_PRIORITY, type NotePriority } from '@/lib/note-priority'
import type { NoteBoardViewConfig } from '@/lib/note-board-config'
import { toggleChecklistLine } from '@/components/note-board/utils/editor'

function getResponseErrorMessage(payload: unknown) {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
    return payload.error
  }

  return undefined
}

export interface UseNoteEditorProps {
  board: NoteBoardViewConfig
  messages: NoteMessage[]
  identity: string | null | undefined
  publicIdentity: string | null | undefined
  viewerIdentityAliases: string[]
  canWrite: boolean
  isMobileViewport: boolean | null
  editorSectionElement: HTMLElement | null
  nextOffset: number
  hasMore: boolean
  replaceMessages: (
    nextMessagesOrUpdater: NoteMessage[] | ((current: NoteMessage[]) => NoteMessage[]),
    options?: { resetPositions?: boolean; sort?: boolean; hasMore?: boolean; nextOffset?: number }
  ) => void
  markMessageFresh: (id: string) => void
  onDraftSubmitted?: () => void
  error: string | null
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

export function useNoteEditor({
  board,
  messages,
  identity,
  publicIdentity,
  viewerIdentityAliases,
  canWrite,
  isMobileViewport,
  editorSectionElement,
  nextOffset,
  hasMore,
  replaceMessages,
  markMessageFresh,
  onDraftSubmitted,
  setError,
}: UseNoteEditorProps) {
  const [draft, setDraft] = useState('')
  const [draftPriority, setDraftPriority] = useState<NotePriority>(DEFAULT_NOTE_PRIORITY)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editPriority, setEditPriority] = useState<NotePriority>(DEFAULT_NOTE_PRIORITY)
  const [isUpdatingNote, setIsUpdatingNote] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [updatingNoteIds, setUpdatingNoteIds] = useState<Record<string, boolean>>({})

  const editingMessage = useMemo(
    () => messages.find((message) => message.id === editingNoteId) ?? null,
    [messages, editingNoteId]
  )

  const scrollToEditor = useCallback(() => {
    window.requestAnimationFrame(() => {
      editorSectionElement?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [editorSectionElement])

  const cancelEditingNote = useCallback(() => {
    setEditingNoteId(null)
    setEditContent('')
    setEditPriority(DEFAULT_NOTE_PRIORITY)
    setError(null)
  }, [setError])

  const startEditingNote = useCallback((message: NoteMessage) => {
    setEditingNoteId(message.id)
    setEditContent(message.content)
    setEditPriority(message.priority)
    setError(null)

    if (isMobileViewport) {
      scrollToEditor()
    }
  }, [isMobileViewport, scrollToEditor, setError])

  const saveEditingNote = useCallback(async () => {
    if (!editingMessage || isUpdatingNote) return

    const nextContent = editContent.trim()
    if (!nextContent) {
      setError('便签内容不能为空。')
      return
    }

    async function commitNoteUpdate(message: NoteMessage, content: string, priority: NotePriority) {
      if (!identity) {
        return
      }

      const originalContent = message.content
      const originalPriority = message.priority

      setError(null)
      setUpdatingNoteIds((prev) => ({ ...prev, [message.id]: true }))
      replaceMessages((current) => current.map((currentMessage) => currentMessage.id === message.id
        ? {
          ...currentMessage,
          content,
          priority,
        }
        : currentMessage), { resetPositions: false })

      try {
        let updatedMessage: NoteMessage

        if (board.slug === 'guestbook') {
          const response = await fetchEngagementPublicApi(`/api/comments/${message.id}`, {
            method: 'PATCH',
            headers: await createEngagementRequestHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ identity, identities: viewerIdentityAliases, content }),
          })

          const payload = await response.json().catch(() => null) as Comment | { error?: string } | null
          if (!response.ok) {
            if (response.status === 403) {
              throw new Error('当前身份没有编辑权限。')
            }

            throw new Error(humanizeGuestbookMutationError(getResponseErrorMessage(payload), '便签更新失败，请稍后再试。'))
          }

          if (!payload) {
            throw new Error('便签更新失败，请稍后再试。')
          }

          updatedMessage = createGuestbookNoteMessage(createCommentRecord(payload as Comment))
        } else {
          const response = await fetch(`/api/note-boards/${board.slug}/${message.id}`, {
            method: 'PATCH',
            headers: await createEngagementRequestHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ identity, identities: viewerIdentityAliases, content, priority }),
          })

          if (!response.ok) {
            const payload = await response.json().catch(() => null) as { error?: string } | null
            if (response.status === 403) {
              throw new Error('当前身份没有编辑权限。')
            }
            throw new Error(payload?.error === 'Content too long' ? `便签不能超过 ${NOTE_MAX_LENGTH} 字。` : '便签更新失败，请稍后再试。')
          }

          updatedMessage = (await response.json()) as NoteMessage
        }

        replaceMessages((current) => current.map((currentMessage) => currentMessage.id === updatedMessage.id
          ? {
            ...updatedMessage,
            visual_seed: currentMessage.visual_seed,
            upvotes: currentMessage.upvotes,
            downvotes: currentMessage.downvotes,
            viewer_reaction: currentMessage.viewer_reaction,
            emoji_reactions: currentMessage.emoji_reactions,
            viewer_emojis: currentMessage.viewer_emojis,
          }
          : currentMessage), { resetPositions: false })
      } catch (updateError) {
        replaceMessages((current) => current.map((currentMessage) => currentMessage.id === message.id
          ? {
            ...currentMessage,
            content: originalContent,
            priority: originalPriority,
          }
          : currentMessage), { resetPositions: false })
        setError(updateError instanceof Error ? updateError.message : '便签更新失败，请稍后再试。')
      } finally {
        setUpdatingNoteIds((prev) => {
          const next = { ...prev }
          delete next[message.id]
          return next
        })
      }
    }

    setIsUpdatingNote(true)
    setEditingNoteId(null)
    setEditContent('')
    setEditPriority(DEFAULT_NOTE_PRIORITY)

    try {
      await commitNoteUpdate(editingMessage, nextContent, editPriority)
    } finally {
      setIsUpdatingNote(false)
    }
  }, [board.slug, editContent, editPriority, editingMessage, identity, isUpdatingNote, replaceMessages, setError, viewerIdentityAliases])

  const toggleChecklistItem = useCallback((message: NoteMessage, lineIndex: number) => {
    if (!identity || editingNoteId === message.id || updatingNoteIds[message.id]) {
      return
    }

    const nextContent = toggleChecklistLine(message.content, lineIndex)
    if (nextContent === message.content) {
      return
    }

    void (async () => {
      const originalContent = message.content
      const originalPriority = message.priority

      setError(null)
      setUpdatingNoteIds((prev) => ({ ...prev, [message.id]: true }))
      replaceMessages((current) => current.map((currentMessage) => currentMessage.id === message.id
        ? {
          ...currentMessage,
          content: nextContent,
        }
        : currentMessage), { resetPositions: false })

      try {
        let updatedMessage: NoteMessage

        if (board.slug === 'guestbook') {
          const response = await fetchEngagementPublicApi(`/api/comments/${message.id}`, {
            method: 'PATCH',
            headers: await createEngagementRequestHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ identity, identities: viewerIdentityAliases, content: nextContent }),
          })

          const payload = await response.json().catch(() => null) as Comment | { error?: string } | null
          if (!response.ok) {
            if (response.status === 403) {
              throw new Error('当前身份没有编辑权限。')
            }

            throw new Error(humanizeGuestbookMutationError(getResponseErrorMessage(payload), '便签更新失败，请稍后再试。'))
          }

          if (!payload) {
            throw new Error('便签更新失败，请稍后再试。')
          }

          updatedMessage = createGuestbookNoteMessage(createCommentRecord(payload as Comment))
        } else {
          const response = await fetch(`/api/note-boards/${board.slug}/${message.id}`, {
            method: 'PATCH',
            headers: await createEngagementRequestHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ identity, identities: viewerIdentityAliases, content: nextContent, priority: message.priority }),
          })

          if (!response.ok) {
            const payload = await response.json().catch(() => null) as { error?: string } | null
            if (response.status === 403) {
              throw new Error('当前身份没有编辑权限。')
            }
            throw new Error(payload?.error === 'Content too long' ? `便签不能超过 ${NOTE_MAX_LENGTH} 字。` : '便签更新失败，请稍后再试。')
          }

          updatedMessage = (await response.json()) as NoteMessage
        }

        replaceMessages((current) => current.map((currentMessage) => currentMessage.id === updatedMessage.id
          ? {
            ...updatedMessage,
            visual_seed: currentMessage.visual_seed,
            upvotes: currentMessage.upvotes,
            downvotes: currentMessage.downvotes,
            viewer_reaction: currentMessage.viewer_reaction,
            emoji_reactions: currentMessage.emoji_reactions,
            viewer_emojis: currentMessage.viewer_emojis,
          }
          : currentMessage), { resetPositions: false })
      } catch (updateError) {
        replaceMessages((current) => current.map((currentMessage) => currentMessage.id === message.id
          ? {
            ...currentMessage,
            content: originalContent,
            priority: originalPriority,
          }
          : currentMessage), { resetPositions: false })
        setError(updateError instanceof Error ? updateError.message : '便签更新失败，请稍后再试。')
      } finally {
        setUpdatingNoteIds((prev) => {
          const next = { ...prev }
          delete next[message.id]
          return next
        })
      }
    })()
  }, [board.slug, editingNoteId, identity, replaceMessages, setError, updatingNoteIds, viewerIdentityAliases])

  const submitDraft = useCallback(async () => {
    if (!draft.trim() || !identity || !canWrite || isSubmitting) return

    const draftValue = draft.trim()
    const draftPriorityValue = draftPriority
    const optimisticId = `optimistic-${crypto.randomUUID()}`
    const optimisticMessage: NoteMessage = {
      id: optimisticId,
      visual_seed: optimisticId,
      author: publicIdentity ?? '',
      content: draftValue,
      created_at: new Date().toISOString(),
      updated_at: null,
      priority: draftPriorityValue,
      archived: false,
      parent_id: null,
      upvotes: 0,
      downvotes: 0,
      viewer_reaction: 0,
      emoji_reactions: [],
      viewer_emojis: [],
      sync_state: 'pending',
    }

    setIsSubmitting(true)
    setError(null)
    setDraft('')
    setDraftPriority(DEFAULT_NOTE_PRIORITY)
    if (onDraftSubmitted) {
      onDraftSubmitted()
    }

    replaceMessages((current) => [optimisticMessage, ...current], {
      resetPositions: true,
      nextOffset: nextOffset + 1,
      hasMore,
    })
    markMessageFresh(optimisticId)

    try {
      let message: NoteMessage

      if (board.slug === 'guestbook') {
        const response = await fetchEngagementPublicApi('/api/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_type: board.targetType,
            target_id: board.targetId,
            author: publicIdentity,
            content: draftValue,
            parent_id: null,
          }),
        })

        const payload = await response.json().catch(() => null) as Comment | { error?: string } | null
        if (!response.ok) {
          if (response.status === 403) {
            throw new Error('当前身份没有写入权限。')
          }

          throw new Error(humanizeGuestbookMutationError(getResponseErrorMessage(payload), '便签保存失败，请稍后再试。'))
        }

        if (!payload) {
          throw new Error('便签保存失败，请稍后再试。')
        }

        message = createGuestbookNoteMessage(createCommentRecord(payload as Comment))
      } else {
        const response = await fetch(`/api/note-boards/${board.slug}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: publicIdentity, content: draftValue, priority: draftPriorityValue }),
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { error?: string } | null
          if (response.status === 403) {
            throw new Error('当前身份没有写入权限。')
          }
          throw new Error(payload?.error === 'Content too long' ? `便签不能超过 ${NOTE_MAX_LENGTH} 字。` : '便签保存失败，请稍后再试。')
        }

        message = (await response.json()) as NoteMessage
      }

      replaceMessages((current) => current.map((currentMessage) => currentMessage.id === optimisticId ? { ...message, visual_seed: currentMessage.visual_seed ?? currentMessage.id } : currentMessage), {
        resetPositions: true,
        nextOffset: nextOffset + 1,
        hasMore,
      })
      markMessageFresh(message.id)
    } catch (submitError) {
      replaceMessages((current) => current.filter((message) => message.id !== optimisticId), {
        resetPositions: true,
        nextOffset: Math.max(nextOffset, 0),
        hasMore,
      })
      setDraft(draftValue)
      setDraftPriority(draftPriorityValue)
      setError(submitError instanceof Error ? submitError.message : '便签保存失败，请稍后再试。')
    } finally {
      setIsSubmitting(false)
    }
  }, [board.slug, board.targetId, board.targetType, canWrite, draft, draftPriority, hasMore, identity, isSubmitting, markMessageFresh, nextOffset, publicIdentity, replaceMessages, setError, onDraftSubmitted])

  useEffect(() => {
    if (!editingNoteId) return
    if (!messages.some((message) => message.id === editingNoteId)) {
      setEditingNoteId(null)
      setEditContent('')
    }
  }, [editingNoteId, messages])

  return {
    draft,
    setDraft,
    draftPriority,
    setDraftPriority,
    editingNoteId,
    editContent,
    setEditContent,
    editPriority,
    setEditPriority,
    isUpdatingNote,
    isSubmitting,
    updatingNoteIds,
    editingMessage,
    cancelEditingNote,
    startEditingNote,
    saveEditingNote,
    toggleChecklistItem,
    submitDraft,
  }
}
