import 'server-only'

import { unstable_cache } from 'next/cache'

import {
  type SpotifyCollectionPreview,
  type SpotifyDashboardData,
  type SpotifyNowPlayingData,
  type SpotifyNowPlayingRecentTrack,
  type SpotifyPlaylistTrack,
  SpotifyRecentlyPlayedTrack,
  type SpotifySyncMeta,
  type SpotifyTimeRange,
  type SpotifyTopArtist,
  type SpotifyTopTrack,
  type SpotifyTrackSummary,
} from './spotify-types'
import { getR2Object, listR2Objects } from './r2'

const SPOTIFY_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token'
const SPOTIFY_PLAYER_ENDPOINT = 'https://api.spotify.com/v1/me/player'

const SPOTIFY_META_KEY = 'spotify/meta.json'
const SPOTIFY_LATEST_DASHBOARD_KEY = 'spotify/latest/dashboard.json'
const SPOTIFY_LATEST_LIBRARY_KEY = 'spotify/latest/library.json'
export const SPOTIFY_SAVED_TRACKS_KEY = 'spotify/collection/saved-tracks.json'
const SPOTIFY_PLAYLIST_SHARD_PATH = 'spotify/collection/playlists/'
const SPOTIFY_RECENTLY_PLAYED_PATH = 'spotify/history/recently-played/'
const RECENTLY_PLAYED_DAY_SHARD_PATTERN = /^\d{4}-\d{2}-\d{2}\.json$/
let _tokenCache: { token: string; expiresAt: number } | null = null

const SPOTIFY_ARCHIVE_SCHEMA_VERSION = 2
const SPOTIFY_REQUEST_MAX_ATTEMPTS = 3

type SpotifyStoredDashboardSnapshot = Omit<SpotifyDashboardData, 'archiveMeta'>
type SpotifyStoredDashboardFile = Omit<SpotifyStoredDashboardSnapshot, 'library'>

interface SpotifyLatestDashboardFile {
  schemaVersion: number
  syncedAt: string
  data: SpotifyStoredDashboardFile
}

type SpotifyImage = { url: string }

type SpotifyArtistObject = {
  id: string | null
  name: string
  external_urls?: { spotify?: string }
  genres?: string[]
  followers?: { total?: number }
  images?: SpotifyImage[]
  popularity?: number
}

