import type { Env } from './env'
import {
  getSpotifyNowPlayingCacheControl,
  getSpotifyNowPlayingErrorCacheControl,
} from './now-playing-cache'
import { getSpotifyNowPlayingData } from './spotify'

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