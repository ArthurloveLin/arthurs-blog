'use client'

import React, { createContext, use, ReactNode } from 'react'
import useSWR from 'swr'
import type { SpotifyNowPlayingData } from '@/lib/spotify-types'
import { getSpotifyPublicApiUrl } from '@/lib/spotify-public-api'

const DEFAULT_REFRESH_INTERVAL_MS = 30000
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
  refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS,
}: {
  children: ReactNode
  refreshIntervalMs?: number
}) {
  const { data, error, isLoading, mutate } = useSWR<SpotifyLiveData>(SPOTIFY_NOW_PLAYING_URL, fetchSpotifyNowPlaying, {
    refreshInterval: refreshIntervalMs,
    revalidateOnFocus: false,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    dedupingInterval: 30000,
    focusThrottleInterval: 60000,
    keepPreviousData: true,
  })

  if (error) {
    console.error('Failed to fetch Spotify status', error)
  }

  const spotifyData = data && data.isPlaying === false && !('title' in data) ? null : (data ?? null)

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
          await mutate()
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
