import type { Env } from './env'
import { searchGenius } from './search'
import { scrapeSongPage } from './scraper'
import { buildCacheKey, getFromCache, writeToCache } from './cache'
import { logError, logInfo } from './log'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      ...headers,
    },
  })
}

function isLegacyQueryRequest(url: URL): boolean {
  if (url.pathname !== '/') {
    return false
  }

  return url.searchParams.has('title') || url.searchParams.has('artist') || url.searchParams.has('trackId')
}

function isPublicQueryRequest(url: URL): boolean {
  return url.pathname === '/api/genius' || isLegacyQueryRequest(url)
}

function healthResponse(): Response {
  return json(
    {
      status: 'ok',
      service: 'genius-lyrics-worker',
      queryPath: '/api/genius',
    },
    200,
    { 'Cache-Control': 'no-store' }
  )
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return json({ error: 'Method Not Allowed' }, 405, {
        Allow: 'GET, HEAD, OPTIONS',
        'Cache-Control': 'no-store',
      })
    }

    if (url.pathname === '/' && !isLegacyQueryRequest(url)) {
      return healthResponse()
    }

    if (url.pathname === '/health') {
      return healthResponse()
    }

    if (!isPublicQueryRequest(url)) {
      return json({ error: 'Not Found' }, 404, { 'Cache-Control': 'no-store' })
    }

    const { searchParams } = url
    const trackId = searchParams.get('trackId') ?? ''
    const title = (searchParams.get('title') ?? '').trim()
    const artist = (searchParams.get('artist') ?? '').trim()

    if (!title || !artist) {
      return json({ error: 'title and artist are required' }, 400, { 'Cache-Control': 'no-store' })
    }

    // KV 缓存命中
    const cacheKey = buildCacheKey(trackId, artist, title)
    const cached = await getFromCache(env.GENIUS_CACHE, cacheKey)
    if (cached) {
      logInfo('genius cache hit', { trackId, title, artist })
      return json(
        { cached: true, data: cached },
        200,
        { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' }
      )
    }

    // 冷启动：搜索 + 抓取
    try {
      logInfo('genius cache miss', { trackId, title, artist })
      logInfo('genius search started', { trackId, title, artist })
      const searchResult = await searchGenius(title, artist, env.GENIUS_API_TOKEN)
      if (!searchResult) {
        logInfo('genius search returned null', { trackId, title, artist })
        return json({ cached: false, data: null }, 200, { 'Cache-Control': 'no-store' })
      }
      logInfo('genius search matched', { trackId, title, artist, url: searchResult.url })

      const songData = await scrapeSongPage(searchResult.url, searchResult.id, env.GENIUS_API_TOKEN)
      if (!songData) {
        logInfo('genius scrape returned null', { trackId, title, artist, url: searchResult.url })
        return json({ cached: false, data: null }, 200, { 'Cache-Control': 'no-store' })
      }
      logInfo('genius scrape completed', {
        trackId,
        title,
        artist,
        url: searchResult.url,
        annotations: songData.annotations.length,
      })

      // 异步写入 KV，不阻塞响应
      ctx.waitUntil(writeToCache(env.GENIUS_CACHE, cacheKey, songData))

      return json(
        { cached: false, data: songData },
        200,
        { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' }
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      logError('genius request failed', err, { trackId, title, artist })
      return json({ error: message }, 500, { 'Cache-Control': 'no-store' })
    }
  },
}
export default worker