type SpotifyAlbumObject = {
  id: string | null
  name: string
  images: SpotifyImage[]
  external_urls?: { spotify?: string }
  artists: Array<{ name: string }>
  release_date?: string
  total_tracks?: number
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

function getSpotifyArchiveConfig() {
  return {
    bucket: process.env.R2_SPOTIFY_BUCKET ?? '',
    publicDomain: process.env.R2_SPOTIFY_PUBLIC_DOMAIN ?? null,
  }
}

function emptyTopTracksRecord(): Record<SpotifyTimeRange, SpotifyTopTrack[]> {
  return {
    short_term: [],
    medium_term: [],
    long_term: [],
  }
}

function emptyTopArtistsRecord(): Record<SpotifyTimeRange, SpotifyTopArtist[]> {
  return {
    short_term: [],
    medium_term: [],
    long_term: [],
  }
}

function createEmptyDashboardData(overrides: Partial<SpotifyDashboardData> = {}): SpotifyDashboardData {
  return {
    fetchedAt: new Date().toISOString(),
    recentlyPlayed: [],
    topTracks: emptyTopTracksRecord(),
    topArtists: emptyTopArtistsRecord(),
    library: {
      savedTracks: { total: 0, items: [] },
      savedAlbums: { total: 0, items: [] },
      playlists: { total: 0, items: [] },
    },
    warnings: [],
    ...overrides,
  }
}

function createEmptySyncMeta(): SpotifySyncMeta {
  return {
    schemaVersion: SPOTIFY_ARCHIVE_SCHEMA_VERSION,
    lastSyncedAt: null,
    lastFullSyncedAt: null,
    syncCount: 0,
    syncLog: [],
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

async function readR2JsonIfExists<T>(bucket: string, key: string): Promise<T | null> {
  try {
    const raw = await getR2Object(bucket, key)
    return JSON.parse(raw) as T
  } catch (error) {
    if (isMissingR2ObjectError(error)) {
      return null
    }

    throw error
  }
}

function buildSpotifySnapshotUrl(publicDomain: string | null, key: string) {
  if (!publicDomain) {
    return null
  }

  return `https://${publicDomain}/${key}`
}

function getSpotifyCredentials() {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Spotify environment variables')
  }

  return {
    clientId,
    clientSecret,
    refreshToken,
  }
}

async function getSpotifyAccessToken(): Promise<string> {
  const now = Date.now()
  if (_tokenCache && now < _tokenCache.expiresAt) {
    return _tokenCache.token
  }

  const { clientId, clientSecret, refreshToken } = getSpotifyCredentials()
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
    method: 'POST',
    cache: 'no-store',
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

  _tokenCache = { token: payload.access_token, expiresAt: now + 55 * 60 * 1000 }
  return _tokenCache.token
}

async function requestSpotify<T>(accessToken: string, endpoint: string, allowNoContent = false): Promise<T> {
  for (let attempt = 1; attempt <= SPOTIFY_REQUEST_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        cache: 'no-store',
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
          const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN
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
    albumId: track.album.id,
    albumImageUrl: track.album.images[0]?.url ?? null,
    songUrl: track.external_urls?.spotify ?? '',
    durationMs: track.duration_ms,
    popularity: track.popularity ?? null,
  }
}

async function getCurrentPlayback(accessToken: string) {
  const playback = await requestSpotify<SpotifyCurrentPlaybackResponse | null>(
    accessToken,
    SPOTIFY_PLAYER_ENDPOINT,
    true
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


export async function getSpotifyNowPlayingData(): Promise<SpotifyNowPlayingData | null> {
  const accessToken = await getSpotifyAccessToken()

  // 并行获取实时播放状态和 R2 缓存数据 (用于历史列表)
  const [currentPlayback, storedData] = await Promise.all([
    getCurrentPlayback(accessToken).catch(() => null),
    getStoredSpotifyDashboardData().catch(() => null)
  ])

  // 转换 R2 中的最近播放数据格式以适应 NowPlaying 组件
  const recentTracks: SpotifyNowPlayingRecentTrack[] = (storedData?.recentlyPlayed || []).map(track => ({
    id: track.id,
    title: track.title,
    artist: track.artists.join(', '),
    album: track.album,
    albumImageUrl: track.albumImageUrl,
    songUrl: track.songUrl,
    playedAt: track.playedAt
  }))

  if (!currentPlayback) {
    // 如果没有正在播放，且我们有历史记录，则返回最后一次播放的内容
    if (recentTracks.length > 0) {
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
        recentTracks
      }
    }
    return null
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
    recentTracks // 注入合并后的历史记录
  }
}

async function readSpotifyMeta(): Promise<SpotifySyncMeta> {
  const { bucket } = getSpotifyArchiveConfig()
  if (!bucket) return createEmptySyncMeta()
  const meta = await readR2JsonIfExists<SpotifySyncMeta>(bucket, SPOTIFY_META_KEY)
  return meta ?? createEmptySyncMeta()
}

export async function readSpotifyCollection<T>(key: string): Promise<SpotifyCollectionPreview<T>> {
  const { bucket } = getSpotifyArchiveConfig()
  if (!bucket) return { total: 0, items: [] }
  const collection = await readR2JsonIfExists<SpotifyCollectionPreview<T>>(bucket, key)
  return collection ?? { total: 0, items: [] }
}

export const readRecentlyPlayedDayShard = unstable_cache(
  async function readRecentlyPlayedDayShardRaw(date: string): Promise<SpotifyRecentlyPlayedTrack[]> {
    const { bucket } = getSpotifyArchiveConfig()
    if (!bucket) return []

    const shard = await readR2JsonIfExists<SpotifyRecentlyPlayedTrack[]>(
      bucket,
      `${SPOTIFY_RECENTLY_PLAYED_PATH}${date}.json`
    )

    return (shard ?? []).toSorted(
      (a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
    )
  },
  ['spotify-recently-played-day-shard'],
  { tags: ['spotify'], revalidate: 3600 }
)

export async function readSpotifyPlaylistShard(id: string): Promise<SpotifyPlaylistTrack[]> {
  const { bucket } = getSpotifyArchiveConfig()
  if (!bucket) return []
  const tracks = await readR2JsonIfExists<SpotifyPlaylistTrack[]>(
    bucket,
    `${SPOTIFY_PLAYLIST_SHARD_PATH}${id}.json`
  )
  return tracks ?? []
}

export const listRecentlyPlayedDays = unstable_cache(
  async function listRecentlyPlayedDaysRaw(limitDays?: number): Promise<string[]> {
    const { bucket } = getSpotifyArchiveConfig()
    if (!bucket) return []

    const keys = await listR2Objects(bucket, SPOTIFY_RECENTLY_PLAYED_PATH)

    const days = keys
      .map((key) => key.slice(SPOTIFY_RECENTLY_PLAYED_PATH.length))
      .filter((name) => RECENTLY_PLAYED_DAY_SHARD_PATTERN.test(name))
      .map((name) => name.replace(/\.json$/, ''))
      .sort((a, b) => b.localeCompare(a))

    if (typeof limitDays === 'number') {
      return days.slice(0, Math.max(limitDays, 0))
    }

    return days
  },
  ['spotify-recently-played-days'],
  { tags: ['spotify'], revalidate: 3600 }
)

async function readLatestSpotifyLibrary(): Promise<SpotifyDashboardData['library'] | null> {
  const { bucket } = getSpotifyArchiveConfig()
  if (!bucket) return null
  return readR2JsonIfExists<SpotifyDashboardData['library']>(bucket, SPOTIFY_LATEST_LIBRARY_KEY)
}

async function readLatestSpotifyDashboard() {
  const { bucket, publicDomain } = getSpotifyArchiveConfig()

  if (!bucket) {
    return null
  }

  const latest = await readR2JsonIfExists<SpotifyLatestDashboardFile>(bucket, SPOTIFY_LATEST_DASHBOARD_KEY)

  if (!latest?.data) {
    return null
  }

  return {
    data: latest.data,
    syncedAt: latest.syncedAt,
    snapshotUrl: buildSpotifySnapshotUrl(publicDomain, SPOTIFY_LATEST_DASHBOARD_KEY),
  }
}

export const getStoredSpotifyDashboardData = unstable_cache(async function (): Promise<SpotifyDashboardData> {
  const { bucket, publicDomain } = getSpotifyArchiveConfig()

  if (!bucket) {
    return createEmptyDashboardData({
      warnings: ['未配置 R2_SPOTIFY_BUCKET，Spotify dashboard 无法读取离线快照'],
      archiveMeta: {
        source: 'empty',
        hasStoredSnapshot: false,
        lastSyncedAt: null,
        snapshotUrl: buildSpotifySnapshotUrl(publicDomain, SPOTIFY_LATEST_DASHBOARD_KEY),
        syncCount: 0,
      },
    })
  }

  const [latest, meta, library] = await Promise.all([
    readLatestSpotifyDashboard(),
    readSpotifyMeta(),
    readLatestSpotifyLibrary(),
  ])

  if (!latest) {
    return createEmptyDashboardData({
      warnings: ['尚未发现 Spotify 离线快照。请等待自动同步或手动触发同步。'],
      archiveMeta: {
        source: 'empty',
        hasStoredSnapshot: false,
        lastSyncedAt: meta.lastSyncedAt,
        snapshotUrl: buildSpotifySnapshotUrl(publicDomain, SPOTIFY_LATEST_DASHBOARD_KEY),
        syncCount: meta.syncCount,
      },
    })
  }

  return {
    ...latest.data,
    library: library ?? {
      savedTracks: { total: 0, items: [] },
      savedAlbums: { total: 0, items: [] },
      playlists: { total: 0, items: [] },
    },
    archiveMeta: {
      source: 'r2-archive',
      hasStoredSnapshot: true,
      lastSyncedAt: latest.syncedAt,
      snapshotUrl: latest.snapshotUrl,
      syncCount: meta.syncCount,
    },
  }
}, ['spotify-dashboard'], { tags: ['spotify'], revalidate: 3600 })