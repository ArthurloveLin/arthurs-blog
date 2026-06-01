import { useCallback, useEffect, useMemo, useState } from 'react'
import { createCommentRecord, type Comment } from '@/lib/comments'
import { createEngagementRequestHeaders, fetchEngagementPublicApi } from '@/lib/engagement-public-api'
import { createGuestbookNoteMessage, humanizeGuestbookMutationError } from '@/lib/guestbook-comments'
import type { NoteMessage, NoteVisibility } from '@/lib/note-boards'
import { NOTE_MAX_LENGTH } from '@/lib/input-limits'
import { DEFAULT_NOTE_PRIORITY, type NotePriority } from '@/lib/note-priority'
import type { NoteBoardViewConfig } from '@/lib/note-board-config'
import { extractEarliestDueAt, toggleChecklistLine } from '@/components/note-board/utils/editor'

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
  const [draftVisibility, setDraftVisibility] = useState<NoteVisibility>('public')
  const [draftDueAt, setDraftDueAt] = useState<string | null>(null)
  const [draftRepeatMode, setDraftRepeatMode] = useState<string>('once')
  const [draftRepeatDays, setDraftRepeatDays] = useState<number[] | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editPriority, setEditPriority] = useState<NotePriority>(DEFAULT_NOTE_PRIORITY)
  const [editVisibility, setEditVisibility] = useState<NoteVisibility>('public')
  const [editDueAt, setEditDueAt] = useState<string | null>(null)
  const [editRepeatMode, setEditRepeatMode] = useState<string>('once')
  const [editRepeatDays, setEditRepeatDays] = useState<number[] | null>(null)
  const [isUpdatingNote, setIsUpdatingNote] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [updatingNoteIds, setUpdatingNoteIds] = useState<Record<string, boolean>>({})
  const editingMessage = useMemo(
    () => messages.find((message) => message.id === editingNoteId) ?? null,
    [messages, editingNoteId]
  )

  const scrollToEditor = useCallback(() => {
    // Double rAF: a click that opens the editor often also flips it into edit
    // mode / expands an optimistic card, which changes layout. Wait for that to
    // commit before measuring, or the smooth scroll lands on a stale position
    // (the editor ended up off-screen entirely on phone & tablet). block:'center'
    // keeps the target clear of the fixed navbar and the mobile bottom dock, and
    // matches the post-send centering.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        editorSectionElement?.scrollIntoView({ behavior: 'instant', block: 'center' })
      })
    })
  }, [editorSectionElement])

  const cancelEditingNote = useCallback(() => {
    setEditingNoteId(null)
    setEditContent('')
    setEditPriority(DEFAULT_NOTE_PRIORITY)
    setEditVisibility('public')
    setEditDueAt(null)
    setEditRepeatMode('once')
    setEditRepeatDays(null)
    setError(null)
  }, [setError])

  const startEditingNote = useCallback((message: NoteMessage) => {
    setEditingNoteId(message.id)
    setEditContent(message.content)
    setEditPriority(message.priority)
    setEditVisibility(message.visibility ?? 'public')
    setEditDueAt(message.due_at ?? null)
    setEditRepeatMode(message.repeat_mode ?? 'once')
    setEditRepeatDays(message.repeat_days ?? null)
    setError(null)

    if (isMobileViewport) {
      scrollToEditor()
    }
  }, [isMobileViewport, scrollToEditor, setError])

  const saveEditingNote = useCallback(async () => {
    if (!editingMessage || isUpdatingNote || !identity) return

    const nextContent = editContent.trim()
    if (!nextContent) {
      setError('便签内容不能为空。')
      return
    }

    async function commitNoteUpdate(message: NoteMessage, content: string, priority: NotePriority, visibility: NoteVisibility, dueAt: string | null, repeatMode: string, repeatDays: number[] | null) {
      const originalContent = message.content
      const originalPriority = message.priority
      const originalVisibility = message.visibility ?? 'public'

      setError(null)
      setUpdatingNoteIds((prev) => ({ ...prev, [message.id]: true }))
      replaceMessages((current) => current.map((currentMessage) => currentMessage.id === message.id
        ? {
          ...currentMessage,
          content,
          priority,
          visibility,
          due_at: dueAt,
          repeat_mode: repeatMode,
          repeat_days: repeatDays,
        }
        : currentMessage), { resetPositions: false, sort: false })

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
            body: JSON.stringify({ identity, identities: viewerIdentityAliases, content, priority, visibility, due_at: dueAt, repeat_mode: repeatMode, repeat_days: repeatDays }),
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
            comment_count: currentMessage.comment_count,
          }
          : currentMessage), { resetPositions: false, sort: false })
      } catch (updateError) {
        replaceMessages((current) => current.map((currentMessage) => currentMessage.id === message.id
          ? {
            ...currentMessage,
            content: originalContent,
            priority: originalPriority,
            visibility: originalVisibility,
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

    const snapshotRepeatMode = editRepeatMode
    const snapshotRepeatDays = editRepeatDays

    setIsUpdatingNote(true)
    setEditingNoteId(null)
    setEditContent('')
    setEditPriority(DEFAULT_NOTE_PRIORITY)
    setEditVisibility('public')
    setEditDueAt(null)
    setEditRepeatMode('once')
    setEditRepeatDays(null)

    try {
      await commitNoteUpdate(editingMessage, nextContent, editPriority, editVisibility, extractEarliestDueAt(nextContent) ?? editDueAt, snapshotRepeatMode, snapshotRepeatDays)
    } finally {
      setIsUpdatingNote(false)
    }
  }, [board.slug, editContent, editDueAt, editPriority, editRepeatDays, editRepeatMode, editVisibility, editingMessage, identity, isUpdatingNote, replaceMessages, setError, viewerIdentityAliases])

  const toggleChecklistItem = useCallback((message: NoteMessage, lineIndex: number) => {
    if (!identity || editingNoteId === message.id || updatingNoteIds[message.id]) {
      return
    }

    // Habit items (repeat-mode checklist lines) are now handled exclusively through
    // the habit completion API via onCompleteHabitItem in NoteContent.  Those clicks
    // no longer reach this function, so we only need to handle plain checklist lines.
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
            comment_count: currentMessage.comment_count,
          }
          : currentMessage), { resetPositions: false, sort: false })
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
    const draftVisibilityValue = draftVisibility
    const draftDueAtValue = extractEarliestDueAt(draftValue) ?? draftDueAt
    const draftRepeatModeValue = draftRepeatMode
    const draftRepeatDaysValue = draftRepeatDays
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
      visibility: draftVisibilityValue,
      due_at: draftDueAtValue,
      repeat_mode: draftRepeatModeValue !== 'once' ? draftRepeatModeValue : null,
      repeat_days: draftRepeatDaysValue,
    }

    setIsSubmitting(true)
    setError(null)
    setDraft('')
    setDraftPriority(DEFAULT_NOTE_PRIORITY)
    setDraftVisibility('public')
    setDraftDueAt(null)
    setDraftRepeatMode('once')
    setDraftRepeatDays(null)
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
          body: JSON.stringify({ author: publicIdentity, content: draftValue, priority: draftPriorityValue, visibility: draftVisibilityValue, due_at: draftDueAtValue, repeat_mode: draftRepeatModeValue, repeat_days: draftRepeatDaysValue }),
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
      setDraftVisibility(draftVisibilityValue)
      setDraftDueAt(draftDueAtValue)
      setDraftRepeatMode(draftRepeatModeValue)
      setDraftRepeatDays(draftRepeatDaysValue)
      setError(submitError instanceof Error ? submitError.message : '便签保存失败，请稍后再试。')
    } finally {
      setIsSubmitting(false)
    }
  }, [board.slug, board.targetId, board.targetType, canWrite, draft, draftDueAt, draftPriority, draftRepeatDays, draftRepeatMode, draftVisibility, hasMore, identity, isSubmitting, markMessageFresh, nextOffset, publicIdentity, replaceMessages, setError, onDraftSubmitted])

  useEffect(() => {
    if (!editingNoteId) return
    if (!messages.some((message) => message.id === editingNoteId)) {
      const frameId = window.requestAnimationFrame(() => {
        setEditingNoteId(null)
        setEditContent('')
      })

      return () => {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [editingNoteId, messages])

  return {
    draft,
    setDraft,
    draftPriority,
    setDraftPriority,
    draftVisibility,
    setDraftVisibility,
    draftDueAt,
    setDraftDueAt,
    draftRepeatMode,
    setDraftRepeatMode,
    draftRepeatDays,
    setDraftRepeatDays,
    editingNoteId,
    editContent,
    setEditContent,
    editPriority,
    setEditPriority,
    editVisibility,
    setEditVisibility,
    editDueAt,
    setEditDueAt,
    editRepeatMode,
    setEditRepeatMode,
    editRepeatDays,
    setEditRepeatDays,
    isUpdatingNote,
    isSubmitting,
    updatingNoteIds,
    editingMessage,
    cancelEditingNote,
    startEditingNote,
    saveEditingNote,
    toggleChecklistItem,
    submitDraft,
    scrollToEditor,
  }
}
