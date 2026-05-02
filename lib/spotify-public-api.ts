type GeniusTrackQuery = {
  trackId?: string
  title: string
  artist: string
  durationMs?: number
}

function trimTrailingSlash(value: string | undefined) {
  return value?.replace(/\/+$/, '') ?? ''
}

function normalizePath(path: string) {
  return path.startsWith('/') ? path : `/${path}`
}

const spotifyWorkerBase = trimTrailingSlash(process.env.NEXT_PUBLIC_SPOTIFY_WORKER_URL)
const spotifyNowPlayingWorkerBase = trimTrailingSlash(process.env.NEXT_PUBLIC_SPOTIFY_NOW_PLAYING_WORKER_URL)
const geniusWorkerBase = trimTrailingSlash(process.env.NEXT_PUBLIC_GENIUS_WORKER_URL)
const GENIUS_PUBLIC_PATH = '/api/genius'

export function getSpotifyPublicApiUrl(path: string) {
  const normalizedPath = normalizePath(path)
  const workerBase = normalizedPath === '/api/now-playing'
    ? (spotifyNowPlayingWorkerBase || spotifyWorkerBase)
    : spotifyWorkerBase

  if (!workerBase) {
    throw new Error(`Missing Spotify worker URL for ${normalizedPath}`)
  }

  return `${workerBase}${normalizedPath}`
}

export function getGeniusPublicApiUrl(track: GeniusTrackQuery) {
  const search = new URLSearchParams()

  if (track.trackId) {
    search.set('trackId', track.trackId)
  }

  search.set('title', track.title)
  search.set('artist', track.artist)

  if (track.durationMs) {
    search.set('durationMs', String(track.durationMs))
  }

  if (!geniusWorkerBase) {
    return `${GENIUS_PUBLIC_PATH}?${search.toString()}`
  }

  const url = new URL(geniusWorkerBase)
  if (url.pathname === '/' || !url.pathname) {
    url.pathname = GENIUS_PUBLIC_PATH
  }

  search.forEach((value, key) => {
    url.searchParams.set(key, value)
  })

  return url.toString()
}