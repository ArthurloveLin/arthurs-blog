import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import useSWR from 'swr'
import type { NoteBoardListPayload, NotePosition, OptimisticMessageSnapshot } from '@/components/note-board/types'
import { createBoardPayload, isSameBoardSurfacePayload, sortBoardMessages } from '@/components/note-board/utils/board'
import { applyViewerStateToComments, createCommentRecord, type Comment, type CommentViewerState } from '@/lib/comments'
import { fetchEngagementPublicApi } from '@/lib/engagement-public-api'
import { createGuestbookMessagesFromComments } from '@/lib/guestbook-comments'
import type { NoteSortDirection, NoteSortMode } from '@/lib/note-priority'
import type { NoteBoardViewConfig } from '@/lib/note-board-config'
import type { NoteMessage } from '@/lib/note-boards'

const DESKTOP_NOTES_PER_PAGE = 10

function getBoardQueryKey(
  boardSlug: string,
  archived: boolean,
  sort: NoteSortMode,
  direction: NoteSortDirection,
  searchQuery: string,
  activeTags: string[],
  activeDate: string | null,
) {
  return `note-board:${boardSlug}:${archived ? 'archived' : 'active'}:${sort}:${direction}:q=${searchQuery}:tags=${[...activeTags].sort().join(',')}:date=${activeDate ?? ''}`
}

