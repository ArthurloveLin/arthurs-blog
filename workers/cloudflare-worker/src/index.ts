import type { Env } from './env'
import {
  generateAndSaveMusicReport,
  generateAndSaveStreamData,
  getSpotifyNowPlayingData,
  listRecentlyPlayedDays,
  readRecentlyPlayedDayShard,
  readSpotifyCollection,
  readSpotifyPlaylistShard,
  readSpotifyTagCandidatesFromArchive,
  readStoredMusicReport,
  readStoredSpotifyStreamData,
  SPOTIFY_SAVED_TRACKS_KEY,
  syncSpotifyDashboardToArchive,
} from './spotify'
import { filterSpotifyTrackTagStore, readSpotifyTrackTagStore, syncSpotifyTrackTags } from './spotify-tags'
import type { SpotifySavedTrack } from './spotify-types'

const textEncoder = new TextEncoder()
const DAY_QUERY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_LIBRARY_LIMIT = 72
const MAX_LIBRARY_LIMIT = 120

function logInfo(message: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level: 'info', message, ...fields }))
}

function logError(message: string, error: unknown, fields: Record<string, unknown> = {}) {
  console.error(
    JSON.stringify({
      level: 'error',
      message,
      error: error instanceof Error ? error.message : String(error),
      ...fields,
    })
  )
}

async function secretsMatch(provided: string | null, expected: string): Promise<boolean> {
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', textEncoder.encode(provided ?? '')),
    crypto.subtle.digest('SHA-256', textEncoder.encode(expected)),
  ])

  return crypto.subtle.timingSafeEqual(providedHash, expectedHash)
}

function createCorsHeaders() {
  return new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-spotify-sync-secret',
    'Access-Control-Max-Age': '86400',
  })
}

function createJsonHeaders(extraHeaders: HeadersInit = {}) {
  const headers = createCorsHeaders()
  headers.set('Content-Type', 'application/json; charset=utf-8')

  const extras = new Headers(extraHeaders)
  extras.forEach((value, key) => {
    headers.set(key, value)
  })

  return headers
}

function json(body: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: createJsonHeaders(extraHeaders),
  })
}

function parseSearchParam(value: string | null, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback
  }

  return Math.floor(parsed)
}

function getTodayKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function respondFromEdgeCache(request: Request, ctx: ExecutionContext, build: () => Promise<Response>) {
  const cacheKey = new Request(request.url, { method: 'GET' })
  const cached = await caches.default.match(cacheKey)
  if (cached) {
    return cached
  }

  const response = await build()
  if (response.ok) {
    ctx.waitUntil(caches.default.put(cacheKey, response.clone()))
  }

  return response
}

