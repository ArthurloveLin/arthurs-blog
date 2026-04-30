import type { Env } from './env'
import { searchGenius } from './search'
import { scrapeSongPage } from './scraper'
import { buildCacheKey, getFromCache, writeToCache } from './cache'

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
      if (provided !== env.GENIUS_WORKER_SECRET) {
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
      return json({ cached: true, data: cached })
    }

    // 冷启动：搜索 + 抓取
    try {
      console.log(`[genius] search: "${title}" - "${artist}"`)
      const searchResult = await searchGenius(title, artist, env.GENIUS_API_TOKEN)
      if (!searchResult) {
        console.log('[genius] search returned null')
        return json({ cached: false, data: null })
      }
      console.log(`[genius] found: ${searchResult.url}`)

      const songData = await scrapeSongPage(searchResult.url, searchResult.id, env.GENIUS_API_TOKEN)
      if (!songData) {
        console.log('[genius] scrape returned null')
        return json({ cached: false, data: null })
      }
      console.log(`[genius] scraped ${songData.annotations.length} annotations`)

      // 异步写入 KV，不阻塞响应
      ctx.waitUntil(writeToCache(env.GENIUS_CACHE, cacheKey, songData))

      return json({ cached: false, data: songData })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[genius] error: ${message}`)
      return json({ error: message }, 500)
    }
  },
}
export default worker
