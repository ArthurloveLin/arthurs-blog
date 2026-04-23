import 'server-only'

import { cache } from 'react'

import {
  SPOTIFY_TIME_RANGES,
  type SpotifyAlbumSummary,
  type SpotifyArchiveListSnapshot,
  type SpotifyCollectionPreview,
  type SpotifyContextSource,
  type SpotifyDashboardData,
  type SpotifyNowPlayingData,
  type SpotifyNowPlayingRecentTrack,
  type SpotifyPlaylist,
  type SpotifyPlaylistPreview,
  type SpotifyPlaylistTrack,
  type SpotifyRankingsHistory,
  SpotifyRecentlyPlayedTrack,
  type SpotifySavedAlbum,
  type SpotifySavedTrack,
  type SpotifySyncMeta,
  type SpotifyTimeRange,
  type SpotifyTopArtist,
  type SpotifyTopTrack,
  type SpotifyTrackSummary,
} from './spotify-types'
import { getR2Object, listR2Objects, putR2Object } from './r2'

const SPOTIFY_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token'
const SPOTIFY_PLAYER_ENDPOINT = 'https://api.spotify.com/v1/me/player'
const SPOTIFY_RECENTLY_PLAYED_ENDPOINT = 'https://api.spotify.com/v1/me/player/recently-played'
const SPOTIFY_TOP_TRACKS_ENDPOINT = 'https://api.spotify.com/v1/me/top/tracks'
const SPOTIFY_TOP_ARTISTS_ENDPOINT = 'https://api.spotify.com/v1/me/top/artists'
const SPOTIFY_SAVED_TRACKS_ENDPOINT = 'https://api.spotify.com/v1/me/tracks'
const SPOTIFY_SAVED_ALBUMS_ENDPOINT = 'https://api.spotify.com/v1/me/albums'
const SPOTIFY_PLAYLISTS_ENDPOINT = 'https://api.spotify.com/v1/me/playlists'
const SPOTIFY_PLAYLIST_DETAILS_ENDPOINT = 'https://api.spotify.com/v1/playlists'

const RECENTLY_PLAYED_LIMIT = 12
const SAVED_TRACKS_PREVIEW_LIMIT = 24
const SAVED_ALBUMS_PREVIEW_LIMIT = 12
const SPOTIFY_META_KEY = 'spotify/meta.json'
const SPOTIFY_LATEST_DASHBOARD_KEY = 'spotify/latest/dashboard.json'
const SPOTIFY_LATEST_LIBRARY_KEY = 'spotify/latest/library.json'
export const SPOTIFY_SAVED_TRACKS_KEY = 'spotify/collection/saved-tracks.json'
const SPOTIFY_SAVED_ALBUMS_KEY = 'spotify/collection/saved-albums.json'
const SPOTIFY_PLAYLISTS_KEY = 'spotify/collection/playlists.json'
const SPOTIFY_PLAYLIST_SHARD_PATH = 'spotify/collection/playlists/'
const SPOTIFY_RANKINGS_KEY = 'spotify/history/rankings.json'
// 每个时间范围最多保留的排行快照数（变化触发而非每次同步触发，90条约覆盖数月变化历史）
const RANKINGS_SNAPSHOTS_LIMIT = 90
const SPOTIFY_RECENTLY_PLAYED_PATH = 'spotify/history/recently-played/'
const RECENTLY_PLAYED_DAY_SHARD_PATTERN = /^\d{4}-\d{2}-\d{2}\.json$/
const CONTEXT_LABEL_CACHE = new Map<string, string>()
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


