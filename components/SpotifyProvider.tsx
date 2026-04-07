'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'

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
}

interface SpotifyContextType {
  data: SpotifyData | null
  loading: boolean
  refresh: () => Promise<void>
}

const SpotifyContext = createContext<SpotifyContextType | null>(null)

export function SpotifyProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SpotifyData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchNowPlaying = async () => {
    try {
      const res = await fetch('/api/now-playing')
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (e) {
      console.error('Failed to fetch Spotify status', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Initial fetch
    fetchNowPlaying()
    
    // Periodic fetch every 30 seconds
    const interval = setInterval(fetchNowPlaying, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <SpotifyContext.Provider value={{ data, loading, refresh: fetchNowPlaying }}>
      {children}
    </SpotifyContext.Provider>
  )
}

export function useSpotify() {
  const context = useContext(SpotifyContext)
  if (!context) {
    throw new Error('useSpotify must be used within a SpotifyProvider')
  }
  return context
}
