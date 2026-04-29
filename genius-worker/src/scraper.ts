import type { GeniusSongData, GeniusAnnotation } from './types'

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function unescapeGeniusJson(raw: string): string {
  // Genius wraps JSON in JSON.parse('...') with JS-escaped single-quote string
  // Unescape in order: \\ first, then \' and \"
  return raw.replace(/\\(.)/g, (_match, char: string) => {
    if (char === '\\') return '\\'
    if (char === "'") return "'"
    if (char === '"') return '"'
    return char
  })
}

function safeParse(str: string): unknown {
  try {
    return JSON.parse(str)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    const pos = msg.match(/at position (\d+)/)
    if (pos) {
      return JSON.parse(str.substring(0, parseInt(pos[1])))
    }
    throw e
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractData(preloadedState: string): any {
  // Pattern 1: window.__PRELOADED_STATE__ = JSON.parse('...')
  const jsonParseMatch = preloadedState.match(/JSON\.parse\('([\s\S]+?)'\)\s*(?:;|window\.)/)
  if (jsonParseMatch) {
    const unescaped = unescapeGeniusJson(jsonParseMatch[1])
    return safeParse(unescaped)
  }

  // Pattern 2: window.__PRELOADED_STATE__ = {...}
  const startPos = preloadedState.indexOf('{')
  if (startPos !== -1) {
    return safeParse(preloadedState.substring(startPos))
  }

  return null
}

export async function scrapeSongPage(
  url: string,
  geniusIdHint?: number
): Promise<GeniusSongData | null> {
  const res = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA },
  })

  if (!res.ok) return null

  let preloadedState = ''
  let currentScript = ''

  const rewriter = new HTMLRewriter().on('script', {
    text(t) {
      currentScript += t.text
      if (t.lastInTextNode) {
        if (currentScript.includes('__PRELOADED_STATE__')) {
          preloadedState = currentScript
        }
        currentScript = ''
      }
    },
  })

  await rewriter.transform(res).arrayBuffer()

  if (!preloadedState) return null

  let data: {
    songPage?: { song?: number }
    entities?: {
      song?: Record<string, {
        title?: string
        primary_artist?: { name?: string }
        album?: { name?: string }
        release_date_for_display?: string
        stats?: { pageviews?: number }
      }>
      annotation?: Record<string, {
        id: number
        body?: { plain?: string }
        share_url?: string
        votes_total?: number
      }>
    }
  }

  try {
    data = extractData(preloadedState) as typeof data
  } catch {
    return null
  }

  if (!data?.entities) return null

  const songId = data.songPage?.song ?? geniusIdHint
  if (!songId) return null

  const songData = data.entities?.song?.[String(songId)]
  if (!songData?.title) return null

  const rawAnnotations = Object.values(data.entities?.annotation ?? {})
  const annotations: GeniusAnnotation[] = rawAnnotations
    .filter((a) => (a.body?.plain?.length ?? 0) > 10)
    .sort((a, b) => (b.votes_total ?? 0) - (a.votes_total ?? 0))
    .slice(0, 5)
    .map((a) => ({
      id: a.id,
      body: (a.body?.plain ?? '').substring(0, 300),
      url: a.share_url ?? url,
      votes: a.votes_total ?? 0,
    }))

  return {
    geniusId: Number(songId),
    title: songData.title,
    artist: songData.primary_artist?.name ?? '',
    album: songData.album?.name,
    releaseDate: songData.release_date_for_display,
    geniusUrl: url,
    pageViews: songData.stats?.pageviews,
    annotations,
    cachedAt: new Date().toISOString(),
  }
}
