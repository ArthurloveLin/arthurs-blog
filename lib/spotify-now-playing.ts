import type { SpotifyNowPlayingData } from '@/lib/spotify-types'

export const SPOTIFY_BASE_REFRESH_INTERVAL_MS = 30_000
export const SPOTIFY_NEAR_END_WINDOW_MS = 12_000

const SPOTIFY_END_REFRESH_OFFSET_MS = 250
const SPOTIFY_POST_END_REFRESH_DELAY_MS = 3_000

interface SpotifyNowPlayingRefreshPlan {
  nearEndDelayMs?: number
  endDelayMs: number
  postEndDelayMs: number
}

export function getSpotifyRemainingMs(data: SpotifyNowPlayingData | null | undefined): number | null {
  if (!data?.isPlaying) {
    return null
  }

  if (typeof data.durationMs !== 'number' || typeof data.progressMs !== 'number') {
    return null
  }

  return Math.max(0, data.durationMs - data.progressMs)
}

export function getSpotifyNowPlayingRefreshPlan(
  data: SpotifyNowPlayingData | null | undefined,
): SpotifyNowPlayingRefreshPlan | null {
  const remainingMs = getSpotifyRemainingMs(data)

  if (remainingMs === null) {
    return null
  }

  return {
    nearEndDelayMs: remainingMs > SPOTIFY_NEAR_END_WINDOW_MS
      ? remainingMs - SPOTIFY_NEAR_END_WINDOW_MS
      : undefined,
    endDelayMs: remainingMs + SPOTIFY_END_REFRESH_OFFSET_MS,
    postEndDelayMs: remainingMs + SPOTIFY_POST_END_REFRESH_DELAY_MS,
  }
}