async function handlePublicRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response | null> {
  if (request.method !== 'GET') {
    return null
  }

  const url = new URL(request.url)

  if (url.pathname === '/api/now-playing') {
    return respondFromEdgeCache(request, ctx, async () => {
      try {
        const data = await getSpotifyNowPlayingData(env)
        return json(data ?? { isPlaying: false }, 200, {
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=30',
        })
      } catch (error) {
        logError('spotify now-playing failed', error, { path: url.pathname })
        return json({ isPlaying: false }, 200, {
          'Cache-Control': 'public, max-age=10',
        })
      }
    })
  }

  if (url.pathname === '/api/spotify/history/days') {
    return respondFromEdgeCache(request, ctx, async () => {
      try {
        const days = await listRecentlyPlayedDays(env)
        return json({ days }, 200, {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        })
      } catch (error) {
        logError('spotify history days failed', error, { path: url.pathname })
        const message = error instanceof Error ? error.message : 'Failed to list Spotify history days'
        return json({ error: message }, 500, { 'Cache-Control': 'no-store' })
      }
    })
  }

  if (url.pathname === '/api/spotify/history/stream') {
    return respondFromEdgeCache(request, ctx, async () => {
      try {
        let data = await readStoredSpotifyStreamData(env)
        if (!data) {
          await generateAndSaveStreamData(env)
          data = await readStoredSpotifyStreamData(env)
        }

        if (!data) {
          return json({ error: 'Spotify stream data is unavailable' }, 503, { 'Cache-Control': 'no-store' })
        }

        return json(data, 200, {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
        })
      } catch (error) {
        logError('spotify stream data failed', error, { path: url.pathname })
        const message = error instanceof Error ? error.message : 'Failed to fetch stream data'
        return json({ error: message }, 500, { 'Cache-Control': 'no-store' })
      }
    })
  }

  if (url.pathname === '/api/spotify/history') {
    const date = url.searchParams.get('date')
    if (!date || !DAY_QUERY_PATTERN.test(date)) {
      return json({ error: 'Invalid date format' }, 400, { 'Cache-Control': 'no-store' })
    }

    return respondFromEdgeCache(request, ctx, async () => {
      try {
        const tracks = await readRecentlyPlayedDayShard(env, date)
        return json(tracks, 200, {
          'Cache-Control': date === getTodayKey()
            ? 'public, max-age=60, stale-while-revalidate=300'
            : 'public, max-age=3600, stale-while-revalidate=86400',
        })
      } catch (error) {
        logError('spotify history shard failed', error, { date, path: url.pathname })
        const message = error instanceof Error ? error.message : 'Failed to read Spotify history'
        return json({ error: message }, 500, { 'Cache-Control': 'no-store' })
      }
    })
  }

  if (url.pathname === '/api/spotify/library/tracks') {
    return respondFromEdgeCache(request, ctx, async () => {
      try {
        const collection = await readSpotifyCollection<SpotifySavedTrack>(env, SPOTIFY_SAVED_TRACKS_KEY)
        const offset = parseSearchParam(url.searchParams.get('offset'), 0)
        const limit = Math.min(parseSearchParam(url.searchParams.get('limit'), DEFAULT_LIBRARY_LIMIT), MAX_LIBRARY_LIMIT)
        const items = collection.items.slice(offset, offset + limit)

        return json({ items, total: collection.total }, 200, {
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        })
      } catch (error) {
        logError('spotify saved tracks failed', error, { path: url.pathname })
        return json({ error: 'Failed to load tracks' }, 500, { 'Cache-Control': 'no-store' })
      }
    })
  }

  const playlistMatch = url.pathname.match(/^\/api\/spotify\/playlists\/([^/]+)$/)
  if (playlistMatch) {
    const playlistId = decodeURIComponent(playlistMatch[1])

    return respondFromEdgeCache(request, ctx, async () => {
      try {
        const tracks = await readSpotifyPlaylistShard(env, playlistId)
        return json(tracks, 200, {
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        })
      } catch (error) {
        logError('spotify playlist shard failed', error, { playlistId, path: url.pathname })
        return json({ error: 'Failed to load tracks' }, 500, { 'Cache-Control': 'no-store' })
      }
    })
  }

  if (url.pathname === '/api/spotify/tags') {
    return respondFromEdgeCache(request, ctx, async () => {
      const ids = Array.from(new Set(
        (url.searchParams.get('ids') ?? '')
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      ))

      try {
        const store = await readSpotifyTrackTagStore(env)
        return json(filterSpotifyTrackTagStore(store, ids), 200, {
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        })
      } catch (error) {
        logError('spotify tag store failed', error, { ids: ids.length, path: url.pathname })
        return json({ error: 'Failed to load Spotify tag data' }, 500, { 'Cache-Control': 'no-store' })
      }
    })
  }

  if (url.pathname === '/api/spotify/report') {
    return respondFromEdgeCache(request, ctx, async () => {
      try {
        let report = await readStoredMusicReport(env)
        if (!report) {
          report = await generateAndSaveMusicReport(env)
        }

        if (!report) {
          return json({ error: 'Spotify report is unavailable' }, 503, { 'Cache-Control': 'no-store' })
        }

        return json(report, 200, {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        })
      } catch (error) {
        logError('spotify report failed', error, { path: url.pathname })
        return json({ error: 'Failed to build music report' }, 500, { 'Cache-Control': 'no-store' })
      }
    })
  }

  return null
}

