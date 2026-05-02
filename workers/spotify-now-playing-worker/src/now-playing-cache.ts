import type { SpotifyNowPlayingData } from './spotify-types'

const SPOTIFY_NEAR_END_WINDOW_MS = 12_000
const SPOTIFY_STANDARD_CACHE_TTL_SECONDS = 15
const SPOTIFY_IDLE_CACHE_TTL_SECONDS = 5
const SPOTIFY_NEAR_END_CACHE_TTL_MAX_SECONDS = 5
const SPOTIFY_ERROR_CACHE_TTL_SECONDS = 10

function createCacheControl(ageSeconds: number, staleWhileRevalidateSeconds: number) {
  const directives = ['public', 'max-age=0', 'must-revalidate', `s-maxage=${ageSeconds}`]

  if (staleWhileRevalidateSeconds > 0) {
    directives.push(`stale-while-revalidate=${staleWhileRevalidateSeconds}`)
  }

  return directives.join(', ')
}

function getSpotifyRemainingMs(data: SpotifyNowPlayingData | null | undefined): number | null {
  if (!data?.isPlaying) {
    return null
  }

  if (typeof data.durationMs !== 'number' || typeof data.progressMs !== 'number') {
    return null
  }

  return Math.max(0, data.durationMs - data.progressMs)
}

export function getSpotifyNowPlayingCacheControl(data: SpotifyNowPlayingData | null | undefined) {
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

  return createCacheControl(SPOTIFY_STANDARD_CACHE_TTL_SECONDS, 5)
}

export function getSpotifyNowPlayingErrorCacheControl() {
  return createCacheControl(SPOTIFY_ERROR_CACHE_TTL_SECONDS, 0)
}