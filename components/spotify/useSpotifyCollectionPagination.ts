'use client'

import { useCallback, useState } from 'react'

interface CollectionPage<T> {
  items: T[]
  total: number
}

async function fetchCollectionPage<T>(url: string, offset: number, limit: number): Promise<CollectionPage<T>> {
  const response = await fetch(`${url}?offset=${offset}&limit=${limit}`, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Failed to fetch Spotify collection: ${response.status}`)
  }

  return response.json() as Promise<CollectionPage<T>>
}

export function useSpotifyCollectionPagination<T>({
  initialItems,
  total,
  pageSize,
  fetchUrl,
  getItemKey,
}: {
  initialItems: T[]
  total: number
  pageSize: number
  fetchUrl: string
  getItemKey: (item: T) => string
}) {
  const [visibleItems, setVisibleItems] = useState(initialItems)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const hasMore = visibleItems.length < total

  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) {
      return
    }

    setIsLoading(true)
    setError(null)

    void fetchCollectionPage<T>(fetchUrl, visibleItems.length, pageSize)
      .then((page) => {
        setVisibleItems((currentItems) => {
          const knownKeys = new Set(currentItems.map((item) => getItemKey(item)))
          const nextItems = page.items.filter((item) => !knownKeys.has(getItemKey(item)))
          return [...currentItems, ...nextItems]
        })
      })
      .catch((nextError: unknown) => {
        setError(nextError instanceof Error ? nextError : new Error('Failed to fetch Spotify collection'))
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [fetchUrl, getItemKey, hasMore, isLoading, pageSize, visibleItems.length])

  return {
    error,
    hasMore,
    isLoading,
    loadMore,
    visibleItems,
  }
}