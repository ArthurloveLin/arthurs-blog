import type { Env } from './env'
import { getR2Object, putR2Object } from './r2'
import {
  type SpotifyTrackTagCandidate,
  type SpotifyTrackTagEntry,
  type SpotifyTrackTagStore,
  type SpotifyTrackTagValue,
} from './spotify-types'

export const SPOTIFY_TRACK_TAGS_KEY = 'spotify/tags/track-tags.json'

const TRACK_TAG_STORE_SCHEMA_VERSION = 1
const LASTFM_ENDPOINT = 'https://ws.audioscrobbler.com/2.0/'
const LASTFM_TIMEOUT_MS = 5000
const LASTFM_REQUEST_INTERVAL_MS = 250

type LastfmTopTagsResponse = {
  error?: number
  message?: string
  toptags?: {
    tag?: Array<{ name?: string; count?: string | number }> | { name?: string; count?: string | number }
  }
}

export interface SpotifyTrackTagSyncResult {
  tagsUpdated: number
  warnings: string[]
}

function createEmptyTrackTagStore(): SpotifyTrackTagStore {
  return {
    schemaVersion: TRACK_TAG_STORE_SCHEMA_VERSION,
    lastUpdatedAt: new Date(0).toISOString(),
    tracks: {},
  }
}

function getSpotifyBucket(env: Env) {
  const bucket = env.SPOTIFY_BUCKET

  if (!bucket) {
    throw new Error('Missing R2_SPOTIFY_BUCKET')
  }

  return bucket
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

async function readR2JsonIfExists<T>(env: Env, bucket: unknown, key: string): Promise<T | null> {
  try {
    const raw = await getR2Object(env, key)
    return JSON.parse(raw) as T
  } catch (error) {
    if (isMissingR2ObjectError(error)) {
      return null
    }

    throw error
  }
}

async function writeR2Json(env: Env, bucket: unknown, key: string, payload: unknown) {
  await putR2Object(
    env,
    key,
    JSON.stringify(payload, null, 2),
    'application/json; charset=utf-8'
  )
}

async function fetchLastfmRaw(params: Record<string, string>, apiKey: string): Promise<SpotifyTrackTagValue[]> {
  const searchParams = new URLSearchParams({ ...params, api_key: apiKey, format: 'json' })
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LASTFM_TIMEOUT_MS)

  try {
    const response = await fetch(`${LASTFM_ENDPOINT}?${searchParams.toString()}`, {
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Last.fm request failed with status ${response.status}`)
    }

    const payload = (await response.json()) as LastfmTopTagsResponse

    if (payload.error) {
      throw new Error(payload.message || `Last.fm request failed with code ${payload.error}`)
    }

    const rawTags = payload.toptags?.tag
    const tagList = Array.isArray(rawTags) ? rawTags : rawTags ? [rawTags] : []

    return tagList
      .map((tag) => ({
        name: typeof tag.name === 'string' ? tag.name.trim() : '',
        count: Number(tag.count) || 0,
      }))
      .filter((tag) => tag.name.length > 0)
      .sort((left, right) => right.count - left.count)
  } finally {
    clearTimeout(timeoutId)
  }
}

async function fetchLastfmTopTags(candidate: SpotifyTrackTagCandidate, apiKey: string): Promise<{ tags: SpotifyTrackTagValue[]; source: 'track' | 'artist' }> {
  const trackTags = await fetchLastfmRaw(
    { method: 'track.getTopTags', artist: candidate.artist, track: candidate.title, autocorrect: '1' },
    apiKey,
  )

  if (trackTags.length > 0) {
    return { tags: trackTags, source: 'track' }
  }

  // track 级别没有标签时，fallback 到 artist 级别（覆盖率接近 100%）
  await new Promise((resolve) => setTimeout(resolve, LASTFM_REQUEST_INTERVAL_MS))

  const artistTags = await fetchLastfmRaw(
    { method: 'artist.getTopTags', artist: candidate.artist, autocorrect: '1' },
    apiKey,
  )

  return { tags: artistTags, source: 'artist' }
}

function dedupeTrackCandidates(tracks: SpotifyTrackTagCandidate[]) {
  const uniqueTracks = new Map<string, SpotifyTrackTagCandidate>()

  for (const track of tracks) {
    const trackId = track.trackId.trim()
    const title = track.title.trim()
    const artist = track.artist.trim()

    if (!trackId || !title || !artist || uniqueTracks.has(trackId)) {
      continue
    }

    uniqueTracks.set(trackId, { trackId, title, artist })
  }

  return Array.from(uniqueTracks.values())
}

export async function readSpotifyTrackTagStore(env: Env): Promise<SpotifyTrackTagStore> {
  return (
    await readR2JsonIfExists<SpotifyTrackTagStore>(env, getSpotifyBucket(env), SPOTIFY_TRACK_TAGS_KEY)
  ) ?? createEmptyTrackTagStore()
}



export function filterSpotifyTrackTagStore(store: SpotifyTrackTagStore, ids: string[]) {
  if (ids.length === 0) {
    return store
  }

  const tracks = Object.fromEntries(
    ids
      .filter((trackId) => Boolean(store.tracks[trackId]))
      .map((trackId) => [trackId, store.tracks[trackId]])
  ) as Record<string, SpotifyTrackTagEntry>

  return {
    ...store,
    tracks,
  }
}
export async function syncSpotifyTrackTags({
  env,
  tracks,
  syncedAt = new Date().toISOString(),
  maxTracks = 35,
}: {
  env: Env
  tracks: SpotifyTrackTagCandidate[]
  syncedAt?: string
  maxTracks?: number
}): Promise<SpotifyTrackTagSyncResult> {
  const apiKey = env.LASTFM_API_KEY

  if (!apiKey) {
    return {
      tagsUpdated: 0,
      warnings: ['Missing LASTFM_API_KEY; skipped Last.fm tag sync.'],
    }
  }

  const uniqueTracks = dedupeTrackCandidates(tracks)

  if (uniqueTracks.length === 0) {
    return { tagsUpdated: 0, warnings: [] }
  }

  const resolvedBucket = getSpotifyBucket(env)
  const tagStore = await readSpotifyTrackTagStore(env)

  const pendingTracks = uniqueTracks
    .filter((track) => !tagStore.tracks[track.trackId])
    .slice(0, maxTracks)

  let tagsUpdated = 0
  const warnings: string[] = []

  for (let index = 0; index < pendingTracks.length; index += 1) {
    const track = pendingTracks[index]

    try {
      const { tags, source } = await fetchLastfmTopTags(track, apiKey)

      tagStore.tracks[track.trackId] = {
        trackId: track.trackId,
        artist: track.artist,
        title: track.title,
        fetchedAt: new Date().toISOString(),
        tagSource: source,
        tags,
      }
      tagsUpdated += 1

      tagStore.lastUpdatedAt = syncedAt
      await writeR2Json(env, resolvedBucket, SPOTIFY_TRACK_TAGS_KEY, tagStore)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Last.fm error'
      const warning = `Last.fm tag sync failed for ${track.artist} - ${track.title}: ${message}`
      warnings.push(warning)
      console.warn(warning)
    }

    if (index < pendingTracks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, LASTFM_REQUEST_INTERVAL_MS))
    }
  }

  return { tagsUpdated, warnings }
}
