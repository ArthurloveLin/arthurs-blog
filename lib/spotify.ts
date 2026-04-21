import 'server-only'

import { cache } from 'react'

import {
  SPOTIFY_TIME_RANGES,
  type SpotifyAlbumSummary,
  type SpotifyCollectionPreview,
  type SpotifyContextSource,
  type SpotifyDashboardData,
  type SpotifyFollowedArtist,
  type SpotifyNowPlayingData,
  type SpotifyPlaylist,
  type SpotifyPlaylistTrack,
  type SpotifyRecentlyPlayedTrack,
  type SpotifySavedAlbum,
  type SpotifySavedTrack,
  type SpotifyTimeRange,
  type SpotifyTopArtist,
  type SpotifyTopTrack,
  type SpotifyTrackSummary,
} from './spotify-types'

const SPOTIFY_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token'
const SPOTIFY_PLAYER_ENDPOINT = 'https://api.spotify.com/v1/me/player'
const SPOTIFY_RECENTLY_PLAYED_ENDPOINT = 'https://api.spotify.com/v1/me/player/recently-played'
const SPOTIFY_AUDIO_FEATURES_ENDPOINT = 'https://api.spotify.com/v1/audio-features'
const SPOTIFY_TOP_TRACKS_ENDPOINT = 'https://api.spotify.com/v1/me/top/tracks'
const SPOTIFY_TOP_ARTISTS_ENDPOINT = 'https://api.spotify.com/v1/me/top/artists'
const SPOTIFY_SAVED_TRACKS_ENDPOINT = 'https://api.spotify.com/v1/me/tracks'
const SPOTIFY_SAVED_ALBUMS_ENDPOINT = 'https://api.spotify.com/v1/me/albums'
const SPOTIFY_FOLLOWED_ARTISTS_ENDPOINT = 'https://api.spotify.com/v1/me/following'
const SPOTIFY_PLAYLISTS_ENDPOINT = 'https://api.spotify.com/v1/me/playlists'
const SPOTIFY_PLAYLIST_DETAILS_ENDPOINT = 'https://api.spotify.com/v1/playlists'

const RECENTLY_PLAYED_LIMIT = 12
const SAVED_TRACKS_PREVIEW_LIMIT = 24
const SAVED_ALBUMS_PREVIEW_LIMIT = 12
const FOLLOWED_ARTISTS_PREVIEW_LIMIT = 12

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

type SpotifyFollowedArtistsResponse = {
  artists: {
    items: SpotifyArtistObject[]
    total: number
  }
}

type SpotifyPlaylistObject = {
  id: string
  name: string
  description: string
  images: SpotifyImage[]
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
}

type SpotifyAudioFeaturesResponse = {
  tempo?: number
}

class SpotifyRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'SpotifyRequestError'
    this.status = status
  }
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

const getSpotifyAccessToken = cache(async () => {
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

  return payload.access_token
})

async function requestSpotify<T>(accessToken: string, endpoint: string, allowNoContent = false): Promise<T> {
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

    throw new SpotifyRequestError(errorMessage, response.status)
  }

  return response.json() as Promise<T>
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

function toFollowedArtist(artist: SpotifyArtistObject): SpotifyFollowedArtist {
  return {
    id: artist.id ?? artist.name,
    name: artist.name,
    imageUrl: artist.images?.[0]?.url ?? null,
    url: artist.external_urls?.spotify ?? '',
    genres: artist.genres ?? [],
    followers: artist.followers?.total ?? null,
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
  }
}

async function resolveContextLabel(accessToken: string, context: SpotifyRecentlyPlayedItem['context']) {
  const contextType = context?.type ?? null
  const fallbackLabel = humanizeContextType(contextType)

  if (!context?.href) {
    return fallbackLabel
  }

  try {
    const payload = await requestSpotify<{ name?: string }>(accessToken, context.href)
    return payload.name ?? fallbackLabel
  } catch {
    return fallbackLabel
  }
}