interface SpotifySyncResult {
  syncedAt: string
  snapshotUrl: string | null
  summary: {
    recentlyPlayed: number
    topTracks: number
    topArtists: number
    savedTracks: number
    savedAlbums: number
    playlists: number
    warnings: number
  }
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

type SpotifyPagingResponse<T> = {
  items: T[]
  next: string | null
  total: number
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

type SpotifyRecentlyPlayedItem = {
  track: SpotifyTrackObject
  played_at: string
  context?: {
    type?: string
    href?: string | null
    uri?: string | null
    external_urls?: { spotify?: string }
  } | null
}

type SpotifySavedTrackItem = {
  added_at: string
  track: SpotifyTrackObject | null
}

type SpotifySavedAlbumItem = {
  added_at: string
  album: SpotifyAlbumObject
}

type SpotifyPlaylistObject = {
  id: string
  name: string
  description: string
  snapshot_id?: string | null
  images: SpotifyImage[] | null
  external_urls?: { spotify?: string }
  owner?: { display_name?: string | null }
  tracks?: { total?: number }
  public?: boolean | null
}

type SpotifyPlaylistTrackItem = {
  added_at: string | null
  track: SpotifyTrackObject | null
}

type SpotifyPlaylistTracksResponse = {
  items: SpotifyPlaylistTrackItem[]
  next: string | null
  total: number
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

function createEmptyRankingsHistory(): SpotifyRankingsHistory {
  return {
    topTracks: {
      short_term: [],
      medium_term: [],
      long_term: [],
    },
    topArtists: {
      short_term: [],
      medium_term: [],
      long_term: [],
    },
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

async function writeR2Json(bucket: string, key: string, payload: unknown) {
  await putR2Object(
    bucket,
    key,
    JSON.stringify(payload, null, 2),
    'application/json; charset=utf-8',
    { cacheControl: 'no-store' }
  )
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

function humanizeContextType(type: string | undefined | null) {
  switch (type) {
    case 'playlist':
      return '歌单'
    case 'album':
      return '专辑'
    case 'artist':
      return '歌手'
    case 'collection':
      return '收藏集'
    case 'show':
      return '节目'
    case 'station':
      return '电台'
    default:
      return '来源'
  }
}

function decodeHtmlEntities(input: string) {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
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

function toAlbumSummary(album: SpotifyAlbumObject): SpotifyAlbumSummary {
  return {
    id: album.id ?? album.name,
    name: album.name,
    imageUrl: album.images[0]?.url ?? null,
    url: album.external_urls?.spotify ?? '',
    artists: album.artists.map((artist) => artist.name),
    releaseDate: album.release_date ?? null,
    totalTracks: album.total_tracks ?? null,
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

async function resolveContextLabel(accessToken: string, context: SpotifyRecentlyPlayedItem['context']) {
  const contextType = context?.type ?? null
  const fallbackLabel = humanizeContextType(contextType)

  if (!context?.href) {
    return fallbackLabel
  }

  if (CONTEXT_LABEL_CACHE.has(context.href)) {
    return CONTEXT_LABEL_CACHE.get(context.href)!
  }

  try {
    const payload = await requestSpotify<{ name?: string }>(accessToken, context.href)
    const label = payload.name ?? fallbackLabel
    CONTEXT_LABEL_CACHE.set(context.href, label)
    return label
  } catch {
    return fallbackLabel
  }
}

async function getRecentlyPlayed(
  accessToken: string,
  limit: number,
  options: { resolveContext?: boolean; after?: number } = {}
): Promise<SpotifyRecentlyPlayedTrack[]> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (options.after) params.set('after', String(options.after))
  const recent = await requestSpotify<{ items: SpotifyRecentlyPlayedItem[] }>(
    accessToken,
    `${SPOTIFY_RECENTLY_PLAYED_ENDPOINT}?${params}`
  )

  let labelsByHref = new Map<string, string>()

  if (options.resolveContext) {
    const uniqueContexts = Array.from(
      new Map(
        recent.items
          .filter((item) => item.context?.href)
          .map((item) => [item.context?.href as string, item.context])
      ).values()
    )

    const resolvedLabels = await Promise.all(
      uniqueContexts.map(async (context) => {
        const label = await resolveContextLabel(accessToken, context)
        return [context?.href as string, label] as const
      })
    )

    labelsByHref = new Map(resolvedLabels)
  }

  return recent.items.map((item) => {
    const track = toTrackSummary(item.track)
    const contextLabel = item.context?.href
      ? labelsByHref.get(item.context.href) ?? humanizeContextType(item.context.type)
      : humanizeContextType(item.context?.type)

    const context: SpotifyContextSource | null = item.context
      ? {
          type: item.context.type ?? 'unknown',
          label: contextLabel,
          uri: item.context.uri ?? null,
          href: item.context.href ?? null,
          externalUrl: item.context.external_urls?.spotify ?? null,
        }
      : null

    return {
      ...track,
      playedAt: item.played_at,
      context,
    }
  })
}


async function getTopTracksByRange(accessToken: string, range: SpotifyTimeRange): Promise<SpotifyTopTrack[]> {
  const response = await requestSpotify<SpotifyPagingResponse<SpotifyTrackObject>>(
    accessToken,
    `${SPOTIFY_TOP_TRACKS_ENDPOINT}?limit=50&time_range=${range}`
  )

  return response.items.map((track, index) => ({
    ...toTrackSummary(track),
    rank: index + 1,
  }))
}

async function getTopArtistsByRange(accessToken: string, range: SpotifyTimeRange): Promise<SpotifyTopArtist[]> {
  const response = await requestSpotify<SpotifyPagingResponse<SpotifyArtistObject>>(
    accessToken,
    `${SPOTIFY_TOP_ARTISTS_ENDPOINT}?limit=50&time_range=${range}`
  )

  return response.items.map((artist, index) => ({
    id: artist.id ?? artist.name,
    name: artist.name,
    imageUrl: artist.images?.[0]?.url ?? null,
    url: artist.external_urls?.spotify ?? '',
    genres: artist.genres ?? [],
    followers: artist.followers?.total ?? null,
    popularity: artist.popularity ?? null,
    rank: index + 1,
  }))
}

async function getAllTopTracks(accessToken: string) {
  const entries = await Promise.all(
    SPOTIFY_TIME_RANGES.map(async (range) => {
      const items = await getTopTracksByRange(accessToken, range)
      return [range, items] as const
    })
  )

  return Object.fromEntries(entries) as Record<SpotifyTimeRange, SpotifyTopTrack[]>
}

async function getAllTopArtists(accessToken: string) {
  const entries = await Promise.all(
    SPOTIFY_TIME_RANGES.map(async (range) => {
      const items = await getTopArtistsByRange(accessToken, range)
      return [range, items] as const
    })
  )

  return Object.fromEntries(entries) as Record<SpotifyTimeRange, SpotifyTopArtist[]>
}

async function getSavedTracksPreview(accessToken: string): Promise<SpotifyCollectionPreview<SpotifySavedTrack>> {
  const response = await requestSpotify<SpotifyPagingResponse<SpotifySavedTrackItem>>(
    accessToken,
    `${SPOTIFY_SAVED_TRACKS_ENDPOINT}?limit=${SAVED_TRACKS_PREVIEW_LIMIT}`
  )

  return {
    total: response.total,
    items: response.items
      .filter((item) => item.track)
      .map((item) => ({
        addedAt: item.added_at,
        track: toTrackSummary(item.track as SpotifyTrackObject),
      })),
  }
}

async function getSavedAlbumsPreview(accessToken: string): Promise<SpotifyCollectionPreview<SpotifySavedAlbum>> {
  const response = await requestSpotify<SpotifyPagingResponse<SpotifySavedAlbumItem>>(
    accessToken,
    `${SPOTIFY_SAVED_ALBUMS_ENDPOINT}?limit=${SAVED_ALBUMS_PREVIEW_LIMIT}`
  )

  return {
    total: response.total,
    items: response.items.map((item) => ({
      addedAt: item.added_at,
      album: toAlbumSummary(item.album),
    })),
  }
}

async function getAllPlaylists(accessToken: string) {
  const playlists: SpotifyPlaylistObject[] = []
  let nextUrl: string | null = `${SPOTIFY_PLAYLISTS_ENDPOINT}?limit=50`

  while (nextUrl) {
    const response: SpotifyPagingResponse<SpotifyPlaylistObject> = await requestSpotify(
      accessToken,
      nextUrl
    )
    playlists.push(...response.items)
    nextUrl = response.next
  }

  return playlists
}

async function getPlaylistTracks(accessToken: string, playlistId: string): Promise<SpotifyPlaylistTrack[]> {
  const fields = 'total,next,items(added_at,track(id,uri,name,duration_ms,popularity,external_urls,artists(id,name,external_urls),album(id,name,images,external_urls,artists(name),release_date,total_tracks)))'
  const firstUrl = `${SPOTIFY_PLAYLIST_DETAILS_ENDPOINT}/${playlistId}/tracks?limit=100&fields=${fields}`
  
  const firstResponse: SpotifyPlaylistTracksResponse = await requestSpotify(accessToken, firstUrl)
  const tracks: SpotifyPlaylistTrack[] = firstResponse.items
    .filter((item) => item.track)
    .map((item) => ({
      addedAt: item.added_at,
      track: toTrackSummary(item.track as SpotifyTrackObject),
    }))

  const total = firstResponse.total
  if (total <= 100) {
    return tracks
  }

  // Calculate remaining offsets
  const offsets = []
  for (let offset = 100; offset < total; offset += 100) {
    offsets.push(offset)
  }

  // Fetch remaining pages in parallel (with concurrency limit of 5)
  const concurrencyLimit = 5
  for (let i = 0; i < offsets.length; i += concurrencyLimit) {
    const chunk = offsets.slice(i, i + concurrencyLimit)
    const responses = await Promise.all(
      chunk.map((offset) =>
        requestSpotify<SpotifyPlaylistTracksResponse>(
          accessToken,
          `${SPOTIFY_PLAYLIST_DETAILS_ENDPOINT}/${playlistId}/tracks?limit=100&offset=${offset}&fields=${fields}`
        )
      )
    )

    for (const response of responses) {
      tracks.push(
        ...response.items
          .filter((item) => item.track)
          .map((item) => ({
            addedAt: item.added_at,
            track: toTrackSummary(item.track as SpotifyTrackObject),
          }))
      )
    }
  }

  return tracks
}

async function getPlaylists(
  accessToken: string,
  archivedPlaylists: SpotifyPlaylist[] = []
): Promise<SpotifyCollectionPreview<SpotifyPlaylist>> {
  const playlists = await getAllPlaylists(accessToken)
  const archivedById = new Map(archivedPlaylists.map((playlist) => [playlist.id, playlist]))
  const withTracks = await Promise.all(
    playlists.map(async (playlist) => {
      const archived = archivedById.get(playlist.id)
      const snapshotId = playlist.snapshot_id ?? null
      const shouldReuseTracks = Boolean(
        archived &&
        archived.snapshotId &&
        snapshotId &&
        archived.snapshotId === snapshotId &&
        archived.tracks.length > 0
      )

      return {
        id: playlist.id,
        name: playlist.name,
        description: decodeHtmlEntities(playlist.description || ''),
        imageUrl: playlist.images?.[0]?.url ?? null,
        url: playlist.external_urls?.spotify ?? '',
        snapshotId,
        ownerName: playlist.owner?.display_name ?? null,
        totalTracks: playlist.tracks?.total ?? 0,
        isPublic: playlist.public ?? null,
        tracks: shouldReuseTracks ? archived?.tracks ?? [] : await getPlaylistTracks(accessToken, playlist.id),
      }
    })
  )

  return {
    total: playlists.length,
    items: withTracks,
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

async function fetchSpotifyDashboardDataFromApi(
  options: {
    archivedPlaylists?: SpotifyPlaylist[]
    mode?: 'quick' | 'full'
    afterMs?: number
  } = {}
): Promise<SpotifyStoredDashboardSnapshot> {
  const mode = options.mode ?? 'full'
  const accessToken = await getSpotifyAccessToken()

  const [
    recentlyPlayedResult,
    topTracksResult,
    topArtistsResult,
    savedTracksResult,
    savedAlbumsResult,
    playlistsResult,
  ] = await Promise.allSettled([
    getRecentlyPlayed(accessToken, RECENTLY_PLAYED_LIMIT, { resolveContext: true, after: options.afterMs }),
    mode === 'full' ? getAllTopTracks(accessToken) : Promise.reject('skipped'),
    mode === 'full' ? getAllTopArtists(accessToken) : Promise.reject('skipped'),
    mode === 'full' ? getSavedTracksPreview(accessToken) : Promise.reject('skipped'),
    mode === 'full' ? getSavedAlbumsPreview(accessToken) : Promise.reject('skipped'),
    mode === 'full' ? getPlaylists(accessToken, options.archivedPlaylists) : Promise.reject('skipped'),
  ])

  const warnings: string[] = []

  function unwrapSettled<T>(
    result: PromiseSettledResult<T>,
    fallback: T,
    label: string
  ) {
    if (result.status === 'fulfilled') {
      return result.value
    }

    if (result.reason !== 'skipped') {
      console.error(`Failed to load Spotify ${label}:`, result.reason)
      warnings.push(`${label} 暂时不可用`)
    }
    
    return fallback
  }

  return {
    fetchedAt: new Date().toISOString(),
    recentlyPlayed: unwrapSettled(recentlyPlayedResult, [], '最近播放'),
    topTracks: unwrapSettled(topTracksResult, emptyTopTracksRecord(), 'Top Tracks'),
    topArtists: unwrapSettled(topArtistsResult, emptyTopArtistsRecord(), 'Top Artists'),
    library: {
      savedTracks: unwrapSettled(savedTracksResult, { total: 0, items: [] }, '已点赞歌曲'),
      savedAlbums: unwrapSettled(savedAlbumsResult, { total: 0, items: [] }, '已收藏专辑'),
      playlists: unwrapSettled(playlistsResult, { total: 0, items: [] }, '歌单'),
    },
    warnings,
  }
}

function mergeByKey<T>(
  currentItems: T[],
  incomingItems: T[],
  getKey: (item: T) => string
) {
  const merged = new Map<string, T>()

  for (const item of incomingItems) {
    merged.set(getKey(item), item)
  }

  for (const item of currentItems) {
    const key = getKey(item)
    if (!merged.has(key)) {
      merged.set(key, item)
    }
  }

  return Array.from(merged.values())
}

function mergePlaylistHistory(currentItems: SpotifyPlaylist[], incomingItems: SpotifyPlaylist[]) {
  const merged = new Map<string, SpotifyPlaylist>()

  for (const playlist of currentItems) {
    merged.set(playlist.id, playlist)
  }

  for (const playlist of incomingItems) {
    const existing = merged.get(playlist.id)
    if (!existing) {
      merged.set(playlist.id, playlist)
      continue
    }

    merged.set(playlist.id, {
      ...existing,
      ...playlist,
      tracks: mergeByKey(existing.tracks, playlist.tracks, (item) => `${item.track.id}:${item.addedAt ?? 'na'}`),
    })
  }

  return Array.from(merged.values())
}

function areRankedListsEqual<T extends { id: string }>(
  previous: SpotifyArchiveListSnapshot<T> | undefined,
  nextItems: T[]
) {
  if (!previous) {
    return false
  }

  if (previous.items.length !== nextItems.length) {
    return false
  }

  return previous.items.every((item, index) => item.id === nextItems[index]?.id)
}

function appendTrackSnapshots(
  history: Record<SpotifyTimeRange, SpotifyArchiveListSnapshot<SpotifyTopTrack>[]>,
  topTracks: Record<SpotifyTimeRange, SpotifyTopTrack[]>,
  capturedAt: string
) {
  for (const range of SPOTIFY_TIME_RANGES) {
    let snapshots = history[range]
    const items = topTracks[range]
    const previous = snapshots[snapshots.length - 1]

    if (!areRankedListsEqual(previous, items)) {
      snapshots.push({ capturedAt, items })
    }
    if (snapshots.length > RANKINGS_SNAPSHOTS_LIMIT) {
      snapshots = snapshots.slice(snapshots.length - RANKINGS_SNAPSHOTS_LIMIT)
      history[range] = snapshots
    }
  }
}

function appendArtistSnapshots(
  history: Record<SpotifyTimeRange, SpotifyArchiveListSnapshot<SpotifyTopArtist>[]>,
  topArtists: Record<SpotifyTimeRange, SpotifyTopArtist[]>,
  capturedAt: string
) {
  for (const range of SPOTIFY_TIME_RANGES) {
    let snapshots = history[range]
    const items = topArtists[range]
    const previous = snapshots[snapshots.length - 1]

    if (!areRankedListsEqual(previous, items)) {
      snapshots.push({ capturedAt, items })
    }
    if (snapshots.length > RANKINGS_SNAPSHOTS_LIMIT) {
      snapshots = snapshots.slice(snapshots.length - RANKINGS_SNAPSHOTS_LIMIT)
      history[range] = snapshots
    }
  }
}

async function readSpotifyMeta(): Promise<SpotifySyncMeta> {
  const { bucket } = getSpotifyArchiveConfig()
  if (!bucket) return createEmptySyncMeta()
  const meta = await readR2JsonIfExists<SpotifySyncMeta>(bucket, SPOTIFY_META_KEY)
  return meta ?? createEmptySyncMeta()
}

export async function readSpotifyRankings(): Promise<SpotifyRankingsHistory> {
  const { bucket } = getSpotifyArchiveConfig()
  if (!bucket) return createEmptyRankingsHistory()
  const rankings = await readR2JsonIfExists<SpotifyRankingsHistory>(bucket, SPOTIFY_RANKINGS_KEY)
  return rankings ?? createEmptyRankingsHistory()
}

export async function readSpotifyCollection<T>(key: string): Promise<SpotifyCollectionPreview<T>> {
  const { bucket } = getSpotifyArchiveConfig()
  if (!bucket) return { total: 0, items: [] }
  const collection = await readR2JsonIfExists<SpotifyCollectionPreview<T>>(bucket, key)
  return collection ?? { total: 0, items: [] }
}

async function readRecentlyPlayedShard(yearMonth: string): Promise<SpotifyRecentlyPlayedTrack[]> {
  const { bucket } = getSpotifyArchiveConfig()
  if (!bucket) return []
  const shard = await readR2JsonIfExists<SpotifyRecentlyPlayedTrack[]>(
    bucket,
    `${SPOTIFY_RECENTLY_PLAYED_PATH}${yearMonth}.json`
  )
  return shard ?? []
}

export async function readRecentlyPlayedDayShard(date: string): Promise<SpotifyRecentlyPlayedTrack[]> {
  const { bucket } = getSpotifyArchiveConfig()
  if (!bucket) return []

  const shard = await readR2JsonIfExists<SpotifyRecentlyPlayedTrack[]>(
    bucket,
    `${SPOTIFY_RECENTLY_PLAYED_PATH}${date}.json`
  )

  return (shard ?? []).toSorted(
    (a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
  )
}

export async function readSpotifyPlaylistShard(id: string): Promise<SpotifyPlaylistTrack[]> {
  const { bucket } = getSpotifyArchiveConfig()
  if (!bucket) return []
  const tracks = await readR2JsonIfExists<SpotifyPlaylistTrack[]>(
    bucket,
    `${SPOTIFY_PLAYLIST_SHARD_PATH}${id}.json`
  )
  return tracks ?? []
}

async function writeSpotifyPlaylistShard(id: string, tracks: SpotifyPlaylistTrack[]) {
  const { bucket } = getSpotifyArchiveConfig()
  if (!bucket) return
  await writeR2Json(bucket, `${SPOTIFY_PLAYLIST_SHARD_PATH}${id}.json`, tracks)
}

function getYearMonth(date: Date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function getYearMonthDay(date: Date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function writeRecentlyPlayedShard(yearMonth: string, items: SpotifyRecentlyPlayedTrack[]) {
  const { bucket } = getSpotifyArchiveConfig()
  if (!bucket) return
  await writeR2Json(bucket, `${SPOTIFY_RECENTLY_PLAYED_PATH}${yearMonth}.json`, items)
}

async function writeRecentlyPlayedDayShard(date: string, items: SpotifyRecentlyPlayedTrack[]) {
  const { bucket } = getSpotifyArchiveConfig()
  if (!bucket) return
  await writeR2Json(bucket, `${SPOTIFY_RECENTLY_PLAYED_PATH}${date}.json`, items)
}

export async function listRecentlyPlayedDays(limitDays = 90): Promise<string[]> {
  const { bucket } = getSpotifyArchiveConfig()
  if (!bucket) return []

  const keys = await listR2Objects(bucket, SPOTIFY_RECENTLY_PLAYED_PATH)

  return keys
    .map((key) => key.slice(SPOTIFY_RECENTLY_PLAYED_PATH.length))
    .filter((name) => RECENTLY_PLAYED_DAY_SHARD_PATTERN.test(name))
    .map((name) => name.replace(/\.json$/, ''))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, Math.max(limitDays, 0))
}

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

export const getStoredSpotifyDashboardData = cache(async function getStoredSpotifyDashboardData(): Promise<SpotifyDashboardData> {
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
})


export async function syncSpotifyDashboardToArchive(
  options: { mode?: 'quick' | 'full' } = {}
): Promise<SpotifySyncResult> {
  const mode = options.mode ?? 'full'
  const { bucket, publicDomain } = getSpotifyArchiveConfig()
  if (!bucket) {
    throw new Error('Missing R2_SPOTIFY_BUCKET')
  }

  const syncedAt = new Date().toISOString()

  const [meta, latestLibrary, existingDashboard] = await Promise.all([
    readSpotifyMeta(),
    mode === 'quick' ? readLatestSpotifyLibrary() : Promise.resolve(null),
    readLatestSpotifyDashboard(),
  ])

  // Full sync: 读取全量集合用于增量合并；Quick sync: 跳过，library 数据从上次快照继承
  const [
    existingTracks,
    existingAlbums,
    existingPlaylists
  ] = mode === 'full'
    ? await Promise.all([
        readSpotifyCollection<SpotifySavedTrack>(SPOTIFY_SAVED_TRACKS_KEY),
        readSpotifyCollection<SpotifySavedAlbum>(SPOTIFY_SAVED_ALBUMS_KEY),
        readSpotifyCollection<SpotifyPlaylist>(SPOTIFY_PLAYLISTS_KEY),
      ])
    : [
        { total: 0, items: [] as SpotifySavedTrack[] },
        { total: 0, items: [] as SpotifySavedAlbum[] },
        { total: 0, items: [] as SpotifyPlaylist[] },
      ]

  const afterMs = mode === 'quick' && meta.lastSyncedAt
    ? new Date(meta.lastSyncedAt).getTime()
    : undefined

  const liveDashboard = await fetchSpotifyDashboardDataFromApi({
    archivedPlaylists: existingPlaylists.items,
    mode,
    afterMs,
  })

  // 1. 处理最近播放记录 (保留月分片兼容，同时补写日分片用于时间轴浏览)
  const tracksByMonth = new Map<string, SpotifyRecentlyPlayedTrack[]>()
  const tracksByDay = new Map<string, SpotifyRecentlyPlayedTrack[]>()
  for (const track of liveDashboard.recentlyPlayed) {
    const playedAt = new Date(track.playedAt)
    const month = getYearMonth(playedAt)
    const day = getYearMonthDay(playedAt)
    const group = tracksByMonth.get(month) ?? []
    const dayGroup = tracksByDay.get(day) ?? []
    group.push(track)
    dayGroup.push(track)
    tracksByMonth.set(month, group)
    tracksByDay.set(day, dayGroup)
  }

  const writePromises: Promise<void>[] = []

  const allMergedRecentlyPlayed: SpotifyRecentlyPlayedTrack[] = []

  if (tracksByMonth.size > 0) {
    const shardMonths = Array.from(tracksByMonth.keys())
    const existingShards = await Promise.all(shardMonths.map(readRecentlyPlayedShard))
    for (let i = 0; i < shardMonths.length; i++) {
      const month = shardMonths[i]
      const merged = mergeByKey(
        existingShards[i],
        tracksByMonth.get(month)!,
        (item) => `${item.id}:${item.playedAt}`
      )
      allMergedRecentlyPlayed.push(...merged)
      writePromises.push(writeRecentlyPlayedShard(month, merged))
    }
  }

  if (tracksByDay.size > 0) {
    const shardDays = Array.from(tracksByDay.keys())
    const existingDayShards = await Promise.all(shardDays.map(readRecentlyPlayedDayShard))

    for (let i = 0; i < shardDays.length; i++) {
      const day = shardDays[i]
      const merged = mergeByKey(
        existingDayShards[i],
        tracksByDay.get(day)!,
        (item) => `${item.id}:${item.playedAt}`
      ).toSorted((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())

      writePromises.push(writeRecentlyPlayedDayShard(day, merged))
    }
  }

  // 2. 处理 Library 板块 (增量合并，仅 full sync)
  let snapshotLibrary: SpotifyStoredDashboardSnapshot['library']

  if (mode === 'full') {
    const nextTracks = {
      total: liveDashboard.library.savedTracks.total,
      previewLimit: SAVED_TRACKS_PREVIEW_LIMIT,
      items: mergeByKey(existingTracks.items, liveDashboard.library.savedTracks.items, (item) => `${item.track.id}:${item.addedAt}`)
    }
    const nextAlbums = {
      total: liveDashboard.library.savedAlbums.total,
      previewLimit: SAVED_ALBUMS_PREVIEW_LIMIT,
      items: mergeByKey(existingAlbums.items, liveDashboard.library.savedAlbums.items, (item) => `${item.album.id}:${item.addedAt}`)
    }
    const nextPlaylists = {
      total: liveDashboard.library.playlists.total,
      items: mergePlaylistHistory(existingPlaylists.items, liveDashboard.library.playlists.items as unknown as SpotifyPlaylist[])
    }

    writePromises.push(writeR2Json(bucket, SPOTIFY_SAVED_TRACKS_KEY, nextTracks))
    writePromises.push(writeR2Json(bucket, SPOTIFY_SAVED_ALBUMS_KEY, nextAlbums))
    writePromises.push(writeR2Json(bucket, SPOTIFY_PLAYLISTS_KEY, nextPlaylists))

    // 同步歌单曲目分片 (仅同步本次抓取到的歌单中包含曲目的部分，通常是 snapshot 变动的歌单)
    for (const playlist of liveDashboard.library.playlists.items) {
      const fullPlaylist = playlist as unknown as SpotifyPlaylist
      if (fullPlaylist.tracks && fullPlaylist.tracks.length > 0) {
        writePromises.push(writeSpotifyPlaylistShard(fullPlaylist.id, fullPlaylist.tracks))
      }
    }

    const strippedPlaylists: SpotifyCollectionPreview<SpotifyPlaylistPreview> = {
      ...liveDashboard.library.playlists,
      items: liveDashboard.library.playlists.items.map((playlist) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { tracks, ...preview } = playlist as unknown as SpotifyPlaylist
        return preview
      })
    }

    snapshotLibrary = {
      savedTracks: nextTracks,
      savedAlbums: nextAlbums,
      playlists: strippedPlaylists,
    }
    writePromises.push(writeR2Json(bucket, SPOTIFY_LATEST_LIBRARY_KEY, snapshotLibrary))
  } else {
    // Quick sync: library 直接继承上次全量快照，不重新请求也不重写 R2 集合文件
    snapshotLibrary = latestLibrary ?? {
      savedTracks: { total: 0, items: [] },
      savedAlbums: { total: 0, items: [] },
      playlists: { total: 0, items: [] },
    }
  }

  // 3. 处理 Top 榜单快照
  const rankings = await readSpotifyRankings()

  if (mode === 'full') {
    appendTrackSnapshots(rankings.topTracks, liveDashboard.topTracks, syncedAt)
    appendArtistSnapshots(rankings.topArtists, liveDashboard.topArtists, syncedAt)
    writePromises.push(writeR2Json(bucket, SPOTIFY_RANKINGS_KEY, rankings))
  } else {
    // Quick Sync: 从历史排行榜中填充，避免由于跳过 API 调用导致 dashboard.json 中的排行榜被置空
    const lastTracks = {
      short: rankings.topTracks.short_term[rankings.topTracks.short_term.length - 1],
      medium: rankings.topTracks.medium_term[rankings.topTracks.medium_term.length - 1],
      long: rankings.topTracks.long_term[rankings.topTracks.long_term.length - 1]
    }

    liveDashboard.topTracks = {
      short_term: lastTracks.short?.items ?? [],
      medium_term: lastTracks.medium?.items ?? [],
      long_term: lastTracks.long?.items ?? [],
    }

    const lastArtists = {
      short: rankings.topArtists.short_term[rankings.topArtists.short_term.length - 1],
      medium: rankings.topArtists.medium_term[rankings.topArtists.medium_term.length - 1],
      long: rankings.topArtists.long_term[rankings.topArtists.long_term.length - 1]
    }

    liveDashboard.topArtists = {
      short_term: lastArtists.short?.items ?? [],
      medium_term: lastArtists.medium?.items ?? [],
      long_term: lastArtists.long?.items ?? [],
    }
  }

  // 若本次 quick sync 未拉到任何新曲目（afterMs 过滤后为空），回落到现有 dashboard 中的数据，
  // 避免用空数组覆盖已归档的 recentlyPlayed。
  const sortedRecentlyPlayed = allMergedRecentlyPlayed.length > 0
    ? [...allMergedRecentlyPlayed].sort(
        (a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
      )
    : (existingDashboard?.data?.recentlyPlayed ?? [])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { library: _library, ...liveDashboardWithoutLibrary } = {
    ...liveDashboard,
    recentlyPlayed: sortedRecentlyPlayed.slice(0, RECENTLY_PLAYED_LIMIT),
    fetchedAt: syncedAt,
  }

  const latestFile: SpotifyLatestDashboardFile = {
    schemaVersion: SPOTIFY_ARCHIVE_SCHEMA_VERSION,
    syncedAt,
    data: liveDashboardWithoutLibrary,
  }
  writePromises.push(writeR2Json(bucket, SPOTIFY_LATEST_DASHBOARD_KEY, latestFile))

  // 4. 更新元数据
  const nextMeta: SpotifySyncMeta = {
    ...meta,
    lastSyncedAt: syncedAt,
    lastFullSyncedAt: mode === 'full' ? syncedAt : meta.lastFullSyncedAt,
    syncCount: meta.syncCount + 1,
    syncLog: [
      { syncedAt, mode, warnings: liveDashboard.warnings },
      ...meta.syncLog.slice(0, 19), // 保留最近20条日志
    ],
  }
  writePromises.push(writeR2Json(bucket, SPOTIFY_META_KEY, nextMeta))

  // 等待所有写入完成
  await Promise.all(writePromises)

  return {
    syncedAt,
    snapshotUrl: buildSpotifySnapshotUrl(publicDomain, SPOTIFY_LATEST_DASHBOARD_KEY),
    summary: {
      recentlyPlayed: liveDashboard.recentlyPlayed.length,
      topTracks: liveDashboard.topTracks.medium_term.length,
      topArtists: liveDashboard.topArtists.medium_term.length,
      savedTracks: liveDashboard.library.savedTracks.total,
      savedAlbums: liveDashboard.library.savedAlbums.total,
      playlists: liveDashboard.library.playlists.total,
      warnings: liveDashboard.warnings.length,
    },
  }
}