export const SPOTIFY_TIME_RANGES = ['short_term', 'medium_term', 'long_term'] as const

export type SpotifyTimeRange = (typeof SPOTIFY_TIME_RANGES)[number]

export interface SpotifyTrackSummary {
  id: string
  title: string
  artists: string[]
  album: string
  albumId: string | null
  albumImageUrl: string | null
  songUrl: string
  durationMs: number
  popularity: number | null
}

export interface SpotifyContextSource {
  type: string
  label: string
  uri: string | null
  href: string | null
  externalUrl: string | null
}

export interface SpotifyRecentlyPlayedTrack extends SpotifyTrackSummary {
  playedAt: string
  context: SpotifyContextSource | null
}

export interface SpotifyTopTrack extends SpotifyTrackSummary {
  rank: number
}

export interface SpotifyTopArtist {
  id: string
  name: string
  imageUrl: string | null
  url: string
  genres: string[]
  followers: number | null
  popularity: number | null
  rank: number
}

export interface SpotifyAlbumSummary {
  id: string
  name: string
  imageUrl: string | null
  url: string
  artists: string[]
  releaseDate: string | null
  totalTracks: number | null
}

export interface SpotifySavedTrack {
  addedAt: string
  track: SpotifyTrackSummary
}

export interface SpotifySavedAlbum {
  addedAt: string
  album: SpotifyAlbumSummary
}

export interface SpotifyFollowedArtist {
  id: string
  name: string
  imageUrl: string | null
  url: string
  genres: string[]
  followers: number | null
}

export interface SpotifyPlaylistTrack {
  addedAt: string | null
  track: SpotifyTrackSummary
}

export interface SpotifyPlaylist {
  id: string
  name: string
  description: string
  imageUrl: string | null
  url: string
  snapshotId?: string | null
  ownerName: string | null
  totalTracks: number
  isPublic: boolean | null
  tracks: SpotifyPlaylistTrack[]
}

export interface SpotifyCollectionPreview<T> {
  total: number
  items: T[]
}

export interface SpotifySyncMeta {
  lastSyncedAt: string | null
  lastFullSyncedAt: string | null
  syncCount: number
  schemaVersion: number
  syncLog: Array<{
    syncedAt: string
    mode: 'quick' | 'full'
    warnings: string[]
  }>
}

export interface SpotifyArchiveListSnapshot<T> {
  capturedAt: string
  items: T[]
}

export interface SpotifyRankingsHistory {
  topTracks: Record<SpotifyTimeRange, SpotifyArchiveListSnapshot<SpotifyTopTrack>[]>
  topArtists: Record<SpotifyTimeRange, SpotifyArchiveListSnapshot<SpotifyTopArtist>[]>
}

export interface SpotifyPlaylistPreview {
  id: string
  name: string
  description: string
  imageUrl: string | null
  url: string
  snapshotId?: string | null
  ownerName: string | null
  totalTracks: number
  isPublic: boolean | null
}

export interface SpotifyDashboardData {
  fetchedAt: string
  recentlyPlayed: SpotifyRecentlyPlayedTrack[]
  topTracks: Record<SpotifyTimeRange, SpotifyTopTrack[]>
  topArtists: Record<SpotifyTimeRange, SpotifyTopArtist[]>
  library: {
    savedTracks: SpotifyCollectionPreview<SpotifySavedTrack>
    savedAlbums: SpotifyCollectionPreview<SpotifySavedAlbum>
    followedArtists: SpotifyCollectionPreview<SpotifyFollowedArtist>
    playlists: SpotifyCollectionPreview<SpotifyPlaylistPreview>
  }
  warnings: string[]
  archiveMeta?: {
    source: 'r2-archive' | 'spotify-api' | 'empty'
    hasStoredSnapshot: boolean
    lastSyncedAt: string | null
    snapshotUrl: string | null
    syncCount: number
  }
}



export interface SpotifyNowPlayingRecentTrack {
  id: string
  title: string
  artist: string
  album: string
  albumImageUrl: string | null
  songUrl: string
  playedAt: string
}

export interface SpotifyNowPlayingData {
  isPlaying: boolean
  isRecentlyPlayed?: boolean
  title?: string
  artist?: string
  album?: string
  albumImageUrl?: string | null
  songUrl?: string
  deviceName?: string
  deviceType?: string
  playedAt?: string
  bpm?: number | null
  recentTracks?: SpotifyNowPlayingRecentTrack[]
}