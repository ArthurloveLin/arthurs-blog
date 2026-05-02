'use client'

import React, { createContext, type ReactNode, use, useEffect, useEffectEvent, useRef } from 'react'
import useSWR from 'swr'
import {
  getSpotifyNowPlayingRefreshPlan,
  SPOTIFY_BASE_REFRESH_INTERVAL_MS,
} from '@/lib/spotify-now-playing'
import type { SpotifyNowPlayingData } from '@/lib/spotify-types'
import { getSpotifyPublicApiUrl } from '@/lib/spotify-public-api'

const SPOTIFY_NOW_PLAYING_URL = getSpotifyPublicApiUrl('/api/now-playing')

type SpotifyLiveData = SpotifyNowPlayingData | { isPlaying: false }

async function fetchSpotifyNowPlaying(url: string): Promise<SpotifyLiveData> {
  const response = await fetch(url, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Failed to fetch Spotify status: ${response.status}`)
  }

  return response.json() as Promise<SpotifyLiveData>
}

interface SpotifyContextValue {
  state: {
    data: SpotifyNowPlayingData | null
    loading: boolean
    hasData: boolean
    error: Error | null
  }
  actions: {
    refresh: () => Promise<void>
  }
}

const SpotifyContext = createContext<SpotifyContextValue | null>(null)

export function SpotifyProvider({
  children,
  refreshIntervalMs = SPOTIFY_BASE_REFRESH_INTERVAL_MS,
}: {
  children: ReactNode
  refreshIntervalMs?: number
}) {
  const scheduledRefreshTimersRef = useRef<any[]>([])
  const manualRefreshRef = useRef<Promise<void> | null>(null)
  const { data, error, isLoading, mutate } = useSWR<SpotifyLiveData>(SPOTIFY_NOW_PLAYING_URL, fetchSpotifyNowPlaying, {
    refreshInterval: refreshIntervalMs,
    revalidateOnFocus: false,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    dedupingInterval: 1000,
    focusThrottleInterval: 60000,
    keepPreviousData: true,
  })

  if (error) {
    console.error('Failed to fetch Spotify status', error)
  }

  const spotifyData = data && data.isPlaying === false && !('title' in data) ? null : (data ?? null)

  const clearScheduledRefreshes = () => {
    for (const timerId of scheduledRefreshTimersRef.current) {
      window.clearTimeout(timerId)
    }

    scheduledRefreshTimersRef.current = []
  }

  const runManualRefresh = async () => {
    if (manualRefreshRef.current) {
      await manualRefreshRef.current
      return
    }

    const refreshTask = (async () => {
      try {
        const nextData = await fetchSpotifyNowPlaying(SPOTIFY_NOW_PLAYING_URL)
        await mutate(nextData, { revalidate: false })
      } catch (refreshError) {
        console.error('Failed to refresh Spotify status', refreshError)
      }
    })()

    manualRefreshRef.current = refreshTask

    try {
      await refreshTask
    } finally {
      manualRefreshRef.current = null
    }
  }

  const refreshNowPlaying = useEffectEvent(() => {
    void runManualRefresh()
  })

  useEffect(() => {
    clearScheduledRefreshes()

    const refreshPlan = getSpotifyNowPlayingRefreshPlan(spotifyData)

    if (!refreshPlan) {
      return clearScheduledRefreshes
    }

    const scheduleRefresh = (delayMs: number) => {
      const timerId = window.setTimeout(() => {
        void refreshNowPlaying()
      }, delayMs)

      scheduledRefreshTimersRef.current.push(timerId)
    }

    if (refreshPlan.nearEndDelayMs !== undefined) {
      scheduleRefresh(refreshPlan.nearEndDelayMs)
    }

    scheduleRefresh(refreshPlan.endDelayMs)
    scheduleRefresh(refreshPlan.postEndDelayMs)

    return clearScheduledRefreshes
  }, [
    spotifyData,
  ])

  return (
    <SpotifyContext.Provider value={{
      state: {
        data: spotifyData,
        loading: isLoading,
        hasData: spotifyData !== null,
        error: error instanceof Error ? error : null,
      },
      actions: {
        refresh: async () => {
          await runManualRefresh()
        },
      },
    }}>
      {children}
    </SpotifyContext.Provider>
  )
}

export function useSpotify() {
  const context = use(SpotifyContext)
  if (!context) {
    throw new Error('useSpotify must be used within a SpotifyProvider')
  }
  return context
}
