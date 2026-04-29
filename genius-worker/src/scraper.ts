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

  // Genius uses camelCase in its normalised state.
  //   songs[id].primaryArtist → nested object with .name
  //   songs[id].album         → album ID → albums[id].name
  let data: {
    songPage?: { song?: number }
    entities?: {
      songs?: Record<string, {
        title?: string
        primaryArtist?: { name?: string }
        album?: number
        releaseDateForDisplay?: string
        release_date_for_display?: string
        stats?: { pageviews?: number }
      }>
      albums?: Record<string, { name?: string }>
      annotations?: Record<string, {
        id: number
        body?: { plain?: string; html?: string }
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

  if (!data?.entities) {
    console.log('[scraper] no entities')
    return null
  }

  const songId = data.songPage?.song ?? geniusIdHint
  if (!songId) {
    console.log('[scraper] no songId')
    return null
  }

  const songData = data.entities.songs?.[String(songId)]
  if (!songData?.title) {
    console.log(`[scraper] songs[${songId}] not found`)
    return null
  }

  // primaryArtist is a nested object; album is a numeric ID → albums entity
  const artistName = songData.primaryArtist?.name ?? ''

  const albumId = songData.album
  const albumName = albumId
    ? (data.entities.albums?.[String(albumId)]?.name)
    : undefined

  // Strip basic HTML tags for annotations that only have html body
  function plainFromHtml(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  const rawAnnotations = Object.values(data.entities.annotations ?? {})
  console.log(`[scraper] annotations count: ${rawAnnotations.length}`)

  const annotations: GeniusAnnotation[] = rawAnnotations
    .map((a) => {
      // body may have plain, html, or markdown — use whichever has content
      const text = a.body?.plain
        ?? plainFromHtml(a.body?.html ?? '')
        ?? ''
      return { a, text }
    })
    .filter(({ text }) => text.length > 10)
    .sort((x, y) => (y.a.votes_total ?? 0) - (x.a.votes_total ?? 0))
    .slice(0, 5)
    .map(({ a, text }) => ({
      id: a.id,
      body: text.substring(0, 300),
      url: a.share_url ?? url,
      votes: a.votes_total ?? 0,
    }))

  return {
    geniusId: Number(songId),
    title: songData.title,
    artist: artistName,
    album: albumName,
    releaseDate: songData.releaseDateForDisplay ?? songData.release_date_for_display,
    geniusUrl: url,
    pageViews: songData.stats?.pageviews,
    annotations,
    cachedAt: new Date().toISOString(),
  }
}
