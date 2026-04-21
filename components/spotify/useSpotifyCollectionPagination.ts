'use client'

import { useCallback, useState } from 'react'
import useSWR from 'swr'

async function fetchCollection<T>(url: string): Promise<T[]> {
  const response = await fetch(url, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Failed to fetch Spotify collection: ${response.status}`)
  }

  return response.json() as Promise<T[]>
}

export function useSpotifyCollectionPagination<T>({
  initialItems,
  total,
  pageSize,
  fetchUrl,
  resetKey,
}: {
  initialItems: T[]
  total: number
  pageSize: number
  fetchUrl: string
  resetKey: string
}) {
  const [state, setState] = useState(() => ({
    displayCount: pageSize,
    resetKey,
    shouldLoadFullCollection: false,
  }))

  const isStaleState = state.resetKey !== resetKey
  const displayCount = isStaleState ? pageSize : state.displayCount
  const shouldLoadFullCollection = isStaleState ? false : state.shouldLoadFullCollection

  const { data: fullCollection, error, isLoading } = useSWR<T[]>(
    shouldLoadFullCollection ? fetchUrl : null,
    fetchCollection,
    {
      revalidateOnFocus: false,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      dedupingInterval: 60 * 60 * 1000,
      keepPreviousData: true,
    }
  )

  const items = fullCollection ?? initialItems
  const hasMore = items.length < total || displayCount < items.length

  const loadMore = useCallback(() => {
    if (displayCount < items.length) {
      setState({
        displayCount: Math.min(displayCount + pageSize, items.length),
        resetKey,
        shouldLoadFullCollection,
      })
      return
    }

    if (!shouldLoadFullCollection && items.length < total) {
      setState({
        displayCount: displayCount + pageSize,
        resetKey,
        shouldLoadFullCollection: true,
      })
    }
  }, [displayCount, items.length, pageSize, resetKey, shouldLoadFullCollection, total])

  return {
    error: error instanceof Error ? error : null,
    hasMore,
    isLoading,
    loadMore,
    visibleItems: items.slice(0, displayCount),
  }
}