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

export interface SpotifyTrackTagCandidate {
  trackId: string
  title: string
  artist: string
}

export interface SpotifyTrackTagValue {
  name: string
  count: number
}

export interface SpotifyTrackTagEntry {
  trackId: string
  artist: string
  title: string
  fetchedAt: string
  tagSource?: 'track' | 'artist'
  tags: SpotifyTrackTagValue[]
}

export interface SpotifyTrackTagStore {
  schemaVersion: 1
  lastUpdatedAt: string
  tracks: Record<string, SpotifyTrackTagEntry>
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

export type TimeSegmentId = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night'

export interface TimeSegment {
  id: TimeSegmentId
  label: string
  startHour: number
  endHour: number
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
  previewLimit?: number
  items: T[]
}

export interface SpotifySyncSummary {
  recentlyPlayed: number
  topTracks: number
  topArtists: number
  savedTracks: number
  savedAlbums: number
  playlists: number
  warnings: number
  tagsUpdated: number
}

export interface SpotifySyncResult {
  syncedAt: string
  snapshotUrl: string | null
  summary: SpotifySyncSummary
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

export type SpotifyTagSection =
  | 'short_term'
  | 'medium_term'
  | 'long_term'
  | 'saved'
  | 'recent'

export interface TagAggregation {
  name: string
  totalCount: number
  trackCount: number
}

export interface TagRadarAxis {
  label: string
  score: number
  trackCount: number
}

export interface SpotifyTagSectionResult {
  topTags: TagAggregation[]
  radarAxes: TagRadarAxis[]
  tracksWithTags: number
}

export type SpotifyTagAnalysis = Record<SpotifyTagSection, SpotifyTagSectionResult>

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
  progressMs?: number | null
  durationMs?: number | null
  recentTracks?: SpotifyNowPlayingRecentTrack[]
}
