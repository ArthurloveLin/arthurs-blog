'use client'

import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { NowWatchingPoster, PagedNowWatchingPosters } from '@/lib/now-watching'

export interface NowWatchingFeedConfig {
  columnCount: number
  loadBatchSize: number
}

interface NowWatchingProviderProps {
  initialPosters: NowWatchingPoster[]
  initialPage: number
  hasMore: boolean
  config?: Partial<NowWatchingFeedConfig>
  children: ReactNode
}

interface NowWatchingState {
  columns: NowWatchingPoster[][]
  page: number
  hasMore: boolean
  isLoading: boolean
}

interface NowWatchingActions {
  loadMore: () => Promise<void>
}

interface NowWatchingMeta {
  config: NowWatchingFeedConfig
}

interface NowWatchingContextValue {
  state: NowWatchingState
  actions: NowWatchingActions
  meta: NowWatchingMeta
}

const DEFAULT_FEED_CONFIG: NowWatchingFeedConfig = {
  columnCount: 3,
  loadBatchSize: 9,
}

const NowWatchingContext = createContext<NowWatchingContextValue | null>(null)

function distributeToColumns(posters: NowWatchingPoster[], columnCount: number): NowWatchingPoster[][] {
  const columns: NowWatchingPoster[][] = Array.from({ length: columnCount }, () => [])
  posters.forEach((poster, index) => {
    columns[index % columnCount].push(poster)
  })
  return columns
}

export function NowWatchingProvider({ initialPosters, initialPage, hasMore: initialHasMore, config, children }: NowWatchingProviderProps) {
  const resolvedConfig = useMemo(
    () => ({
      columnCount: config?.columnCount ?? DEFAULT_FEED_CONFIG.columnCount,
      loadBatchSize: config?.loadBatchSize ?? DEFAULT_FEED_CONFIG.loadBatchSize,
    }),
    [config?.columnCount, config?.loadBatchSize],
  )

  const [columns, setColumns] = useState<NowWatchingPoster[][]>(() =>
    distributeToColumns(initialPosters, resolvedConfig.columnCount),
  )
  const [page, setPage] = useState(initialPage)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [isLoading, setIsLoading] = useState(false)
  const prefetchedRef = useRef<{ page: number; data: PagedNowWatchingPosters } | null>(null)

  const prefetch = useCallback(async (pageToFetch: number) => {
    try {
      const response = await fetch(
        `/api/now-watching/posters?page=${pageToFetch}&perPage=${resolvedConfig.loadBatchSize}`,
      )
      if (!response.ok) return

      const data: PagedNowWatchingPosters = await response.json()
      prefetchedRef.current = { page: pageToFetch, data }
    } catch {
      // Ignore prefetch failures and fall back to normal fetches.
    }
  }, [resolvedConfig.loadBatchSize])

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return

    setIsLoading(true)
    const nextPage = page + 1

    try {
      let data: PagedNowWatchingPosters

      if (prefetchedRef.current?.page === nextPage) {
        data = prefetchedRef.current.data
        prefetchedRef.current = null
      } else {
        const response = await fetch(
          `/api/now-watching/posters?page=${nextPage}&perPage=${resolvedConfig.loadBatchSize}`,
        )
        if (!response.ok) return
        data = await response.json()
      }

      setColumns((current) => {
        const next = current.map((column) => [...column])
        data.posters.forEach((poster, index) => {
          next[index % resolvedConfig.columnCount].push(poster)
        })
        return next
      })

      setPage(nextPage)
      setHasMore(data.hasMore)

      if (data.hasMore) {
        void prefetch(nextPage + 1)
      }
    } finally {
      setIsLoading(false)
    }
  }, [hasMore, isLoading, page, prefetch, resolvedConfig.columnCount, resolvedConfig.loadBatchSize])

  useEffect(() => {
    if (initialHasMore) {
      void prefetch(initialPage + 1)
    }
  }, [initialHasMore, initialPage, prefetch])

  const value: NowWatchingContextValue = {
    state: {
      columns,
      page,
      hasMore,
      isLoading,
    },
    actions: {
      loadMore,
    },
    meta: {
      config: resolvedConfig,
    },
  }

  return <NowWatchingContext value={value}>{children}</NowWatchingContext>
}

export function useNowWatching() {
  const context = use(NowWatchingContext)
  if (!context) {
    throw new Error('useNowWatching must be used within NowWatchingProvider')
  }

  return context
}