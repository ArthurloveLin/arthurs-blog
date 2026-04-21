'use client'

import React, { createContext, use, ReactNode } from 'react'
import useSWR from 'swr'

interface SpotifyData {
  isPlaying: boolean
  isRecentlyPlayed?: boolean
  title?: string
  artist?: string
  album?: string
  albumImageUrl?: string
  songUrl?: string
  deviceName?: string
  deviceType?: string
  playedAt?: string
  bpm?: number
  recentTracks?: Array<{
    id: string
    title: string
    artist: string
    album: string
    albumImageUrl: string
    songUrl: string
    playedAt: string
  }>
}

interface SpotifyContextValue {
  state: {
    data: SpotifyData | null
    loading: boolean
    hasData: boolean
  }
  actions: {
    refresh: () => Promise<void>
  }
}

const SpotifyContext = createContext<SpotifyContextValue | null>(null)

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function SpotifyProvider({ children }: { children: ReactNode }) {
  const { data, error, isLoading, mutate } = useSWR<SpotifyData>('/api/now-playing', fetcher, {
    refreshInterval: 30000, // 30 seconds
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  })

  // Log error if it happens (optional, for debugging)
  if (error) {
    console.error('Failed to fetch Spotify status', error)
  }

  return (
    <SpotifyContext.Provider value={{
      state: {
        data: data ?? null,
        loading: isLoading,
        hasData: !!data && data.isPlaying !== undefined,
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