export interface UseBoardDataProps {
  board: NoteBoardViewConfig
  initialMessages: NoteMessage[]
  initialQuery?: string
  reactionIdentity: string | undefined
  isDesktopViewport: boolean
  cancelEditingNoteRef: React.MutableRefObject<() => void>
  surfaceRefs: React.MutableRefObject<BoardSurfaceRefs>
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

export interface BoardSurfaceRefs {
  setCustomPositions: React.Dispatch<React.SetStateAction<Record<string, NotePosition>>>
  customPositionsRef: React.MutableRefObject<Record<string, NotePosition>>
  setCardZIndices: React.Dispatch<React.SetStateAction<Record<string, number>>>
  cardZIndicesRef: React.MutableRefObject<Record<string, number>>
  recordedHeightIdsRef: React.MutableRefObject<Set<string>>
  setMeasuredHeights: React.Dispatch<React.SetStateAction<Record<string, number>>>
}

export function useBoardData({
  board,
  initialMessages,
  initialQuery = '',
  reactionIdentity,
  isDesktopViewport,
  cancelEditingNoteRef,
  surfaceRefs,
  setError,
}: UseBoardDataProps) {
  const initialSortedMessages = useMemo(() => sortBoardMessages(initialMessages, 'time', 'desc'), [initialMessages])
  const initialHasMore = initialMessages.length >= board.initialPageLimit

  const [messages, setMessages] = useState(initialSortedMessages)
  const [nextOffset, setNextOffset] = useState(initialMessages.length)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [showArchived, setShowArchived] = useState(false)
  const [sortMode, setSortMode] = useState<NoteSortMode>('time')
  const [sortDirection, setSortDirection] = useState<NoteSortDirection>('desc')
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [activeDate, setActiveDate] = useState<string | null>(null)
  const [activeDueDate, setActiveDueDate] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const messagesRef = useRef(initialSortedMessages)
  // Tracks the last boardPayload reference seen by the SWR-sync effect.
  // When nextOffset/hasMore change from an optimistic removal, the effect
  // fires before SWR's mutateBoardPayload resolves (boardPayload is stale).
  // Comparing by reference lets us skip that window and prevent a spurious
  // resetBoardSurface that would revert the optimistic update.
  const lastBoardPayloadRef = useRef<typeof boardPayload | undefined>(undefined)
  const activeBoardQueryKey = useMemo(
    () => getBoardQueryKey(board.slug, showArchived, sortMode, sortDirection, searchQuery, activeTags, activeDate) + `:${reactionIdentity || 'anon'}`,
    [activeDate, activeTags, board.slug, reactionIdentity, searchQuery, showArchived, sortDirection, sortMode],
  )
  const initialBoardQueryKeyRef = useRef<string | null>(null)
  if (initialBoardQueryKeyRef.current === null) {
    initialBoardQueryKeyRef.current = activeBoardQueryKey
  }
  const activeBoardQueryKeyRef = useRef(activeBoardQueryKey)

  const loadedDesktopPageCount = Math.max(1, Math.ceil(messages.length / DESKTOP_NOTES_PER_PAGE))
  const visibleMessages = useMemo(() => {
    if (!isDesktopViewport) {
      return messages
    }

    const start = currentPageIndex * DESKTOP_NOTES_PER_PAGE
    return messages.slice(start, start + DESKTOP_NOTES_PER_PAGE)
  }, [currentPageIndex, isDesktopViewport, messages])

  const initialBoardPayload = useMemo(
    () => createBoardPayload(initialSortedMessages, false, 'time', 'desc', initialSortedMessages.length, initialHasMore),
    [initialHasMore, initialSortedMessages],
  )

  const fetchBoardMessages = useCallback(async (
    archived: boolean,
    sort = sortMode,
    direction = sortDirection,
    offset = 0,
    limit = board.initialPageLimit,
    q = searchQuery,
    tags = activeTags,
    date = activeDate,
  ) => {
    if (board.slug === 'guestbook') {
      const threadSearchParams = new URLSearchParams({
        target_type: board.targetType,
        target_id: board.targetId,
        archived: archived ? '1' : '0',
        offset: String(offset),
        limit: String(limit),
        sort,
        direction,
      })

      if (q.trim()) {
        threadSearchParams.set('q', q.trim())
      } else if (tags.length > 0) {
        threadSearchParams.set('tag', tags.join(','))
      }

      const viewerStatePromise = reactionIdentity
        ? (async () => {
            const viewerStateSearchParams = new URLSearchParams({
              target_type: board.targetType,
              target_id: board.targetId,
              identity: reactionIdentity,
            })

            const viewerStateResponse = await fetch(`/api/comments/viewer-state?${viewerStateSearchParams.toString()}`)
            if (!viewerStateResponse.ok) {
              return null
            }

            return viewerStateResponse.json().catch(() => null)
          })()
        : Promise.resolve(null)

      const [threadResponse, viewerStatePayload] = await Promise.all([
        fetchEngagementPublicApi(`/api/comments?${threadSearchParams.toString()}`),
        viewerStatePromise,
      ])

      if (!threadResponse.ok) {
        throw new Error('便签加载失败，请稍后重试。')
      }

      const threadPayload = await threadResponse.json().catch(() => null)
      if (!Array.isArray(threadPayload)) {
        throw new Error('便签加载失败，请稍后重试。')
      }

      let comments = threadPayload.map((entry) => createCommentRecord(entry as Comment))

      if (Array.isArray(viewerStatePayload)) {
        comments = applyViewerStateToComments(comments, viewerStatePayload as CommentViewerState[])
      }

      const nextMessages = createGuestbookMessagesFromComments(comments, archived)
      const nextOffsetHeader = Number.parseInt(threadResponse.headers.get('X-Comment-Thread-Next-Offset') ?? '', 10)
      const hasMoreHeader = threadResponse.headers.get('X-Comment-Thread-Has-More')
      const nextOffsetValue = Number.isFinite(nextOffsetHeader) ? nextOffsetHeader : offset + nextMessages.length
      const hasMoreValue = hasMoreHeader === '1'

      return createBoardPayload(
        nextMessages,
        archived,
        sort,
        direction,
        nextOffsetValue,
        hasMoreValue,
      )
    }

    const searchParams = new URLSearchParams({
      offset: String(offset),
      limit: String(limit),
      archived: archived ? '1' : '0',
      sort,
      direction,
    })

    if (reactionIdentity) {
      searchParams.set('identity', reactionIdentity)
    }

    if (q.trim()) {
      searchParams.set('q', q.trim())
    } else {
      if (tags.length > 0) searchParams.set('tag', tags.join(','))
      if (date) searchParams.set('date', date)
    }

    const response = await fetch(`/api/note-boards/${board.slug}?${searchParams.toString()}`)
    if (!response.ok) {
      throw new Error('便签加载失败，请稍后重试。')
    }

    const payload = await response.json() as { messages: NoteMessage[]; nextOffset: number; hasMore: boolean }
    return createBoardPayload(payload.messages, archived, sort, direction, payload.nextOffset, payload.hasMore)
  }, [activeDate, activeTags, board.initialPageLimit, board.slug, board.targetId, board.targetType, reactionIdentity, searchQuery, sortDirection, sortMode])

  const {
    data: boardPayload,
    isLoading: isBoardLoading,
    isValidating: isBoardValidating,
    mutate: mutateBoardPayload,
  } = useSWR<NoteBoardListPayload>(
    activeBoardQueryKey,
    () => fetchBoardMessages(showArchived, sortMode, sortDirection),
    {
      fallbackData: initialBoardPayload,
      revalidateOnMount: activeBoardQueryKey !== initialBoardQueryKeyRef.current,
      revalidateOnFocus: false,
    },
  )
  const isRefreshingBoard = isBoardLoading || isBoardValidating

  const replaceMessages = useCallback((
    nextMessagesOrUpdater: NoteMessage[] | ((current: NoteMessage[]) => NoteMessage[]),
    options: { resetPositions?: boolean; sort?: boolean; hasMore?: boolean; nextOffset?: number } = {},
  ) => {
    const nextMessages = typeof nextMessagesOrUpdater === 'function'
      ? nextMessagesOrUpdater(messagesRef.current)
      : nextMessagesOrUpdater
    const orderedMessages = options.sort === false ? nextMessages : sortBoardMessages(nextMessages, sortMode, sortDirection)

    messagesRef.current = orderedMessages
    setMessages(orderedMessages)

    if (typeof options.nextOffset === 'number') {
      setNextOffset(options.nextOffset)
    }

    if (typeof options.hasMore === 'boolean') {
      setHasMore(options.hasMore)
    }

    if (options.resetPositions) {
      surfaceRefs.current.setCustomPositions({})
      surfaceRefs.current.customPositionsRef.current = {}
      const nextZIndices = Object.fromEntries(orderedMessages.map((message, index) => [message.id, orderedMessages.length - index + 1]))
      surfaceRefs.current.cardZIndicesRef.current = nextZIndices
      surfaceRefs.current.setCardZIndices(nextZIndices)
    }

    void mutateBoardPayload((current) => current ? {
      ...current,
      messages: orderedMessages,
      nextOffset: typeof options.nextOffset === 'number' ? options.nextOffset : current.nextOffset,
      hasMore: typeof options.hasMore === 'boolean' ? options.hasMore : current.hasMore,
      sort: sortMode,
      sortDirection,
    } : current, { revalidate: false })
  }, [mutateBoardPayload, sortDirection, sortMode, surfaceRefs])

  const resetBoardSurface = useCallback((nextMessages: NoteMessage[], payload?: Pick<NoteBoardListPayload, 'nextOffset' | 'hasMore'>) => {
    const sortedMessages = sortBoardMessages(nextMessages, sortMode, sortDirection)

    messagesRef.current = sortedMessages
    setMessages(sortedMessages)
    setNextOffset(payload?.nextOffset ?? sortedMessages.length)
    setHasMore(payload?.hasMore ?? sortedMessages.length >= board.initialPageLimit)
    surfaceRefs.current.setCustomPositions({})
    surfaceRefs.current.customPositionsRef.current = {}
    const nextZIndices = Object.fromEntries(sortedMessages.map((message, index) => [message.id, sortedMessages.length - index + 1]))
    surfaceRefs.current.cardZIndicesRef.current = nextZIndices
    surfaceRefs.current.setCardZIndices(nextZIndices)
    surfaceRefs.current.recordedHeightIdsRef.current.clear()
    surfaceRefs.current.setMeasuredHeights((current) => {
      const allowed = new Set(sortedMessages.map((message) => message.id))
      return Object.fromEntries(Object.entries(current).filter(([id]) => allowed.has(id)))
    })
    
    if (cancelEditingNoteRef.current) {
      cancelEditingNoteRef.current()
    }
  }, [board.initialPageLimit, cancelEditingNoteRef, sortDirection, sortMode, surfaceRefs])

  const removeMessageFromSurface = useCallback((id: string, editingNoteId?: string | null) => {
    replaceMessages((current) => current.filter((message) => message.id !== id), {
      hasMore,
      nextOffset: Math.max(nextOffset - 1, 0),
      resetPositions: true,
    })

    // Positions and Z-indices are already cleared by resetPositions: true

    if (editingNoteId === id && cancelEditingNoteRef.current) {
      cancelEditingNoteRef.current()
    }
  }, [cancelEditingNoteRef, hasMore, nextOffset, replaceMessages])

  const restoreMessageSnapshot = useCallback((snapshot: OptimisticMessageSnapshot) => {
    setMessages((current) => {
      const withoutTarget = current.filter((message) => message.id !== snapshot.message.id)
      const next = [...withoutTarget]
      next.splice(Math.min(snapshot.index, next.length), 0, snapshot.message)
      messagesRef.current = next
      return next
    })

    if (snapshot.customPosition) {
      const position = snapshot.customPosition
      surfaceRefs.current.setCustomPositions((current) => {
        const next = { ...current, [snapshot.message.id]: position }
        surfaceRefs.current.customPositionsRef.current = next
        return next
      })
    }

    if (typeof snapshot.zIndex === 'number') {
      const zIndex = snapshot.zIndex
      surfaceRefs.current.setCardZIndices((current) => {
        const next = { ...current, [snapshot.message.id]: zIndex }
        surfaceRefs.current.cardZIndicesRef.current = next
        return next
      })
    }

    setNextOffset((current) => current + 1)
  }, [surfaceRefs])

  const handleSearch = useCallback((q: string) => {
    if (q === searchQuery) return
    setError(null)
    setCurrentPageIndex(0)
    setActiveTags([])
    setActiveDate(null)
    setActiveDueDate(null)
    setSearchQuery(q)
  }, [searchQuery, setError])

  const handleTagFilter = useCallback((tag: string) => {
    setError(null)
    setCurrentPageIndex(0)
    setSearchQuery('')
    setActiveDate(null)
    setActiveDueDate(null)
    if (!tag) {
      setActiveTags([])
      return
    }
    setActiveTags((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]
    )
  }, [setError])

  const handleDateFilter = useCallback((date: string | null) => {
    setError(null)
    setCurrentPageIndex(0)
    setSearchQuery('')
    setActiveTags([])
    setActiveDueDate(null)
    setActiveDate(date)
  }, [setError])

  const handleDueDateFilter = useCallback((date: string | null) => {
    setError(null)
    setCurrentPageIndex(0)
    setSearchQuery('')
    setActiveTags([])
    setActiveDate(null)
    setActiveDueDate(date)
  }, [setError])

  const handleSwitchArchiveView = useCallback((archived: boolean) => {
    if (archived === showArchived || isRefreshingBoard) return

    setError(null)
    setSearchQuery('')
    setActiveTags([])
    setActiveDate(null)
    setActiveDueDate(null)
    if (cancelEditingNoteRef.current) {
      cancelEditingNoteRef.current()
    }
    surfaceRefs.current.recordedHeightIdsRef.current.clear()
    setCurrentPageIndex(0)
    setShowArchived(archived)
  }, [isRefreshingBoard, showArchived, setError, cancelEditingNoteRef, surfaceRefs])

  const handleSortModeChange = useCallback((nextSortMode: NoteSortMode) => {
    if (nextSortMode === sortMode || isRefreshingBoard) return

    setError(null)
    if (cancelEditingNoteRef.current) {
      cancelEditingNoteRef.current()
    }
    setCurrentPageIndex(0)
    setSearchQuery('')
    setActiveTags([])
    setActiveDate(null)
    setActiveDueDate(null)
    setSortMode(nextSortMode)
  }, [isRefreshingBoard, sortMode, setError, cancelEditingNoteRef])

  const handleToggleSortDirection = useCallback(() => {
    if (isRefreshingBoard) return

    setError(null)
    if (cancelEditingNoteRef.current) {
      cancelEditingNoteRef.current()
    }
    setCurrentPageIndex(0)
    setSearchQuery('')
    setActiveTags([])
    setActiveDate(null)
    setActiveDueDate(null)
    setSortDirection((current) => current === 'desc' ? 'asc' : 'desc')
  }, [isRefreshingBoard, setError, cancelEditingNoteRef])

  const handleLoadMore = useCallback(async () => {
    if (isPending || isRefreshingBoard || !hasMore) {
      return
    }

    const requestKey = activeBoardQueryKeyRef.current

    try {
      const payload = await fetchBoardMessages(showArchived, sortMode, sortDirection, nextOffset, board.pageSize)
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
  }, [board.pageSize, fetchBoardMessages, hasMore, isPending, isRefreshingBoard, nextOffset, replaceMessages, setError, showArchived, sortDirection, sortMode])

  const handlePreviousPage = useCallback(() => {
    if (!isDesktopViewport || currentPageIndex === 0 || isPending || isRefreshingBoard) {
      return
    }

    setCurrentPageIndex((current) => Math.max(current - 1, 0))
  }, [currentPageIndex, isDesktopViewport, isPending, isRefreshingBoard])

  const handleNextPage = useCallback(async () => {
    if (!isDesktopViewport || isPending || isRefreshingBoard) {
      return
    }

    const targetPageIndex = currentPageIndex + 1

    if (targetPageIndex < loadedDesktopPageCount) {
      setCurrentPageIndex(targetPageIndex)
      return
    }

    if (!hasMore) {
      return
    }

    const requestKey = activeBoardQueryKeyRef.current

    try {
      const payload = await fetchBoardMessages(showArchived, sortMode, sortDirection, nextOffset, board.pageSize)
      if (requestKey !== activeBoardQueryKeyRef.current) {
        return
      }

      startTransition(() => {
        replaceMessages((current) => [...current, ...payload.messages], {
          nextOffset: payload.nextOffset,
          hasMore: payload.hasMore,
        })
        setCurrentPageIndex(() => {
          const nextPageCount = Math.max(1, Math.ceil(messagesRef.current.length / DESKTOP_NOTES_PER_PAGE))
          return Math.min(targetPageIndex, nextPageCount - 1)
        })
      })
    } catch {
      if (requestKey === activeBoardQueryKeyRef.current) {
        setError('下一页便签加载失败，请稍后重试。')
      }
    }
  }, [board.pageSize, currentPageIndex, fetchBoardMessages, hasMore, isDesktopViewport, isPending, isRefreshingBoard, loadedDesktopPageCount, nextOffset, replaceMessages, setError, showArchived, sortDirection, sortMode])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    activeBoardQueryKeyRef.current = activeBoardQueryKey
  }, [activeBoardQueryKey])

