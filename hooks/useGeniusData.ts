'use client'

import useSWR from 'swr'
import type { GeniusSongData } from '@/lib/genius-types'

interface TrackInfo {
  trackId?: string
  title: string
  artist: string
}

interface GeniusResponse {
  cached: boolean
  data: GeniusSongData | null
}

async function fetcher(url: string): Promise<GeniusResponse> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Genius fetch failed: ${res.status}`)
  return res.json() as Promise<GeniusResponse>
}

export function useGeniusData(track: TrackInfo | null): {
  geniusData: GeniusSongData | null
  loading: boolean
} {
  const key = track
    ? `/api/genius?trackId=${track.trackId ?? ''}&title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist)}`
    : null

  const { data, isLoading } = useSWR<GeniusResponse>(key, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 300_000,
    shouldRetryOnError: false,
    keepPreviousData: false,
  })

  return {
    geniusData: data?.data ?? null,
    loading: isLoading && !!key,
  }
}
