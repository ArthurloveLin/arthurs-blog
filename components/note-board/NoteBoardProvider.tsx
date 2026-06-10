'use client'

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@/components/AuthProvider'
import type {
  NoteCardViewModel,
  NotePosition,
  Size,
  ToastNotice,
} from '@/components/note-board/types'
import { computeBoardLayout } from '@/components/note-board/utils/board'
import type { NotePriority, NoteSortDirection, NoteSortMode } from '@/lib/note-priority'
import type { NoteBoardViewConfig } from '@/lib/note-board-config'
import type { NoteMessage, NoteVisibility } from '@/lib/note-boards'

import { parseHashtags } from './utils/editor'
import { useNotifications } from './hooks/useNotifications'
import { useViewportDetection } from './hooks/useViewportDetection'
import { useBoardSurface } from './hooks/useBoardSurface'
import { useBoardData } from './hooks/useBoardData'
import { useNoteEditor } from './hooks/useNoteEditor'
import { useBoardMutations } from './hooks/useBoardMutations'
import { useBoardNoteItems } from './hooks/useBoardNoteItems'
import type { BoardSurfaceRefs } from './hooks/useBoardData'

interface NoteBoardProviderProps {
  board: NoteBoardViewConfig
  initialMessages: NoteMessage[]
  initialQuery?: string
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
  sortDirection: NoteSortDirection
  currentPage: number
  pageSize: number
  visibleCount: number
  hasPreviousPage: boolean
  hasNextPage: boolean
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
  computeLayoutForMessages: (messages: NoteMessage[], cardWidth?: number) => ReturnType<typeof computeBoardLayout>
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
  handlePreviousPage: () => void
  handleNextPage: () => Promise<void>
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  handleSwitchArchiveView: (archived: boolean) => void
  handleSortModeChange: (nextSortMode: NoteSortMode) => void
  handleToggleSortDirection: () => void
  handleSearch: (q: string) => void
  handleTagFilter: (tag: string) => void
  handleDateFilter: (date: string | null) => void
  handleDueDateFilter: (date: string | null) => void
  showToast: (message: string) => void
  updateEditorValue: (value: string) => void
  updateEditorPriority: (value: NotePriority) => void
  updateEditorVisibility: (value: NoteVisibility) => void
  submitEditor: () => Promise<void>
  cancelEditingNote: () => void
  scrollToEditor: () => void
}

interface NoteBoardContextValue {
  state: NoteBoardState
  actions: NoteBoardActions
  meta: NoteBoardMeta
  bindings: NoteBoardBindings
}

interface NoteBoardBoardState {
  messages: NoteMessage[]
  noteItems: NoteCardViewModel[]
  allNoteItems: NoteCardViewModel[]
  customPositions: Record<string, NotePosition>
  cardZIndices: Record<string, number>
  mobileView: 'stack' | 'list'
  hasMore: boolean
  isPending: boolean
  isRefreshingBoard: boolean
  showArchived: boolean
  sortMode: NoteSortMode
  sortDirection: NoteSortDirection
  searchQuery: string
  activeTags: string[]
  activeDate: string | null
  activeDueDate: string | null
  allTags: { name: string; count: number }[]
  currentPage: number
  pageSize: number
  visibleCount: number
  hasPreviousPage: boolean
  hasNextPage: boolean
  totalLoaded: number
  isMobileViewport: boolean
  viewportReady: boolean
}

