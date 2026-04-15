'use client'

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react'
import useSWR from 'swr'
import { useAuth } from '@/components/AuthProvider'
import type {
  NoteCardViewModel,
  NotePosition,
  Size,
  OptimisticMessageSnapshot,
  ToastNotice,
} from '@/components/note-board/types'
import {
  MOBILE_VIEWPORT_MAX_WIDTH,
  computeBoardLayout,
  getDeletePermission,
  getEditPermission,
  sortBoardMessages,
} from '@/components/note-board/utils/board'
import { DEFAULT_NOTE_PRIORITY, type NotePriority, type NoteSortMode } from '@/lib/note-priority'
import type { NoteBoardViewConfig } from '@/lib/note-board-config'
import type { NoteMessage } from '@/lib/note-boards'

interface NoteBoardProviderProps {
  board: NoteBoardViewConfig
  initialMessages: NoteMessage[]
  children: ReactNode
}

interface NoteBoardState {
  messages: NoteMessage[]
  noteItems: NoteCardViewModel[]
  customPositions: Record<string, NotePosition>
  cardZIndices: Record<string, number>
  mobileView: 'stack' | 'list'
  hasMore: boolean
  isPending: boolean
  isRefreshingBoard: boolean
  showArchived: boolean
  sortMode: NoteSortMode
  toastNotice: ToastNotice | null
  error: string | null
  canWrite: boolean
  priorityEnabled: boolean
  loadingIdentity: boolean
  viewerIdentity: string
  totalLoaded: number
  isMobileViewport: boolean
  viewportReady: boolean
  editingMessage: NoteMessage | null
  editorMode: 'create' | 'edit'
  editorValue: string
  editorSaving: boolean
  editorPriority: NotePriority
  editorSectionLabel: string
  editorPlaceholder: string
  editorSaveLabel: string
}

interface NoteBoardSurfaceMeta {
  size: Size
  cardWidth: number
  height: number
  layouts: ReturnType<typeof computeBoardLayout>['layouts']
  hasMeasured: boolean
  isScattered: boolean
  getTargetPosition: (index: number) => NotePosition
}

interface NoteBoardMeta {
  board: NoteBoardViewConfig
  surface: NoteBoardSurfaceMeta
}

interface NoteBoardBindings {
  bindContainer: (node: HTMLDivElement | null) => void
  bindEditorSection: (node: HTMLElement | null) => void
}

interface NoteBoardActions {
  toggleMobileView: () => void
  setCardPosition: (id: string, nextPosition: NotePosition) => void
  bringCardToFront: (id: string) => void
  handleCardHeightChange: (id: string, height: number) => void
  handleLoadMore: () => Promise<void>
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  handleSwitchArchiveView: (archived: boolean) => void
  handleSortModeChange: (nextSortMode: NoteSortMode) => void
  updateEditorValue: (value: string) => void
  updateEditorPriority: (value: NotePriority) => void
  submitEditor: () => Promise<void>
  cancelEditingNote: () => void
}

interface NoteBoardContextValue {
  state: NoteBoardState
  actions: NoteBoardActions
  meta: NoteBoardMeta
  bindings: NoteBoardBindings
}

interface NoteBoardListPayload {
  messages: NoteMessage[]
  nextOffset: number
  hasMore: boolean
  archived: boolean
  sort: NoteSortMode
}

interface NoteBoardBoardState {
  messages: NoteMessage[]
  noteItems: NoteCardViewModel[]
  customPositions: Record<string, NotePosition>
  cardZIndices: Record<string, number>
  mobileView: 'stack' | 'list'
  hasMore: boolean
  isPending: boolean
  isRefreshingBoard: boolean
  showArchived: boolean
  sortMode: NoteSortMode
  totalLoaded: number
  isMobileViewport: boolean
  viewportReady: boolean
}

interface NoteBoardEditorState {
  error: string | null
  canWrite: boolean
  priorityEnabled: boolean
  loadingIdentity: boolean
  viewerIdentity: string
  editingMessage: NoteMessage | null
  editorMode: 'create' | 'edit'
  editorValue: string
  editorSaving: boolean
  editorPriority: NotePriority
  editorSectionLabel: string
  editorPlaceholder: string
  editorSaveLabel: string
}

