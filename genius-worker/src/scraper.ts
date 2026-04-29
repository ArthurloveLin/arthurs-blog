import type { GeniusSongData, GeniusAnnotation } from './types'

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractData(preloadedState: string): any {
  // POC-proven approach: take from first { to last }, then unescape Genius's
  // JS-string escaping (the JSON is serialized as JSON.parse('...') in the page).
  const startPos = preloadedState.indexOf('{')
  const endPos = preloadedState.lastIndexOf('}') + 1
  if (startPos === -1 || endPos === 0) return null

  const jsonStr = preloadedState.substring(startPos, endPos)

  // Unescape in a single pass: \' → '  \" → "  \\ → \
  const unescaped = jsonStr.replace(/\\(.)/g, (_match, char: string) => {
    if (char === "'") return "'"
    if (char === '"') return '"'
    if (char === '\\') return '\\'
    return char
  })

  try {
    return JSON.parse(unescaped)
  } catch (e: unknown) {
    // Genius sometimes appends trailing JS after the JSON — truncate at the
    // parse error position and retry.
    const pos = (e instanceof Error ? e.message : '').match(/at position (\d+)/)
    if (pos) {
      return JSON.parse(unescaped.substring(0, parseInt(pos[1])))
    }
    throw e
  }
}

export async function scrapeSongPage(
  url: string,
  geniusIdHint?: number
): Promise<GeniusSongData | null> {
  const res = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA },
  })

  console.log(`[scraper] fetch ${url} → ${res.status}`)
  if (!res.ok) {
    console.log(`[scraper] non-ok response: ${res.status}`)
    return null
  }

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

  console.log(`[scraper] preloadedState length: ${preloadedState.length}`)
  if (!preloadedState) {
    console.log('[scraper] __PRELOADED_STATE__ not found in any script tag')
    return null
  }

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
  } catch (e: unknown) {
    console.log(`[scraper] extractData threw: ${e instanceof Error ? e.message : e}`)
    return null
  }

  console.log(`[scraper] entities keys: ${Object.keys(data?.entities ?? {}).join(', ')}`)
  console.log(`[scraper] songPage.song: ${data?.songPage?.song}, hint: ${geniusIdHint}`)

  if (!data?.entities) {
    console.log('[scraper] no entities in parsed data')
    return null
  }

  const songId = data.songPage?.song ?? geniusIdHint
  if (!songId) {
    console.log('[scraper] no songId')
    return null
  }

  const songData = data.entities?.song?.[String(songId)]
  console.log(`[scraper] song[${songId}] title: ${songData?.title ?? 'NOT FOUND'}`)
  console.log(`[scraper] available song ids: ${Object.keys(data.entities?.song ?? {}).join(', ')}`)
  if (!songData?.title) {
    return null
  }

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
