import type { SpotifyNowPlayingData } from '@/lib/spotify-types'

export const SPOTIFY_BASE_REFRESH_INTERVAL_MS = 30_000
export const SPOTIFY_NEAR_END_WINDOW_MS = 12_000

const SPOTIFY_END_REFRESH_OFFSET_MS = 250
const SPOTIFY_POST_END_REFRESH_DELAY_MS = 3_000
const SPOTIFY_STANDARD_CACHE_TTL_SECONDS = 30
const SPOTIFY_IDLE_CACHE_TTL_SECONDS = 5
const SPOTIFY_NEAR_END_CACHE_TTL_MAX_SECONDS = 5
const SPOTIFY_ERROR_CACHE_TTL_SECONDS = 10

interface SpotifyNowPlayingRefreshPlan {
  nearEndDelayMs?: number
  endDelayMs: number
  postEndDelayMs: number
}

function createAgeDirective(ageSeconds: number) {
  return `max-age=0, must-revalidate, s-maxage=${ageSeconds}`
}

function createCacheControl(ageSeconds: number, staleWhileRevalidateSeconds: number) {
  const directives = ['public', createAgeDirective(ageSeconds)]

  if (staleWhileRevalidateSeconds > 0) {
    directives.push(`stale-while-revalidate=${staleWhileRevalidateSeconds}`)
  }

  return directives.join(', ')
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

export function getSpotifyNowPlayingCacheControl(
  data: SpotifyNowPlayingData | null | undefined,
) {
  const remainingMs = getSpotifyRemainingMs(data)

  if (remainingMs === null) {
    return createCacheControl(SPOTIFY_IDLE_CACHE_TTL_SECONDS, SPOTIFY_IDLE_CACHE_TTL_SECONDS)
  }

  if (remainingMs <= SPOTIFY_NEAR_END_WINDOW_MS) {
    const ttlSeconds = Math.max(1, Math.min(
      SPOTIFY_NEAR_END_CACHE_TTL_MAX_SECONDS,
      Math.ceil(remainingMs / 1_000),
    ))

    return createCacheControl(ttlSeconds, 0)
  }

  return createCacheControl(
    SPOTIFY_STANDARD_CACHE_TTL_SECONDS,
    SPOTIFY_STANDARD_CACHE_TTL_SECONDS,
  )
}

export function getSpotifyNowPlayingErrorCacheControl() {
  return createCacheControl(SPOTIFY_ERROR_CACHE_TTL_SECONDS, 0)
}