async function runSyncWorkflow(
  env: Env,
  mode: 'quick' | 'full',
  trigger: 'scheduled' | 'manual',
  fields: Record<string, unknown>
) {
  logInfo('spotify sync started', { trigger, mode, ...fields })

  const result = await syncSpotifyDashboardToArchive(env, { mode })
  logInfo('spotify sync completed', { trigger, mode, summary: result.summary, ...fields })

  let tagsUpdated = 0
  if (mode === 'full') {
    const { candidates } = await readSpotifyTagCandidatesFromArchive(env)
    if (candidates.length > 0) {
      const tagResult = await syncSpotifyTrackTags({
        env,
        tracks: candidates,
        maxTracks: 35,
      })
      tagsUpdated = tagResult.tagsUpdated
      logInfo('spotify tag sync completed', {
        trigger,
        mode,
        tagsUpdated,
        ...fields,
      })
    }
  }

  logInfo('spotify stream generation started', { trigger, mode, ...fields })
  await generateAndSaveStreamData(env)

  logInfo('spotify report generation started', { trigger, mode, ...fields })
  await generateAndSaveMusicReport(env)

  return { result, tagsUpdated }
}

const worker = {
  async scheduled(event: ScheduledEvent, env: Env) {
    const isFullSync = event.cron === '5 16 * * *'
    const mode = isFullSync ? 'full' : 'quick'

    try {
      await runSyncWorkflow(env, mode, 'scheduled', { cron: event.cron })

      if (env.NEXTJS_SITE_URL && env.SPOTIFY_SYNC_SECRET) {
        const revalidateUrl = `${env.NEXTJS_SITE_URL}/api/revalidate?secret=${env.SPOTIFY_SYNC_SECRET}`
        try {
          const res = await fetch(revalidateUrl)
          logInfo('spotify revalidate completed', {
            trigger: 'scheduled',
            mode,
            status: res.status,
          })
        } catch (error) {
          logError('spotify revalidate failed', error, { trigger: 'scheduled', mode })
        }
      }
    } catch (error) {
      logError('spotify scheduled sync failed', error, { mode, cron: event.cron })
    }
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: createCorsHeaders(),
      })
    }

    const publicResponse = await handlePublicRequest(request, env, ctx)
    if (publicResponse) {
      return publicResponse
    }

    const url = new URL(request.url)
    const mode = url.searchParams.get('mode') === 'full' ? 'full' : 'quick'
    const syncSecret = request.headers.get('x-spotify-sync-secret') || url.searchParams.get('secret')
    const isSyncPath = url.pathname === '/' || url.pathname === '/sync'

    if (!isSyncPath) {
      return json({ error: 'Not Found' }, 404, { 'Cache-Control': 'no-store' })
    }

    if (env.SPOTIFY_SYNC_SECRET && !(await secretsMatch(syncSecret, env.SPOTIFY_SYNC_SECRET))) {
      logInfo('spotify manual sync forbidden', { mode, path: url.pathname })
      return json({ error: 'Forbidden' }, 403, { 'Cache-Control': 'no-store' })
    }

    try {
      const { result, tagsUpdated } = await runSyncWorkflow(env, mode, 'manual', { path: url.pathname })

      if (env.NEXTJS_SITE_URL && env.SPOTIFY_SYNC_SECRET) {
        const revalidateUrl = `${env.NEXTJS_SITE_URL}/api/revalidate?secret=${env.SPOTIFY_SYNC_SECRET}`
        ctx.waitUntil(
          fetch(revalidateUrl)
            .then((response) => {
              logInfo('spotify revalidate completed', {
                trigger: 'manual',
                mode,
                status: response.status,
              })
            })
            .catch((error) => {
              logError('spotify revalidate failed', error, { trigger: 'manual', mode })
            })
        )
      }

      return json(
        {
          message: 'Sync successful',
          result,
          tagsUpdated,
        },
        200,
        { 'Cache-Control': 'no-store' }
      )
    } catch (error) {
      logError('spotify manual sync failed', error, { mode, path: url.pathname })
      const message = error instanceof Error ? error.message : 'Unknown error'
      return json({ error: message }, 500, { 'Cache-Control': 'no-store' })
    }
  },
}

export default worker
