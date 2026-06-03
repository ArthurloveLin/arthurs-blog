import type { Env } from './env'
import { getR2Object } from './r2'
import type {
  SpotifyNowPlayingData,
  SpotifyNowPlayingRecentTrack,
  SpotifyStoredRecentTrack,
  SpotifyTrackSummary,
} from './spotify-types'

const SPOTIFY_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token'
const SPOTIFY_PLAYER_ENDPOINT = 'https://api.spotify.com/v1/me/player'
const SPOTIFY_LATEST_DASHBOARD_KEY = 'spotify/latest/dashboard.json'
const SPOTIFY_REQUEST_MAX_ATTEMPTS = 3

let tokenCache: { token: string; expiresAt: number } | null = null

interface SpotifyLatestDashboardFile {
  syncedAt: string
  data?: {
    recentlyPlayed?: SpotifyStoredRecentTrack[]
  }
}

type SpotifyImage = { url: string }

type SpotifyArtistObject = {
  id: string | null
  name: string
}

type SpotifyAlbumObject = {
  id: string | null
  name: string
  images: SpotifyImage[]
}

type SpotifyTrackObject = {
  id: string | null
  uri?: string
  name: string
  duration_ms: number
  popularity?: number
  external_urls?: { spotify?: string }
  artists: SpotifyArtistObject[]
  album: SpotifyAlbumObject
}

type SpotifyCurrentPlaybackResponse = {
  item: SpotifyTrackObject | null
  is_playing: boolean
  device?: {
    name?: string
    type?: string
  }
  progress_ms: number
}

class SpotifyRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'SpotifyRequestError'
    this.status = status
  }
}

function isMissingR2ObjectError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  return (
    error.name === 'NoSuchKey' ||
    /NoSuchKey/i.test(error.message) ||
    /The specified key does not exist/i.test(error.message)
  )
}

function getSpotifyCredentials(env: Env) {
  const clientId = env.SPOTIFY_CLIENT_ID
  const clientSecret = env.SPOTIFY_CLIENT_SECRET
  const refreshToken = env.SPOTIFY_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Spotify environment variables')
  }

  return {
    clientId,
    clientSecret,
    refreshToken,
  }
}

export async function getSpotifyAccessToken(env: Env): Promise<string> {
  const now = Date.now()

  if (tokenCache && now < tokenCache.expiresAt) {
    return tokenCache.token
  }

  const { clientId, clientSecret, refreshToken } = getSpotifyCredentials(env)
  const basic = btoa(`${clientId}:${clientSecret}`)

  const response = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    throw new SpotifyRequestError('Failed to refresh Spotify access token', response.status)
  }

  const payload = (await response.json()) as { access_token?: string }

  if (!payload.access_token) {
    throw new Error('Spotify token response did not include access_token')
  }

  tokenCache = {
    token: payload.access_token,
    expiresAt: now + 55 * 60 * 1000,
  }

  return tokenCache.token
}

async function requestSpotify<T>(accessToken: string, endpoint: string, allowNoContent = false): Promise<T> {
  for (let attempt = 1; attempt <= SPOTIFY_REQUEST_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (allowNoContent && response.status === 204) {
        return null as T
      }

      if (!response.ok) {
        let errorMessage = `Spotify request failed with status ${response.status}`

        try {
          const payload = (await response.json()) as {
            error?: {
              message?: string
            }
          }

          if (payload.error?.message) {
            errorMessage = payload.error.message
          }
        } catch {
          // Ignore JSON parsing errors and use the fallback message.
        }

        const isRetriable = response.status === 429 || response.status >= 500

        if (isRetriable && attempt < SPOTIFY_REQUEST_MAX_ATTEMPTS) {
          const retryAfterHeader = response.headers.get('retry-after')
          const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : Number.NaN
          const waitMs = Number.isFinite(retryAfterSeconds)
            ? retryAfterSeconds * 1000
            : attempt * 500

          await new Promise((resolve) => setTimeout(resolve, waitMs))
          continue
        }

        throw new SpotifyRequestError(errorMessage, response.status)
      }

      return response.json() as Promise<T>
    } catch (error) {
      const isLastAttempt = attempt === SPOTIFY_REQUEST_MAX_ATTEMPTS

      if (error instanceof SpotifyRequestError || isLastAttempt) {
        throw error
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 500))
    }
  }

  throw new Error('Spotify request exhausted all retry attempts')
}

function toTrackSummary(track: SpotifyTrackObject): SpotifyTrackSummary {
  return {
    id: track.id ?? track.uri ?? track.name,
    title: track.name,
    artists: track.artists.map((artist) => artist.name),
    album: track.album.name,
    albumImageUrl: track.album.images[0]?.url ?? null,
    songUrl: track.external_urls?.spotify ?? '',
    durationMs: track.duration_ms,
  }
}

async function getCurrentPlayback(accessToken: string) {
  const playback = await requestSpotify<SpotifyCurrentPlaybackResponse | null>(
    accessToken,
    SPOTIFY_PLAYER_ENDPOINT,
    true,
  )

  if (!playback?.item) {
    return null
  }

  return {
    track: toTrackSummary(playback.item),
    isPlaying: playback.is_playing,
    deviceName: playback.device?.name,
    deviceType: playback.device?.type,
    progressMs: playback.progress_ms,
    durationMs: playback.item.duration_ms,
  }
}

async function readStoredRecentTracks(env: Env): Promise<SpotifyNowPlayingRecentTrack[]> {
  try {
    const raw = await getR2Object(env, SPOTIFY_LATEST_DASHBOARD_KEY)
    const latest = JSON.parse(raw) as SpotifyLatestDashboardFile

    return (latest.data?.recentlyPlayed ?? []).map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artists.join(', '),
      album: track.album,
      albumImageUrl: track.albumImageUrl,
      songUrl: track.songUrl,
      playedAt: track.playedAt,
    }))
  } catch (error) {
    if (isMissingR2ObjectError(error)) {
      return []
    }

    throw error
  }
}

export async function getSpotifyNowPlayingData(env: Env): Promise<SpotifyNowPlayingData | null> {
  const accessToken = await getSpotifyAccessToken(env)

  const [currentPlayback, recentTracks] = await Promise.all([
    getCurrentPlayback(accessToken).catch(() => null),
    readStoredRecentTracks(env).catch(() => []),
  ])

  if (!currentPlayback) {
    if (recentTracks.length === 0) {
      return null
    }

    const lastTrack = recentTracks[0]

    return {
      isPlaying: false,
      isRecentlyPlayed: true,
      title: lastTrack.title,
      artist: lastTrack.artist,
      album: lastTrack.album,
      albumImageUrl: lastTrack.albumImageUrl,
      songUrl: lastTrack.songUrl,
      playedAt: lastTrack.playedAt,
      recentTracks,
    }
  }

  const track = currentPlayback.track

  return {
    isPlaying: currentPlayback.isPlaying,
    title: track.title,
    artist: track.artists.join(', '),
    album: track.album,
    albumImageUrl: track.albumImageUrl,
    songUrl: track.songUrl,
    deviceName: currentPlayback.deviceName,
    deviceType: currentPlayback.deviceType,
    progressMs: currentPlayback.progressMs,
    durationMs: currentPlayback.durationMs,
    recentTracks,
  }
}