interface NoteBoardEditorState {
  error: string | null
  canWrite: boolean
  priorityEnabled: boolean
  isAdmin: boolean
  loadingIdentity: boolean
  viewerIdentity: string
  editingMessage: NoteMessage | null
  editorMode: 'create' | 'edit'
  editorValue: string
  editorSaving: boolean
  editorPriority: NotePriority
  editorVisibility: NoteVisibility
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
const DESKTOP_NOTES_PER_PAGE = 10

const noopSetCustomPositions: BoardSurfaceRefs['setCustomPositions'] = () => undefined
const noopSetCardZIndices: BoardSurfaceRefs['setCardZIndices'] = () => undefined
const noopSetMeasuredHeights: BoardSurfaceRefs['setMeasuredHeights'] = () => undefined

function createInitialSurfaceRefs(): BoardSurfaceRefs {
  return {
    setCustomPositions: noopSetCustomPositions,
    customPositionsRef: { current: {} },
    setCardZIndices: noopSetCardZIndices,
    cardZIndicesRef: { current: {} },
    recordedHeightIdsRef: { current: new Set<string>() },
    setMeasuredHeights: noopSetMeasuredHeights,
  }
}

function useRequiredContext<T>(context: React.Context<T | null>, name: string) {
  const value = use(context)
  if (!value) {
    throw new Error(`${name} must be used within NoteBoardProvider`)
  }

  return value
}

export function NoteBoardProvider({ board, initialMessages, initialQuery = '', children }: NoteBoardProviderProps) {
  const { identity, identityAliases, isAdmin, loading, publicIdentity } = useAuth()
  
  const [error, setError] = useState<string | null>(null)
  
  const viewerIdentity = publicIdentity ?? ''
  const reactionIdentity = identity?.trim() ?? ''
  const viewerIdentityAliases = useMemo(
    () => identityAliases.length > 0 ? identityAliases : [identity].filter(Boolean),
    [identity, identityAliases],
  )
  const canWrite = board.slug === 'guestbook' || isAdmin
  const priorityEnabled = board.slug === 'memo'

  const { toastNotice, freshMessageIds, showToast, markMessageFresh } = useNotifications()
  const { isMobileViewport, isDesktopViewport, viewportReady } = useViewportDetection()

  const cancelEditingNoteRef = useRef<() => void>(() => {})
  const surfaceRefs = useRef<BoardSurfaceRefs>(createInitialSurfaceRefs())
  
  const {
    messages,
    visibleMessages,
    nextOffset,
    hasMore,
    currentPageIndex,
    showArchived,
    sortMode,
    sortDirection,
    searchQuery,
    activeTags,
    activeDate,
    activeDueDate,
    isPending,
    isRefreshingBoard,
    messagesRef,
    loadedDesktopPageCount,
    replaceMessages,
    removeMessageFromSurface,
    restoreMessageSnapshot,
    handleSwitchArchiveView,
    handleSortModeChange,
    handleToggleSortDirection,
    handleSearch,
    handleTagFilter,
    handleDateFilter,
    handleDueDateFilter,
    handleLoadMore,
    handlePreviousPage,
    handleNextPage,
  } = useBoardData({
    board,
    initialMessages,
    initialQuery,
    initialSortMode: board.slug === 'memo' ? 'priority' : 'time',
    reactionIdentity,
    isDesktopViewport,
    cancelEditingNoteRef,
    surfaceRefs,
    setError,
  })

  const {
    editorSectionElement,
    size,
    measuredHeights,
    customPositions,
    cardZIndices,
    isScattered,
    mobileView,
    cardWidth,
    height,
    layouts,
    computeLayoutForMessages,
    hasMeasured,
    getTargetPosition,
    bindContainer,
    bindEditorSection,
    toggleMobileView,
    setCardPosition,
    bringCardToFront,
    handleCardHeightChange,
    setMeasuredHeights,
    setCustomPositions,
    setCardZIndices,
    recordedHeightIdsRef,
    customPositionsRef,
    cardZIndicesRef,
  } = useBoardSurface({
    messages,
    visibleMessages,
    initialMessages,
  })

  // Bind the surface methods and refs to the surfaceRefs so SWR data fetch operations 
  // can update surface locations
  useLayoutEffect(() => {
    surfaceRefs.current = {
      setCustomPositions,
      customPositionsRef,
      setCardZIndices,
      cardZIndicesRef,
      recordedHeightIdsRef,
      setMeasuredHeights,
    }
  }, [setCustomPositions, customPositionsRef, setCardZIndices, cardZIndicesRef, recordedHeightIdsRef, setMeasuredHeights])

  const {
    draft,
    setDraft,
    draftPriority,
    setDraftPriority,
    draftVisibility,
    setDraftVisibility,
    editingNoteId,
    editContent,
    setEditContent,
    editPriority,
    setEditPriority,
    editVisibility,
    setEditVisibility,
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
  } = useNoteEditor({
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
    error,
    setError,
  })

  // Update the ref so data-layer can call cancelEditingNote
  useEffect(() => {
    cancelEditingNoteRef.current = cancelEditingNote
  }, [cancelEditingNote])

  const {
    priorityUpdatingIds,
    reactionUpdatingIds,
    emojiUpdatingIds,
    handleReaction,
    handleEmojiReaction,
    handleDelete,
    handleToggleArchive,
    handlePriorityChange,
  } = useBoardMutations({
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
  })

  // Tag counts are derived from the resident `messages` of the CURRENT view, so they
  // reflect active vs archived correctly. (The old /memo/tags endpoint hardcoded
  // archived:false and showed active counts even in the archived view.) Computing from
  // messages also keeps counts reactive to optimistic create/delete.
  const allTags = useMemo<{ name: string; count: number }[]>(() => {
    const counts = new Map<string, number>()
    for (const message of messages) {
      for (const tag of parseHashtags(message.content)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [messages])

  const { noteItems: allNoteItems } = useBoardNoteItems({
    visibleMessages: messages,
    boardSlug: board.slug,
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
    toggleChecklistItem,
    cancelEditingNote,
    setEditContent,
  })

  const noteItems = useMemo(() => {
    if (visibleMessages === messages) {
      return allNoteItems
    }

    const itemsById = new Map(allNoteItems.map((item) => [item.message.id, item]))
    return visibleMessages.flatMap((message) => {
      const item = itemsById.get(message.id)
      return item ? [item] : []
    })
  }, [allNoteItems, messages, visibleMessages])

  const handleSubmit = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (editingMessage && isMobileViewport) {
      void saveEditingNote()
      return
    }

    void submitDraft()
  }, [editingMessage, isMobileViewport, saveEditingNote, submitDraft])

  const boardState = useMemo<NoteBoardBoardState>(() => ({
    messages: visibleMessages,
    noteItems,
    allNoteItems,
    customPositions,
    cardZIndices,
    mobileView,
    hasMore,
    isPending,
    isRefreshingBoard,
    showArchived,
    sortMode,
    sortDirection,
    searchQuery,
    activeTags,
    activeDate,
    activeDueDate,
    allTags,
    currentPage: isDesktopViewport ? currentPageIndex + 1 : 1,
    pageSize: DESKTOP_NOTES_PER_PAGE,
    visibleCount: visibleMessages.length,
    hasPreviousPage: isDesktopViewport && currentPageIndex > 0,
    hasNextPage: isDesktopViewport && (currentPageIndex + 1 < loadedDesktopPageCount || hasMore),
    totalLoaded: messages.length,
    isMobileViewport: Boolean(isMobileViewport),
    viewportReady,
  }), [
    allNoteItems,
    allTags,
    activeDate,
    activeDueDate,
    activeTags,
    cardZIndices,
    currentPageIndex,
    customPositions,
    hasMore,
    isDesktopViewport,
    isMobileViewport,
    isPending,
    isRefreshingBoard,
    loadedDesktopPageCount,
    messages,
    mobileView,
    noteItems,
    searchQuery,
    showArchived,
    sortDirection,
    sortMode,
    visibleMessages,
    viewportReady,
  ])

  const editorState = useMemo<NoteBoardEditorState>(() => ({
    error,
    canWrite,
    priorityEnabled,
    isAdmin,
    loadingIdentity: loading,
    viewerIdentity,
    editingMessage,
    editorMode: editingMessage ? 'edit' : 'create',
    editorValue: editingMessage ? editContent : draft,
    editorSaving: editingMessage ? isUpdatingNote : isSubmitting,
    editorPriority: editingMessage ? editPriority : draftPriority,
    editorVisibility: editingMessage ? editVisibility : draftVisibility,
    editorSectionLabel: editingMessage ? '便签编辑区' : (board.slug === 'guestbook' ? '留言区' : 'Memo 编辑区'),
    editorPlaceholder: editingMessage
      ? '直接修改这张便签的原始文本，checklist 状态也在这里编辑。'
      : (board.slug === 'guestbook'
        ? '写下想贴在主页上的留言，或直接插入 checklist。'
        : '写一条新的 Memo 便签，或直接插入 checklist。'),
    editorSaveLabel: editingMessage ? '保存编辑' : '贴上便签',
  }), [
    board.slug,
    canWrite,
    draft,
    draftPriority,
    draftVisibility,
    editContent,
    editPriority,
    editVisibility,
    editingMessage,
    error,
    isAdmin,
    isSubmitting,
    isUpdatingNote,
    loading,
    priorityEnabled,
    viewerIdentity,
  ])

  const actions = useMemo<NoteBoardActions>(() => ({
    toggleMobileView,
    setCardPosition,
    bringCardToFront,
    handleCardHeightChange,
    handleLoadMore,
    handlePreviousPage,
    handleNextPage,
    handleSubmit,
    handleSwitchArchiveView,
    handleSortModeChange,
    handleToggleSortDirection,
    handleSearch,
    handleTagFilter,
    handleDateFilter,
    handleDueDateFilter,
    showToast,
    updateEditorValue: editingMessage ? setEditContent : setDraft,
    updateEditorPriority: editingMessage ? setEditPriority : setDraftPriority,
    updateEditorVisibility: editingMessage ? setEditVisibility : setDraftVisibility,
    submitEditor: editingMessage ? saveEditingNote : submitDraft,
    cancelEditingNote,
    scrollToEditor,
  }), [
    bringCardToFront,
    cancelEditingNote,
    editingMessage,
    handleCardHeightChange,
    handleLoadMore,
    handleNextPage,
    handlePreviousPage,
    handleSearch,
    handleSortModeChange,
    handleToggleSortDirection,
    handleSubmit,
    handleSwitchArchiveView,
    handleTagFilter,
    handleDateFilter,
    handleDueDateFilter,
    showToast,
    saveEditingNote,
    setCardPosition,
    setDraft,
    setDraftPriority,
    setDraftVisibility,
    setEditContent,
    setEditPriority,
    setEditVisibility,
    scrollToEditor,
    submitDraft,
    toggleMobileView,
  ])

  const metaValue = useMemo<NoteBoardMeta>(() => ({
    board,
    surface: {
      size,
      cardWidth,
      height,
      layouts,
      computeLayoutForMessages,
      hasMeasured,
      isScattered,
      getTargetPosition,
    },
  }), [board, cardWidth, computeLayoutForMessages, getTargetPosition, hasMeasured, height, isScattered, layouts, size])

  const bindings = useMemo<NoteBoardBindings>(() => ({
    bindContainer,
    bindEditorSection,
  }), [bindContainer, bindEditorSection])

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
