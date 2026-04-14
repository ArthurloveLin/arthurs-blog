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
  handleSwitchArchiveView: (archived: boolean) => Promise<void>
  handleSortModeChange: (nextSortMode: NoteSortMode) => Promise<void>
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

const NoteBoardContext = createContext<NoteBoardContextValue | null>(null)

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
  const [hasMore, setHasMore] = useState(initialMessages.length >= board.initialPageLimit)
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
  const [isRefreshingBoard, setIsRefreshingBoard] = useState(false)
  const [toastNotice, setToastNotice] = useState<ToastNotice | null>(null)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const zIndexCounterRef = useRef(initialSortedMessages.length + 2)
  const toastTimerRef = useRef<number | null>(null)
  const pendingOptimisticIdsRef = useRef<Set<string>>(new Set())
  const viewerIdentity = publicIdentity ?? ''
  const viewerIdentityAliases = identityAliases.length > 0 ? identityAliases : [identity].filter(Boolean)
  const canWrite = board.slug === 'guestbook' || isAdmin
  const priorityEnabled = board.slug === 'memo'
  const { cardWidth, height, layouts } = useMemo(
    () => computeBoardLayout(messages, size.width, measuredHeights),
    [measuredHeights, messages, size.width],
  )
  const hasMeasured = size.width > 0 && size.height > 0
  const canInitializeSurface = hasMeasured && (messages.length === 0 || messages.every((message) => measuredHeights[message.id] > 0))
  const editingMessage = useMemo(() => messages.find((message) => message.id === editingNoteId) ?? null, [messages, editingNoteId])

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

  function cancelEditingNote() {
    setEditingNoteId(null)
    setEditContent('')
    setEditPriority(DEFAULT_NOTE_PRIORITY)
    setError(null)
  }

  function replaceMessages(nextMessages: NoteMessage[], options: { resetPositions?: boolean; sort?: boolean } = {}) {
    const orderedMessages = options.sort ? sortBoardMessages(nextMessages, sortMode) : nextMessages
    setMessages(orderedMessages)

    if (options.resetPositions) {
      setCustomPositions({})
      setCardZIndices(Object.fromEntries(orderedMessages.map((message, index) => [message.id, orderedMessages.length - index + 1])))
    }
  }

  function removeMessageFromSurface(id: string) {
    setMessages((current) => current.filter((message) => message.id !== id))
    setCustomPositions((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    setNextOffset((current) => Math.max(current - 1, 0))

    if (editingNoteId === id) {
      cancelEditingNote()
    }
  }

  function restoreMessageSnapshot(snapshot: OptimisticMessageSnapshot) {
    setMessages((current) => {
      const withoutTarget = current.filter((message) => message.id !== snapshot.message.id)
      const next = [...withoutTarget]
      next.splice(Math.min(snapshot.index, next.length), 0, snapshot.message)
      return next
    })

    if (snapshot.customPosition) {
      const position = snapshot.customPosition
      setCustomPositions((current) => ({ ...current, [snapshot.message.id]: position }))
    }

    if (typeof snapshot.zIndex === 'number') {
      const zIndex = snapshot.zIndex
      setCardZIndices((current) => ({ ...current, [snapshot.message.id]: zIndex }))
    }

    setNextOffset((current) => current + 1)
  }

  function bringCardToFront(id: string) {
    setCardZIndices((current) => ({ ...current, [id]: zIndexCounterRef.current++ }))
  }

  const handleCardHeightChange = useCallback((id: string, nextHeight: number) => {
    setMeasuredHeights((current) => {
      if (current[id] === nextHeight) {
        return current
      }

      return { ...current, [id]: nextHeight }
    })
  }, [])

  function resetBoardSurface(nextMessages: NoteMessage[], archived: boolean, nextSortMode = sortMode) {
    const sortedMessages = sortBoardMessages(nextMessages, nextSortMode)

    setMessages(sortedMessages)
    setShowArchived(archived)
    setSortMode(nextSortMode)
    setNextOffset(sortedMessages.length)
    setHasMore(sortedMessages.length >= board.initialPageLimit)
    setCustomPositions({})
    setCardZIndices(Object.fromEntries(sortedMessages.map((message, index) => [message.id, sortedMessages.length - index + 1])))
    cancelEditingNote()
  }

  function startEditingNote(message: NoteMessage) {
    setEditingNoteId(message.id)
    setEditContent(message.content)
    setEditPriority(message.priority)
    setError(null)

    if (isMobileViewport) {
      scrollToEditor()
    }
  }

  async function fetchBoardMessages(archived: boolean, sort = sortMode, offset = 0, limit = board.initialPageLimit) {
    const response = await fetch(`/api/note-boards/${board.slug}?offset=${offset}&limit=${limit}&archived=${archived ? '1' : '0'}&sort=${sort}`)
    if (!response.ok) {
      throw new Error('便签加载失败，请稍后重试。')
    }

    return await response.json() as { messages: NoteMessage[]; nextOffset: number; hasMore: boolean }
  }

  async function handleSwitchArchiveView(archived: boolean) {
    if (archived === showArchived || isRefreshingBoard) return

    setIsRefreshingBoard(true)
    setError(null)

    try {
      const payload = await fetchBoardMessages(archived, sortMode)
      startTransition(() => {
        resetBoardSurface(payload.messages, archived, sortMode)
        setNextOffset(payload.nextOffset)
        setHasMore(payload.hasMore)
      })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '便签加载失败，请稍后重试。')
    } finally {
      setIsRefreshingBoard(false)
    }
  }

  async function handleToggleArchive(message: NoteMessage) {
    if (!identity || pendingOptimisticIdsRef.current.has(message.id)) return

    setError(null)
    pendingOptimisticIdsRef.current.add(message.id)
    const snapshot = buildOptimisticSnapshot(message.id, messages, customPositions, cardZIndices)
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

  async function handleSortModeChange(nextSortMode: NoteSortMode) {
    if (nextSortMode === sortMode || isRefreshingBoard) return

    setIsRefreshingBoard(true)
    setError(null)

    try {
      const payload = await fetchBoardMessages(showArchived, nextSortMode)
      startTransition(() => {
        resetBoardSurface(payload.messages, showArchived, nextSortMode)
        setNextOffset(payload.nextOffset)
        setHasMore(payload.hasMore)
      })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '便签加载失败，请稍后重试。')
    } finally {
      setIsRefreshingBoard(false)
    }
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
      replaceMessages(messages.map((current) => current.id === updatedMessage.id ? updatedMessage : current))
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
      replaceMessages(messages.map((message) => message.id === updatedMessage.id ? updatedMessage : message))
      cancelEditingNote()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : '便签更新失败，请稍后再试。')
    } finally {
      setIsUpdatingNote(false)
    }
  }

  async function submitDraft() {
    if (!draft.trim() || !identity || !canWrite || isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/note-boards/${board.slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: publicIdentity, content: draft.trim(), priority: draftPriority }),
      })

      if (!response.ok) {
        throw new Error(response.status === 403 ? '当前身份没有写入权限。' : '便签保存失败，请稍后再试。')
      }

      const message = (await response.json()) as NoteMessage
      replaceMessages([message, ...messages], { resetPositions: true })
      setNextOffset((current) => current + 1)
      setDraft('')
      setDraftPriority(DEFAULT_NOTE_PRIORITY)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '便签保存失败，请稍后再试。')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!identity || pendingOptimisticIdsRef.current.has(id)) return

    const snapshot = buildOptimisticSnapshot(id, messages, customPositions, cardZIndices)
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
    const response = await fetch(`/api/note-boards/${board.slug}?offset=${nextOffset}&limit=${board.pageSize}&archived=${showArchived ? '1' : '0'}&sort=${sortMode}`)
    if (!response.ok) {
      setError('更多便签加载失败，请稍后重试。')
      return
    }

    const payload = await response.json() as { messages: NoteMessage[]; nextOffset: number; hasMore: boolean }
    startTransition(() => {
      replaceMessages([...messages, ...payload.messages])
      setNextOffset(payload.nextOffset)
      setHasMore(payload.hasMore)
    })
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
      inlineEditor: isEditing ? {
        value: editContent,
        isSaving: isUpdatingNote,
        onChange: setEditContent,
        onSave: () => void saveEditingNote(),
        onCancel: cancelEditingNote,
      } : undefined,
    }
  })

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

      return changed ? next : current
    })
  }, [canInitializeSurface, getTargetPosition, messages])

  useEffect(() => {
    setCardZIndices((current) => {
      const next: Record<string, number> = {}

      for (const message of messages) {
        next[message.id] = current[message.id] ?? zIndexCounterRef.current++
      }

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
  }, [])

  const isMobileEditorMode = isMobileViewport && Boolean(editingMessage)
  const editorSectionLabel = isMobileEditorMode ? '便签编辑区' : (board.slug === 'guestbook' ? '留言区' : 'Memo 编辑区')
  const defaultEditorPlaceholder = board.slug === 'guestbook'
    ? '写下想贴在主页上的留言，或直接插入 checklist。'
    : '写一条新的 Memo 便签，或直接插入 checklist。'
  const editorPlaceholder = isMobileEditorMode
    ? '直接修改这张便签的原始文本，checklist 状态也在这里编辑。'
    : defaultEditorPlaceholder
  const editorSaveLabel = isMobileEditorMode ? '保存编辑' : '贴上便签'
  const editorValue = isMobileEditorMode ? editContent : draft
  const editorSaving = isMobileEditorMode ? isUpdatingNote : isSubmitting
  const editorPriority = isMobileEditorMode ? editPriority : draftPriority

  const value: NoteBoardContextValue = {
    state: {
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
      toastNotice,
      error,
      canWrite,
      priorityEnabled,
      loadingIdentity: loading,
      viewerIdentity,
      totalLoaded: messages.length,
      editingMessage,
      editorMode: isMobileEditorMode ? 'edit' : 'create',
      editorValue,
      editorSaving,
      editorPriority,
      editorSectionLabel,
      editorPlaceholder,
      editorSaveLabel,
    },
    actions: {
      toggleMobileView: () => setMobileView((current) => current === 'stack' ? 'list' : 'stack'),
      setCardPosition: (id, nextPosition) => setCustomPositions((current) => ({ ...current, [id]: nextPosition })),
      bringCardToFront,
      handleCardHeightChange,
      handleLoadMore,
      handleSubmit,
      handleSwitchArchiveView,
      handleSortModeChange,
      updateEditorValue: isMobileEditorMode ? setEditContent : setDraft,
      updateEditorPriority: isMobileEditorMode ? setEditPriority : setDraftPriority,
      submitEditor: isMobileEditorMode ? saveEditingNote : submitDraft,
      cancelEditingNote,
    },
    meta: {
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
    },
    bindings: {
      bindContainer,
      bindEditorSection,
    },
  }

  return <NoteBoardContext value={value}>{children}</NoteBoardContext>
}

export function useNoteBoard() {
  const context = use(NoteBoardContext)
  if (!context) {
    throw new Error('useNoteBoard must be used within NoteBoardProvider')
  }

  return context
}