const NoteBoardBoardStateContext = createContext<NoteBoardBoardState | null>(null)
const NoteBoardEditorStateContext = createContext<NoteBoardEditorState | null>(null)
const NoteBoardToastContext = createContext<ToastNotice | null | undefined>(undefined)
const NoteBoardActionsContext = createContext<NoteBoardActions | null>(null)
const NoteBoardMetaContext = createContext<NoteBoardMeta | null>(null)
const NoteBoardBindingsContext = createContext<NoteBoardBindings | null>(null)

function getBoardQueryKey(boardSlug: string, archived: boolean, sort: NoteSortMode) {
  return `note-board:${boardSlug}:${archived ? 'archived' : 'active'}:${sort}`
}

function applyOptimisticReactionToMessage(message: NoteMessage, nextReaction: 1 | -1 | 0) {
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

function createBoardPayload(
  messages: NoteMessage[],
  archived: boolean,
  sort: NoteSortMode,
  nextOffset: number,
  hasMore: boolean,
): NoteBoardListPayload {
  return {
    messages,
    nextOffset,
    hasMore,
    archived,
    sort,
  }
}

function isSameBoardSurfacePayload(
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
      left.viewer_reaction !== right.viewer_reaction
    ) {
      return false
    }
  }

  return true
}

function useRequiredContext<T>(context: React.Context<T | null>, name: string) {
  const value = use(context)
  if (!value) {
    throw new Error(`${name} must be used within NoteBoardProvider`)
  }

  return value
}