  useEffect(() => {
    if (!isDesktopViewport) {
      return
    }

    const lastPageIndex = Math.max(Math.ceil(messages.length / DESKTOP_NOTES_PER_PAGE) - 1, 0)
    if (currentPageIndex > lastPageIndex) {
      setCurrentPageIndex(lastPageIndex)
    }
  }, [currentPageIndex, isDesktopViewport, messages.length])

  useEffect(() => {
    if (!boardPayload) {
      return
    }

    if (
      boardPayload.archived !== showArchived ||
      boardPayload.sort !== sortMode ||
      boardPayload.sortDirection !== sortDirection
    ) {
      return
    }

    // Guard: if boardPayload hasn't changed since the last time this effect ran,
    // the trigger was a nextOffset/hasMore state change from removeMessageFromSurface,
    // not a real SWR data arrival. Skip to avoid reverting the optimistic removal
    // while we wait for mutateBoardPayload to catch up.
    if (boardPayload === lastBoardPayloadRef.current) {
      return
    }
    lastBoardPayloadRef.current = boardPayload

    // Compare against messagesRef.current (synchronously updated in replaceMessages)
    // rather than the messages state. This avoids a race condition where setMessages
    // and mutateBoardPayload run in different batches: the effect would fire with a
    // stale boardPayload before mutateBoardPayload resolves, triggering a spurious
    // resetBoardSurface that reverts the optimistic update. In production (no strict
    // mode) this causes the checklist toggle to appear to do nothing.
    if (isSameBoardSurfacePayload(boardPayload, messagesRef.current, nextOffset, hasMore)) {
      return
    }

    startTransition(() => {
      resetBoardSurface(boardPayload.messages, {
        nextOffset: boardPayload.nextOffset,
        hasMore: boardPayload.hasMore,
      })
    })
  }, [boardPayload, hasMore, nextOffset, resetBoardSurface, showArchived, sortDirection, sortMode])

  return {
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
    resetBoardSurface,
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
  }
}
