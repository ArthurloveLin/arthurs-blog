import type { Env } from './env'
import {
  getSpotifyNowPlayingCacheControl,
  getSpotifyNowPlayingErrorCacheControl,
} from './now-playing-cache'
import { getSpotifyAccessToken, getSpotifyNowPlayingData } from './spotify'

function logError(message: string, error: unknown, fields: Record<string, unknown> = {}) {
  console.error(
    JSON.stringify({
      level: 'error',
      message,
      error: error instanceof Error ? error.message : String(error),
      ...fields,
    }),
  )
}

function createCorsHeaders() {
  return new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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

async function respondFromEdgeCache(request: Request, ctx: ExecutionContext, build: () => Promise<Response>) {
  const cacheControl = request.headers.get('Cache-Control') || ''
  const pragma = request.headers.get('Pragma') || ''

  const url = new URL(request.url)
  const hasRefreshParam = url.searchParams.has('refresh')

  const isNoCache = cacheControl.includes('no-cache') ||
                    cacheControl.includes('no-store') ||
                    cacheControl.includes('max-age=0') ||
                    pragma.includes('no-cache') ||
                    hasRefreshParam

  // Normalize cache key by removing cache-busting params
  url.searchParams.delete('refresh')
  url.searchParams.delete('t')
  const cacheKey = new Request(url.toString(), { method: 'GET' })

  if (!isNoCache) {
    const cached = await caches.default.match(cacheKey)
    if (cached) {
      return cached
    }
  }

  const response = await build()

  if (response.ok) {
    ctx.waitUntil(caches.default.put(cacheKey, response.clone()))
  }

  return response
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: createCorsHeaders() })
    }

    if (request.method !== 'GET') {
      return json({ error: 'Method Not Allowed' }, 405, { 'Cache-Control': 'no-store' })
    }

    const url = new URL(request.url)

    if (url.pathname === '/health') {
      const timestamp = new Date().toISOString()
      const [tokenResult, r2Result] = await Promise.allSettled([
        (async () => {
          const t0 = Date.now()
          await Promise.race([
            getSpotifyAccessToken(env),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
          ])
          return Date.now() - t0
        })(),
        (async () => {
          const t0 = Date.now()
          await Promise.race([
            env.SPOTIFY_BUCKET.head('spotify/latest/dashboard.json'),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
          ])
          return Date.now() - t0
        })(),
      ])
      const spotifyTokenStatus = tokenResult.status === 'fulfilled' ? 'ok' : 'down'
      const r2Status = r2Result.status === 'fulfilled' ? 'ok' : 'down'
      const overallStatus = spotifyTokenStatus === 'ok' && r2Status === 'ok' ? 'ok' : 'degraded'
      return json(
        {
          status: overallStatus,
          service: 'spotify-now-playing',
          timestamp,
          components: {
            spotify_token: { status: spotifyTokenStatus, latency_ms: tokenResult.status === 'fulfilled' ? tokenResult.value : 3000 },
            r2_read: { status: r2Status, latency_ms: r2Result.status === 'fulfilled' ? r2Result.value : 3000 },
          },
        },
        overallStatus === 'ok' ? 200 : 503,
        { 'Cache-Control': 'no-store' },
      )
    }

    if (url.pathname !== '/api/now-playing' && url.pathname !== '/') {
      return json({ error: 'Not Found' }, 404, { 'Cache-Control': 'no-store' })
    }

    return respondFromEdgeCache(request, ctx, async () => {
      try {
        const data = await getSpotifyNowPlayingData(env)

        return json(data ?? { isPlaying: false }, 200, {
          'Cache-Control': getSpotifyNowPlayingCacheControl(data),
        })
      } catch (error) {
        logError('spotify now-playing failed', error, { path: url.pathname })

        return json({ isPlaying: false }, 200, {
          'Cache-Control': getSpotifyNowPlayingErrorCacheControl(),
        })
      }
    })
  },
}

export default worker