function buildOptimisticSnapshot(
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

export function NoteBoardProvider({ board, initialMessages, children }: NoteBoardProviderProps) {
  const { identity, identityAliases, isAdmin, loading, publicIdentity } = useAuth()
  const initialSortedMessages = useMemo(() => sortBoardMessages(initialMessages, 'time'), [initialMessages])
  const initialHasMore = initialMessages.length >= board.initialPageLimit
  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null)
  const [editorSectionElement, setEditorSectionElement] = useState<HTMLElement | null>(null)
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })
  const [messages, setMessages] = useState(initialSortedMessages)
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({})
  const [customPositions, setCustomPositions] = useState<Record<string, NotePosition>>({})
  const [cardZIndices, setCardZIndices] = useState<Record<string, number>>(() =>
    Object.fromEntries(initialSortedMessages.map((message, index) => [message.id, initialSortedMessages.length - index + 1])),
  )
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isScattered, setIsScattered] = useState(false)
  const [mobileView, setMobileView] = useState<'stack' | 'list'>('stack')
  const [nextOffset, setNextOffset] = useState(initialMessages.length)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [isPending, startTransition] = useTransition()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [isUpdatingNote, setIsUpdatingNote] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [sortMode, setSortMode] = useState<NoteSortMode>('time')
  const [draftPriority, setDraftPriority] = useState<NotePriority>(DEFAULT_NOTE_PRIORITY)
  const [editPriority, setEditPriority] = useState<NotePriority>(DEFAULT_NOTE_PRIORITY)
  const [priorityUpdatingIds, setPriorityUpdatingIds] = useState<Record<string, boolean>>({})
  const [reactionUpdatingIds, setReactionUpdatingIds] = useState<Record<string, boolean>>({})
  const [freshMessageIds, setFreshMessageIds] = useState<Record<string, boolean>>({})
  const [toastNotice, setToastNotice] = useState<ToastNotice | null>(null)
  const [isMobileViewport, setIsMobileViewport] = useState<boolean | null>(null)
  const zIndexCounterRef = useRef(initialSortedMessages.length + 2)
  const toastTimerRef = useRef<number | null>(null)
  const freshTimerRefs = useRef<Record<string, number>>({})
  const pendingOptimisticIdsRef = useRef<Set<string>>(new Set())
  const messagesRef = useRef(initialSortedMessages)
  const customPositionsRef = useRef<Record<string, NotePosition>>({})
  const cardZIndicesRef = useRef<Record<string, number>>(
    Object.fromEntries(initialSortedMessages.map((message, index) => [message.id, initialSortedMessages.length - index + 1])),
  )
  const viewerIdentity = publicIdentity ?? ''
  const reactionIdentity = identity?.trim() ?? ''
  const viewerIdentityAliases = identityAliases.length > 0 ? identityAliases : [identity].filter(Boolean)
  const canWrite = board.slug === 'guestbook' || isAdmin
  const priorityEnabled = board.slug === 'memo'
  const viewportReady = isMobileViewport !== null
  const { cardWidth, height, layouts } = useMemo(
    () => computeBoardLayout(messages, size.width, measuredHeights),
    [measuredHeights, messages, size.width],
  )
  const hasMeasured = size.width > 0 && size.height > 0
  const canInitializeSurface = hasMeasured && (messages.length === 0 || messages.every((message) => measuredHeights[message.id] > 0))
  const editingMessage = useMemo(() => messages.find((message) => message.id === editingNoteId) ?? null, [messages, editingNoteId])
  const initialBoardPayload = useMemo(
    () => createBoardPayload(initialSortedMessages, false, 'time', initialSortedMessages.length, initialHasMore),
    [initialHasMore, initialSortedMessages],
  )
  const activeBoardQueryKey = useMemo(
    () => getBoardQueryKey(board.slug, showArchived, sortMode) + `:${reactionIdentity || 'anon'}`,
    [board.slug, reactionIdentity, showArchived, sortMode],
  )
  const activeBoardQueryKeyRef = useRef(activeBoardQueryKey)

  const fetchBoardMessages = useCallback(async (
    archived: boolean,
    sort = sortMode,
    offset = 0,
    limit = board.initialPageLimit,
  ) => {
    const searchParams = new URLSearchParams({
      offset: String(offset),
      limit: String(limit),
      archived: archived ? '1' : '0',
      sort,
    })

    if (reactionIdentity) {
      searchParams.set('identity', reactionIdentity)
    }

    const response = await fetch(`/api/note-boards/${board.slug}?${searchParams.toString()}`)
    if (!response.ok) {
      throw new Error('便签加载失败，请稍后重试。')
    }

    const payload = await response.json() as { messages: NoteMessage[]; nextOffset: number; hasMore: boolean }
    return createBoardPayload(payload.messages, archived, sort, payload.nextOffset, payload.hasMore)
  }, [board.initialPageLimit, board.slug, reactionIdentity, sortMode])

  const {
    data: boardPayload,
    isLoading: isBoardLoading,
    isValidating: isBoardValidating,
    mutate: mutateBoardPayload,
  } = useSWR<NoteBoardListPayload>(
    activeBoardQueryKey,
    () => fetchBoardMessages(showArchived, sortMode),
    {
      fallbackData: initialBoardPayload,
      revalidateOnFocus: false,
    },
  )
  const isRefreshingBoard = isBoardLoading || isBoardValidating

  function showToast(message: string) {
    const nextNotice = { id: Date.now(), message }
    setToastNotice(nextNotice)

    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current)
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToastNotice((current) => current?.id === nextNotice.id ? null : current)
      toastTimerRef.current = null
    }, 2800)
  }

  const markMessageFresh = useCallback((id: string) => {
    setFreshMessageIds((current) => ({ ...current, [id]: true }))

    if (freshTimerRefs.current[id]) {
      window.clearTimeout(freshTimerRefs.current[id])
    }

    freshTimerRefs.current[id] = window.setTimeout(() => {
      setFreshMessageIds((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
      delete freshTimerRefs.current[id]
    }, 900)
  }, [])

  const scrollToEditor = useCallback(() => {
    window.requestAnimationFrame(() => {
      editorSectionElement?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [editorSectionElement])

  const bindContainer = useCallback((node: HTMLDivElement | null) => {
    setContainerElement(node)
  }, [])

  const bindEditorSection = useCallback((node: HTMLElement | null) => {
    setEditorSectionElement(node)
  }, [])

  const cancelEditingNote = useCallback(() => {
    setEditingNoteId(null)
    setEditContent('')
    setEditPriority(DEFAULT_NOTE_PRIORITY)
    setError(null)
  }, [])

  function replaceMessages(
    nextMessagesOrUpdater: NoteMessage[] | ((current: NoteMessage[]) => NoteMessage[]),
    options: { resetPositions?: boolean; sort?: boolean; hasMore?: boolean; nextOffset?: number } = {},
  ) {
    const nextMessages = typeof nextMessagesOrUpdater === 'function'
      ? nextMessagesOrUpdater(messagesRef.current)
      : nextMessagesOrUpdater
    const orderedMessages = options.sort === false ? nextMessages : sortBoardMessages(nextMessages, sortMode)

    messagesRef.current = orderedMessages
    setMessages(orderedMessages)

    if (typeof options.nextOffset === 'number') {
      setNextOffset(options.nextOffset)
    }

    if (typeof options.hasMore === 'boolean') {
      setHasMore(options.hasMore)
    }

    if (options.resetPositions) {
      setCustomPositions({})
      customPositionsRef.current = {}
      const nextZIndices = Object.fromEntries(orderedMessages.map((message, index) => [message.id, orderedMessages.length - index + 1]))
      cardZIndicesRef.current = nextZIndices
      setCardZIndices(nextZIndices)
    }

    void mutateBoardPayload((current) => current ? {
      ...current,
      messages: orderedMessages,
      nextOffset: typeof options.nextOffset === 'number' ? options.nextOffset : current.nextOffset,
      hasMore: typeof options.hasMore === 'boolean' ? options.hasMore : current.hasMore,
    } : current, { revalidate: false })
  }

  const resetBoardSurface = useCallback((nextMessages: NoteMessage[], payload?: Pick<NoteBoardListPayload, 'nextOffset' | 'hasMore'>) => {
    const sortedMessages = sortBoardMessages(nextMessages, sortMode)

    messagesRef.current = sortedMessages
    setMessages(sortedMessages)
    setNextOffset(payload?.nextOffset ?? sortedMessages.length)
    setHasMore(payload?.hasMore ?? sortedMessages.length >= board.initialPageLimit)
    setCustomPositions({})
    customPositionsRef.current = {}
    const nextZIndices = Object.fromEntries(sortedMessages.map((message, index) => [message.id, sortedMessages.length - index + 1]))
    cardZIndicesRef.current = nextZIndices
    setCardZIndices(nextZIndices)
    setMeasuredHeights((current) => {
      const allowed = new Set(sortedMessages.map((message) => message.id))
      return Object.fromEntries(Object.entries(current).filter(([id]) => allowed.has(id)))
    })
    cancelEditingNote()
  }, [board.initialPageLimit, cancelEditingNote, sortMode])

  function removeMessageFromSurface(id: string) {
    replaceMessages((current) => current.filter((message) => message.id !== id), {
      hasMore,
      nextOffset: Math.max(nextOffset - 1, 0),
    })

    setCustomPositions((current) => {
      const next = { ...current }
      delete next[id]
      customPositionsRef.current = next
      return next
    })

    setCardZIndices((current) => {
      const next = { ...current }
      delete next[id]
      cardZIndicesRef.current = next
      return next
    })

    if (editingNoteId === id) {
      cancelEditingNote()
    }
  }

  function restoreMessageSnapshot(snapshot: OptimisticMessageSnapshot) {
    setMessages((current) => {
      const withoutTarget = current.filter((message) => message.id !== snapshot.message.id)
      const next = [...withoutTarget]
      next.splice(Math.min(snapshot.index, next.length), 0, snapshot.message)
      messagesRef.current = next
      return next
    })

    if (snapshot.customPosition) {
      const position = snapshot.customPosition
      setCustomPositions((current) => {
        const next = { ...current, [snapshot.message.id]: position }
        customPositionsRef.current = next
        return next
      })
    }

    if (typeof snapshot.zIndex === 'number') {
      const zIndex = snapshot.zIndex
      setCardZIndices((current) => {
        const next = { ...current, [snapshot.message.id]: zIndex }
        cardZIndicesRef.current = next
        return next
      })
    }

    setNextOffset((current) => current + 1)
  }

  function bringCardToFront(id: string) {
    setCardZIndices((current) => {
      const next = { ...current, [id]: zIndexCounterRef.current++ }
      cardZIndicesRef.current = next
      return next
    })
  }

  const handleCardHeightChange = useCallback((id: string, nextHeight: number) => {
    setMeasuredHeights((current) => {
      if (current[id] === nextHeight) {
        return current
      }

      return { ...current, [id]: nextHeight }
    })
  }, [])

  function startEditingNote(message: NoteMessage) {
    setEditingNoteId(message.id)
    setEditContent(message.content)
    setEditPriority(message.priority)
    setError(null)

    if (isMobileViewport) {
      scrollToEditor()
    }
  }

  function handleSwitchArchiveView(archived: boolean) {
    if (archived === showArchived || isRefreshingBoard) return

    setError(null)
    cancelEditingNote()
    setShowArchived(archived)
  }

  async function handleToggleArchive(message: NoteMessage) {
    if (!identity || pendingOptimisticIdsRef.current.has(message.id)) return

    setError(null)
    pendingOptimisticIdsRef.current.add(message.id)
    const snapshot = buildOptimisticSnapshot(message.id, messagesRef.current, customPositionsRef.current, cardZIndicesRef.current)
    removeMessageFromSurface(message.id)

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
  }

  function handleSortModeChange(nextSortMode: NoteSortMode) {
    if (nextSortMode === sortMode || isRefreshingBoard) return

    setError(null)
    cancelEditingNote()
    setSortMode(nextSortMode)
  }

  async function handlePriorityChange(message: NoteMessage, priority: NotePriority) {
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
        ? { ...updatedMessage, viewer_reaction: currentMessage.viewer_reaction }
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
  }

  async function saveEditingNote() {
    if (!editingMessage || !identity || isUpdatingNote) return

    const nextContent = editContent.trim()
    if (!nextContent) {
      setError('便签内容不能为空。')
      return
    }

    setIsUpdatingNote(true)
    setError(null)

    try {
      const response = await fetch(`/api/note-boards/${board.slug}/${editingMessage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity, identities: viewerIdentityAliases, content: nextContent, priority: editPriority }),
      })

      if (!response.ok) {
        throw new Error(response.status === 403 ? '当前身份没有编辑权限。' : '便签更新失败，请稍后再试。')
      }

      const updatedMessage = (await response.json()) as NoteMessage
      replaceMessages((current) => current.map((currentMessage) => currentMessage.id === updatedMessage.id
        ? { ...updatedMessage, viewer_reaction: currentMessage.viewer_reaction }
        : currentMessage))
      cancelEditingNote()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : '便签更新失败，请稍后再试。')
    } finally {
      setIsUpdatingNote(false)
    }
  }

  async function submitDraft() {
    if (!draft.trim() || !identity || !canWrite || isSubmitting) return

    const draftValue = draft.trim()
    const draftPriorityValue = draftPriority
    const optimisticId = `optimistic-${crypto.randomUUID()}`
    const optimisticMessage: NoteMessage = {
      id: optimisticId,
      author: publicIdentity,
      content: draftValue,
      created_at: new Date().toISOString(),
      updated_at: null,
      priority: draftPriorityValue,
      archived: false,
      parent_id: null,
      upvotes: 0,
      downvotes: 0,
      viewer_reaction: 0,
    }

    setIsSubmitting(true)
    setError(null)
    setDraft('')
    setDraftPriority(DEFAULT_NOTE_PRIORITY)
    replaceMessages((current) => [optimisticMessage, ...current], {
      resetPositions: true,
      nextOffset: nextOffset + 1,
      hasMore,
    })
    markMessageFresh(optimisticId)

    try {
      const response = await fetch(`/api/note-boards/${board.slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: publicIdentity, content: draftValue, priority: draftPriorityValue }),
      })

      if (!response.ok) {
        throw new Error(response.status === 403 ? '当前身份没有写入权限。' : '便签保存失败，请稍后再试。')
      }

      const message = (await response.json()) as NoteMessage
      replaceMessages((current) => current.map((currentMessage) => currentMessage.id === optimisticId ? message : currentMessage), {
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
  }

  async function handleReaction(message: NoteMessage, value: 1 | -1) {
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
  }

  async function handleDelete(id: string) {
    if (!identity || pendingOptimisticIdsRef.current.has(id)) return

    const snapshot = buildOptimisticSnapshot(id, messagesRef.current, customPositionsRef.current, cardZIndicesRef.current)
    if (!snapshot) return

    setError(null)
    pendingOptimisticIdsRef.current.add(id)
    removeMessageFromSurface(id)

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
  }

  async function handleLoadMore() {
    if (isPending || isRefreshingBoard || !hasMore) {
      return
    }

    const requestKey = activeBoardQueryKeyRef.current

    try {
      const payload = await fetchBoardMessages(showArchived, sortMode, nextOffset, board.pageSize)
      if (requestKey !== activeBoardQueryKeyRef.current) {
        return
      }

      startTransition(() => {
        replaceMessages((current) => [...current, ...payload.messages], {
          nextOffset: payload.nextOffset,
          hasMore: payload.hasMore,
        })
      })
    } catch {
      if (requestKey === activeBoardQueryKeyRef.current) {
        setError('更多便签加载失败，请稍后重试。')
      }
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (editingMessage && isMobileViewport) {
      void saveEditingNote()
      return
    }

    void submitDraft()
  }

  const getTargetPosition = useCallback((index: number): NotePosition => {
    const layout = layouts[index]
    const fallbackX = Math.max((size.width - cardWidth) / 2, 0) + Math.min(index, 4) * 2
    const fallbackY = 22 + Math.min(index, 4) * 4

    return {
      x: layout?.x ?? fallbackX,
      y: layout?.y ?? fallbackY,
      rotation: layout?.rotation ?? (index % 2 === 0 ? -2 : 2),
    }
  }, [cardWidth, layouts, size.width])

  const noteItems: NoteCardViewModel[] = messages.map((message) => {
    const canDelete = getDeletePermission(board.slug, isAdmin, viewerIdentityAliases, message)
    const canEdit = getEditPermission(isAdmin, viewerIdentityAliases, message)
    const isEditing = editingNoteId === message.id
    const isPriorityUpdating = Boolean(priorityUpdatingIds[message.id])

    return {
      message,
      canDelete,
      canEdit,
      isEditing,
      isPriorityUpdating,
      isOptimistic: message.id.startsWith('optimistic-'),
      isFresh: Boolean(freshMessageIds[message.id]),
      actions: {
        delete: canDelete ? { onClick: () => void handleDelete(message.id) } : undefined,
        edit: canEdit ? { onClick: () => startEditingNote(message) } : undefined,
        archive: canEdit ? { archived: message.archived, onToggle: () => void handleToggleArchive(message) } : undefined,
      },
      priorityControl: priorityEnabled ? {
        value: message.priority ?? DEFAULT_NOTE_PRIORITY,
        onChange: canEdit ? (priority) => void handlePriorityChange(message, priority) : undefined,
        disabled: isPriorityUpdating || !canEdit,
      } : undefined,
      reactionControl: {
        upvotes: message.upvotes,
        downvotes: message.downvotes,
        viewerReaction: message.viewer_reaction,
        pending: Boolean(reactionUpdatingIds[message.id]),
        onReact: (value) => void handleReaction(message, value),
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
  })

  const boardState = useMemo<NoteBoardBoardState>(() => ({
    messages,
    noteItems,
    customPositions,
    cardZIndices,
    mobileView,
    hasMore,
    isPending,
    isRefreshingBoard,
    showArchived,
    sortMode,
    totalLoaded: messages.length,
    isMobileViewport: Boolean(isMobileViewport),
    viewportReady,
  }), [
    cardZIndices,
    customPositions,
    hasMore,
    isMobileViewport,
    isPending,
    isRefreshingBoard,
    messages,
    mobileView,
    noteItems,
    showArchived,
    sortMode,
    viewportReady,
  ])

  const editorState = useMemo<NoteBoardEditorState>(() => ({
    error,
    canWrite,
    priorityEnabled,
    loadingIdentity: loading,
    viewerIdentity,
    editingMessage,
    editorMode: isMobileViewport && editingMessage ? 'edit' : 'create',
    editorValue: isMobileViewport && editingMessage ? editContent : draft,
    editorSaving: isMobileViewport && editingMessage ? isUpdatingNote : isSubmitting,
    editorPriority: isMobileViewport && editingMessage ? editPriority : draftPriority,
    editorSectionLabel: isMobileViewport && editingMessage ? '便签编辑区' : (board.slug === 'guestbook' ? '留言区' : 'Memo 编辑区'),
    editorPlaceholder: isMobileViewport && editingMessage
      ? '直接修改这张便签的原始文本，checklist 状态也在这里编辑。'
      : (board.slug === 'guestbook'
        ? '写下想贴在主页上的留言，或直接插入 checklist。'
        : '写一条新的 Memo 便签，或直接插入 checklist。'),
    editorSaveLabel: isMobileViewport && editingMessage ? '保存编辑' : '贴上便签',
  }), [
    board.slug,
    canWrite,
    draft,
    draftPriority,
    editContent,
    editPriority,
    editingMessage,
    error,
    isMobileViewport,
    isSubmitting,
    isUpdatingNote,
    loading,
    priorityEnabled,
    viewerIdentity,
  ])

  const actions: NoteBoardActions = {
    toggleMobileView: () => setMobileView((current) => current === 'stack' ? 'list' : 'stack'),
    setCardPosition: (id, nextPosition) => setCustomPositions((current) => {
      const next = { ...current, [id]: nextPosition }
      customPositionsRef.current = next
      return next
    }),
    bringCardToFront,
    handleCardHeightChange,
    handleLoadMore,
    handleSubmit,
    handleSwitchArchiveView,
    handleSortModeChange,
    updateEditorValue: isMobileViewport && editingMessage ? setEditContent : setDraft,
    updateEditorPriority: isMobileViewport && editingMessage ? setEditPriority : setDraftPriority,
    submitEditor: isMobileViewport && editingMessage ? saveEditingNote : submitDraft,
    cancelEditingNote,
  }

  const metaValue = useMemo<NoteBoardMeta>(() => ({
    board,
    surface: {
      size,
      cardWidth,
      height,
      layouts,
      hasMeasured,
      isScattered,
      getTargetPosition,
    },
  }), [board, cardWidth, getTargetPosition, hasMeasured, height, isScattered, layouts, size])

  const bindings = useMemo<NoteBoardBindings>(() => ({
    bindContainer,
    bindEditorSection,
  }), [bindContainer, bindEditorSection])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    customPositionsRef.current = customPositions
  }, [customPositions])

  useEffect(() => {
    cardZIndicesRef.current = cardZIndices
  }, [cardZIndices])

  useEffect(() => {
    activeBoardQueryKeyRef.current = activeBoardQueryKey
  }, [activeBoardQueryKey])

  useEffect(() => {
    if (!boardPayload) {
      return
    }

    if (boardPayload.archived !== showArchived || boardPayload.sort !== sortMode) {
      return
    }

    if (isSameBoardSurfacePayload(boardPayload, messages, nextOffset, hasMore)) {
      return
    }

    startTransition(() => {
      resetBoardSurface(boardPayload.messages, {
        nextOffset: boardPayload.nextOffset,
        hasMore: boardPayload.hasMore,
      })
    })
  }, [boardPayload, hasMore, messages, nextOffset, resetBoardSurface, showArchived, sortMode])

  useEffect(() => {
    const element = containerElement
    if (!element) {
      setSize({ width: 0, height: 0 })
      return
    }

    const update = () => {
      setSize({ width: element.clientWidth, height: element.clientHeight })
    }

    update()

    const observer = new ResizeObserver(update)
    observer.observe(element)

    return () => observer.disconnect()
  }, [containerElement])

  useEffect(() => {
    setMeasuredHeights((current) => {
      const nextEntries = Object.entries(current).filter(([id]) => messages.some((message) => message.id === id))

      if (nextEntries.length === Object.keys(current).length) {
        return current
      }

      return Object.fromEntries(nextEntries)
    })
  }, [messages])

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_VIEWPORT_MAX_WIDTH}px)`)
    const syncViewport = () => setIsMobileViewport(mediaQuery.matches)

    syncViewport()
    mediaQuery.addEventListener('change', syncViewport)

    return () => {
      mediaQuery.removeEventListener('change', syncViewport)
    }
  }, [])

  useEffect(() => {
    if (!canInitializeSurface) return

    const frame = window.requestAnimationFrame(() => setIsScattered(true))
    return () => window.cancelAnimationFrame(frame)
  }, [canInitializeSurface])

  useEffect(() => {
    if (!canInitializeSurface) return

    setCustomPositions((current) => {
      let changed = false
      const next = { ...current }

      messages.forEach((message, index) => {
        if (next[message.id]) {
          return
        }

        next[message.id] = getTargetPosition(index)
        changed = true
      })

      if (changed) {
        customPositionsRef.current = next
      }

      return changed ? next : current
    })
  }, [canInitializeSurface, getTargetPosition, messages])

  useEffect(() => {
    setCardZIndices((current) => {
      const next: Record<string, number> = {}

      for (const message of messages) {
        next[message.id] = current[message.id] ?? zIndexCounterRef.current++
      }

      cardZIndicesRef.current = next

      return next
    })
  }, [messages])

  useEffect(() => {
    if (!editingNoteId) return
    if (!messages.some((message) => message.id === editingNoteId)) {
      setEditingNoteId(null)
      setEditContent('')
    }
  }, [editingNoteId, messages])

  useEffect(() => () => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current)
    }

    Object.values(freshTimerRefs.current).forEach((timer) => window.clearTimeout(timer))
  }, [])

  return (
    <NoteBoardMetaContext value={metaValue}>
      <NoteBoardBindingsContext value={bindings}>
        <NoteBoardActionsContext value={actions}>
          <NoteBoardBoardStateContext value={boardState}>
            <NoteBoardEditorStateContext value={editorState}>
              <NoteBoardToastContext value={toastNotice}>
                {children}
              </NoteBoardToastContext>
            </NoteBoardEditorStateContext>
          </NoteBoardBoardStateContext>
        </NoteBoardActionsContext>
      </NoteBoardBindingsContext>
    </NoteBoardMetaContext>
  )
}

export function useNoteBoardBoardState() {
  return useRequiredContext(NoteBoardBoardStateContext, 'useNoteBoardBoardState')
}

export function useNoteBoardEditorState() {
  return useRequiredContext(NoteBoardEditorStateContext, 'useNoteBoardEditorState')
}

export function useNoteBoardToast() {
  const toast = use(NoteBoardToastContext)
  if (typeof toast === 'undefined') {
    throw new Error('useNoteBoardToast must be used within NoteBoardProvider')
  }

  return toast
}

export function useNoteBoardActions() {
  return useRequiredContext(NoteBoardActionsContext, 'useNoteBoardActions')
}

export function useNoteBoardMeta() {
  return useRequiredContext(NoteBoardMetaContext, 'useNoteBoardMeta')
}

export function useNoteBoardBindings() {
  return useRequiredContext(NoteBoardBindingsContext, 'useNoteBoardBindings')
}

export function useNoteBoard(): NoteBoardContextValue {
  return {
    state: {
      ...useNoteBoardBoardState(),
      ...useNoteBoardEditorState(),
      toastNotice: useNoteBoardToast(),
    },
    actions: useNoteBoardActions(),
    meta: useNoteBoardMeta(),
    bindings: useNoteBoardBindings(),
  }
}