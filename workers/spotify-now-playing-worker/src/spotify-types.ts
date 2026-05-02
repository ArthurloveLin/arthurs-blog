export interface SpotifyTrackSummary {
  id: string
  title: string
  artists: string[]
  album: string
  albumImageUrl: string | null
  songUrl: string
  durationMs: number
}

export interface SpotifyStoredRecentTrack {
  id: string
  title: string
  artists: string[]
  album: string
  albumImageUrl: string | null
  songUrl: string
  playedAt: string
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
  progressMs?: number | null
  durationMs?: number | null
  recentTracks?: SpotifyNowPlayingRecentTrack[]
}