async function getRecentlyPlayed(
  accessToken: string,
  limit: number,
  options: { resolveContext?: boolean } = {}
): Promise<SpotifyRecentlyPlayedTrack[]> {
  const recent = await requestSpotify<{ items: SpotifyRecentlyPlayedItem[] }>(
    accessToken,
    `${SPOTIFY_RECENTLY_PLAYED_ENDPOINT}?limit=${limit}`
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

async function getTrackTempo(accessToken: string, trackId: string) {
  try {
    const response = await requestSpotify<SpotifyAudioFeaturesResponse>(
      accessToken,
      `${SPOTIFY_AUDIO_FEATURES_ENDPOINT}/${trackId}`
    )
    return response.tempo ?? null
  } catch {
    return null
  }
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

async function getFollowedArtistsPreview(accessToken: string): Promise<SpotifyCollectionPreview<SpotifyFollowedArtist>> {
  const response = await requestSpotify<SpotifyFollowedArtistsResponse>(
    accessToken,
    `${SPOTIFY_FOLLOWED_ARTISTS_ENDPOINT}?type=artist&limit=${FOLLOWED_ARTISTS_PREVIEW_LIMIT}`
  )

  return {
    total: response.artists.total,
    items: response.artists.items.map(toFollowedArtist),
  }
}

async function getAllPlaylists(accessToken: string) {
  const playlists: SpotifyPlaylistObject[] = []
  let nextUrl: string | null = `${SPOTIFY_PLAYLISTS_ENDPOINT}?limit=50`

  while (nextUrl) {
    const response = await requestSpotify<SpotifyPagingResponse<SpotifyPlaylistObject>>(accessToken, nextUrl)
    playlists.push(...response.items)
    nextUrl = response.next
  }

  return playlists
}

async function getPlaylistTracks(accessToken: string, playlistId: string): Promise<SpotifyPlaylistTrack[]> {
  const tracks: SpotifyPlaylistTrack[] = []
  let nextUrl: string | null = `${SPOTIFY_PLAYLIST_DETAILS_ENDPOINT}/${playlistId}/tracks?limit=100&fields=items(added_at,track(id,uri,name,duration_ms,popularity,external_urls,artists(id,name,external_urls),album(id,name,images,external_urls,artists(name),release_date,total_tracks))),next`

  while (nextUrl) {
    const response = await requestSpotify<SpotifyPlaylistTracksResponse>(accessToken, nextUrl)

    tracks.push(
      ...response.items
        .filter((item) => item.track)
        .map((item) => ({
          addedAt: item.added_at,
          track: toTrackSummary(item.track as SpotifyTrackObject),
        }))
    )

    nextUrl = response.next
  }

  return tracks
}

async function getPlaylists(accessToken: string): Promise<SpotifyCollectionPreview<SpotifyPlaylist>> {
  const playlists = await getAllPlaylists(accessToken)
  const withTracks = await Promise.all(
    playlists.map(async (playlist) => ({
      id: playlist.id,
      name: playlist.name,
      description: decodeHtmlEntities(playlist.description || ''),
      imageUrl: playlist.images[0]?.url ?? null,
      url: playlist.external_urls?.spotify ?? '',
      ownerName: playlist.owner?.display_name ?? null,
      totalTracks: playlist.tracks?.total ?? 0,
      isPublic: playlist.public ?? null,
      tracks: await getPlaylistTracks(accessToken, playlist.id),
    }))
  )

  return {
    total: playlists.length,
    items: withTracks,
  }
}

function normalizeNowPlayingRecentTrack(track: SpotifyRecentlyPlayedTrack) {
  return {
    id: track.id,
    title: track.title,
    artist: track.artists.join(', '),
    album: track.album,
    albumImageUrl: track.albumImageUrl,
    songUrl: track.songUrl,
    playedAt: track.playedAt,
  }
}

export const getSpotifyNowPlayingData = cache(async function getSpotifyNowPlayingData(): Promise<SpotifyNowPlayingData | null> {
  const accessToken = await getSpotifyAccessToken()
  const [currentPlayback, recentTracks] = await Promise.all([
    getCurrentPlayback(accessToken),
    getRecentlyPlayed(accessToken, 6),
  ])

  const matchingRecentTrack = currentPlayback?.track
    ? recentTracks.find((track) => track.id === currentPlayback.track.id)
    : null

  const fallbackTrack = !currentPlayback && recentTracks[0] ? recentTracks[0] : null
  const activeTrack = currentPlayback?.track ?? fallbackTrack

  if (!activeTrack) {
    return null
  }

  const recentPreview = recentTracks
    .filter((track) => {
      if (currentPlayback?.track) {
        return track.id !== currentPlayback.track.id
      }

      return track.playedAt !== fallbackTrack?.playedAt
    })
    .slice(0, 5)
    .map(normalizeNowPlayingRecentTrack)

  const playedAt = currentPlayback
    ? currentPlayback.isPlaying
      ? undefined
      : matchingRecentTrack?.playedAt ?? new Date().toISOString()
    : fallbackTrack?.playedAt

  const bpm = activeTrack.id ? await getTrackTempo(accessToken, activeTrack.id) : null

  return {
    isPlaying: currentPlayback?.isPlaying ?? false,
    isRecentlyPlayed: !currentPlayback,
    title: activeTrack.title,
    artist: activeTrack.artists.join(', '),
    album: activeTrack.album,
    albumImageUrl: activeTrack.albumImageUrl,
    songUrl: activeTrack.songUrl,
    deviceName: currentPlayback?.deviceName,
    deviceType: currentPlayback?.deviceType,
    playedAt,
    bpm,
    recentTracks: recentPreview,
  }
})

export const getSpotifyDashboardData = cache(async function getSpotifyDashboardData(): Promise<SpotifyDashboardData> {
  const accessToken = await getSpotifyAccessToken()

  const [
    recentlyPlayedResult,
    topTracksResult,
    topArtistsResult,
    savedTracksResult,
    savedAlbumsResult,
    followedArtistsResult,
    playlistsResult,
  ] = await Promise.allSettled([
    getRecentlyPlayed(accessToken, RECENTLY_PLAYED_LIMIT, { resolveContext: true }),
    getAllTopTracks(accessToken),
    getAllTopArtists(accessToken),
    getSavedTracksPreview(accessToken),
    getSavedAlbumsPreview(accessToken),
    getFollowedArtistsPreview(accessToken),
    getPlaylists(accessToken),
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

    console.error(`Failed to load Spotify ${label}:`, result.reason)
    warnings.push(`${label} 暂时不可用`)
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
      followedArtists: unwrapSettled(followedArtistsResult, { total: 0, items: [] }, '关注歌手'),
      playlists: unwrapSettled(playlistsResult, { total: 0, items: [] }, '歌单'),
    },
    warnings,
  }
})