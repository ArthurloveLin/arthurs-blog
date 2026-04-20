import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import useSWR from 'swr'
import type { NoteBoardListPayload, NotePosition, OptimisticMessageSnapshot } from '@/components/note-board/types'
import { createBoardPayload, isSameBoardSurfacePayload, sortBoardMessages } from '@/components/note-board/utils/board'
import type { NoteSortMode } from '@/lib/note-priority'
import type { NoteBoardViewConfig } from '@/lib/note-board-config'
import type { NoteMessage } from '@/lib/note-boards'

const DESKTOP_NOTES_PER_PAGE = 10

function getBoardQueryKey(boardSlug: string, archived: boolean, sort: NoteSortMode) {
  return `note-board:${boardSlug}:${archived ? 'archived' : 'active'}:${sort}`
}

export interface UseBoardDataProps {
  board: NoteBoardViewConfig
  initialMessages: NoteMessage[]
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
  reactionIdentity,
  isDesktopViewport,
  cancelEditingNoteRef,
  surfaceRefs,
  setError,
}: UseBoardDataProps) {
  const initialSortedMessages = useMemo(() => sortBoardMessages(initialMessages, 'time'), [initialMessages])
  const initialHasMore = initialMessages.length >= board.initialPageLimit

  const [messages, setMessages] = useState(initialSortedMessages)
  const [nextOffset, setNextOffset] = useState(initialMessages.length)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [showArchived, setShowArchived] = useState(false)
  const [sortMode, setSortMode] = useState<NoteSortMode>('time')
  const [isPending, startTransition] = useTransition()

  const messagesRef = useRef(initialSortedMessages)
  const activeBoardQueryKey = useMemo(
    () => getBoardQueryKey(board.slug, showArchived, sortMode) + `:${reactionIdentity || 'anon'}`,
    [board.slug, reactionIdentity, showArchived, sortMode],
  )
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
    () => createBoardPayload(initialSortedMessages, false, 'time', initialSortedMessages.length, initialHasMore),
    [initialHasMore, initialSortedMessages],
  )

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

  const replaceMessages = useCallback((
    nextMessagesOrUpdater: NoteMessage[] | ((current: NoteMessage[]) => NoteMessage[]),
    options: { resetPositions?: boolean; sort?: boolean; hasMore?: boolean; nextOffset?: number } = {},
  ) => {
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
    } : current, { revalidate: false })
  }, [mutateBoardPayload, sortMode, surfaceRefs])

  const resetBoardSurface = useCallback((nextMessages: NoteMessage[], payload?: Pick<NoteBoardListPayload, 'nextOffset' | 'hasMore'>) => {
    const sortedMessages = sortBoardMessages(nextMessages, sortMode)

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
  }, [board.initialPageLimit, sortMode, surfaceRefs, cancelEditingNoteRef])

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

  const handleSwitchArchiveView = useCallback((archived: boolean) => {
    if (archived === showArchived || isRefreshingBoard) return

    setError(null)
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
    setSortMode(nextSortMode)
  }, [isRefreshingBoard, sortMode, setError, cancelEditingNoteRef])

  const handleLoadMore = useCallback(async () => {
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
  }, [board.pageSize, fetchBoardMessages, hasMore, isPending, isRefreshingBoard, nextOffset, replaceMessages, showArchived, sortMode, setError])

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
      const payload = await fetchBoardMessages(showArchived, sortMode, nextOffset, board.pageSize)
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
  }, [board.pageSize, currentPageIndex, fetchBoardMessages, hasMore, isDesktopViewport, isPending, isRefreshingBoard, loadedDesktopPageCount, nextOffset, replaceMessages, showArchived, sortMode, setError])

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

  return {
    messages,
    visibleMessages,
    nextOffset,
    hasMore,
    currentPageIndex,
    showArchived,
    sortMode,
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
    handleLoadMore,
    handlePreviousPage,
    handleNextPage,
  }
}
