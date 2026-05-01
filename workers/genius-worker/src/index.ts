import type { Env } from './env'
import { searchGenius } from './search'
import { scrapeSongPage } from './scraper'
import { buildCacheKey, getFromCache, writeToCache } from './cache'
import { logError, logInfo } from './log'

const textEncoder = new TextEncoder()

async function secretsMatch(provided: string | null, expected: string): Promise<boolean> {
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', textEncoder.encode(provided ?? '')),
    crypto.subtle.digest('SHA-256', textEncoder.encode(expected)),
  ])

  return crypto.subtle.timingSafeEqual(providedHash, expectedHash)
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS })
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    // Secret 校验
    if (env.GENIUS_WORKER_SECRET) {
      const provided =
        request.headers.get('x-genius-secret') ??
        new URL(request.url).searchParams.get('secret')
      if (!(await secretsMatch(provided, env.GENIUS_WORKER_SECRET))) {
        logInfo('genius request forbidden', { path: new URL(request.url).pathname })
        return json({ error: 'Forbidden' }, 403)
      }
    }

    const { searchParams } = new URL(request.url)
    const trackId = searchParams.get('trackId') ?? ''
    const title = (searchParams.get('title') ?? '').trim()
    const artist = (searchParams.get('artist') ?? '').trim()

    if (!title || !artist) {
      return json({ error: 'title and artist are required' }, 400)
    }

    // KV 缓存命中
    const cacheKey = buildCacheKey(trackId, artist, title)
    const cached = await getFromCache(env.GENIUS_CACHE, cacheKey)
    if (cached) {
      logInfo('genius cache hit', { trackId, title, artist })
      return json({ cached: true, data: cached })
    }

    // 冷启动：搜索 + 抓取
    try {
      logInfo('genius cache miss', { trackId, title, artist })
      logInfo('genius search started', { trackId, title, artist })
      const searchResult = await searchGenius(title, artist, env.GENIUS_API_TOKEN)
      if (!searchResult) {
        logInfo('genius search returned null', { trackId, title, artist })
        return json({ cached: false, data: null })
      }
      logInfo('genius search matched', { trackId, title, artist, url: searchResult.url })

      const songData = await scrapeSongPage(searchResult.url, searchResult.id, env.GENIUS_API_TOKEN)
      if (!songData) {
        logInfo('genius scrape returned null', { trackId, title, artist, url: searchResult.url })
        return json({ cached: false, data: null })
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

      return json({ cached: false, data: songData })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      logError('genius request failed', err, { trackId, title, artist })
      return json({ error: message }, 500)
    }
  },
}
export default worker
