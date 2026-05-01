import type { GeniusSongData, GeniusAnnotation } from './types'
import { fetchWithRetry } from './http'
import { logError, logInfo, logWarn } from './log'

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
      try {
        return JSON.parse(unescaped.substring(0, parseInt(pos[1])))
      } catch {
        return null
      }
    }
    return null
  }
}

async function fetchInternalLyrics(songId: number): Promise<string | null> {
  const url = `https://genius.com/api/songs/${songId}/lyrics?text_format=plain`
  try {
    const res = await fetchWithRetry(url, {
      headers: { 'User-Agent': BROWSER_UA },
    })
    if (!res.ok) {
      logWarn('genius internal lyrics upstream non-ok', { songId, status: res.status })
      return null
    }
    const data = await res.json() as { response?: { lyrics?: { plain?: string } } }
    return data?.response?.lyrics?.plain || null
  } catch (error) {
    logError('genius internal lyrics request failed', error, { songId })
    return null
  }
}

function cleanLyrics(text: string): string {
  if (!text) return ''

  let cleaned = text

  // 1. 解码常见的 HTML 实体
  const entities: Record<string, string> = {
    '&#x27;': "'",
    '&quot;': '"',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&#039;': "'",
    '&apos;': "'",
    ' ': ' ', // Medium Mathematical Space
    ' ': ' ', // Four-Per-Em Space
    ' ': ' ', // Three-Per-Em Space
    ' ': ' ', // Non-breaking space
  }
  
  for (const [entity, replacement] of Object.entries(entities)) {
    cleaned = cleaned.split(entity).join(replacement)
  }

  // 2. 剔除开头的冗余元数据 (Contributors, Translations, Read More 等)
  const readMoreIndex = cleaned.lastIndexOf('Read More')
  if (readMoreIndex !== -1) {
    cleaned = cleaned.substring(readMoreIndex + 9).trim()
  }

  // 移除 "Contributors" 和 "Translations" 列表噪音
  // 增加 Cyrics, Lyries 等可能出现的乱码变体
  cleaned = cleaned.replace(/^\d+\s*Contributors.*?\s(Lyrics|Cyrics|Lyries)\s+/is, '')
  cleaned = cleaned.replace(/^\d+\s*Contributors.*?Translations.*?\s/is, '')
  
  // 3. 兜底方案：如果开头还是有一堆噪音（语言名列表、歌曲简介等）
  // 且后面有 [ 标签，检测前缀是否包含元数据特征
  const firstBracket = cleaned.indexOf('[')
  if (firstBracket > 0 && firstBracket < 2000) {
    const prefix = cleaned.substring(0, firstBracket)
    
    // 元数据特征关键词
    const metadataMarkers = [
      'Contributors', 
      'Lyrics', 'Cyrics', 'Lyries',
      'Português', 'Türkge', 'Türkçe', 'Frangais', 'Français', 'Español', 'Italiano', 'Deutsch',
      'single from', 'album', 'released on'
    ]
    
    const isMetadata = metadataMarkers.some(marker => 
      prefix.toLowerCase().includes(marker.toLowerCase())
    ) || (prefix.length > 40 && prefix.split(' ').length < 5) // 或者是很长但空格很少的粘连文本

    if (isMetadata) {
      cleaned = cleaned.substring(firstBracket)
    }
  }

  // 4. 确保 [Verse] 等标签前后有换行，防止粘连
  cleaned = cleaned.replace(/(\[.*?\])/g, '\n$1\n')
  
  // 5. 清理多余的连续换行
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n')

  return cleaned.trim()
}

async function fetchReferents(songId: number, apiToken: string): Promise<GeniusAnnotation[]> {
  const url = `https://api.genius.com/referents?song_id=${songId}&text_format=plain&per_page=15`
  try {
    const res = await fetchWithRetry(url, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'User-Agent': BROWSER_UA,
      },
    })
    if (!res.ok) {
      logWarn('genius referents upstream non-ok', { songId, status: res.status })
      return []
    }
    const data = await res.json() as {
      response?: {
        referents?: Array<{
          fragment?: string
          annotations?: Array<{
            id: number
            body?: { plain?: string }
            share_url?: string
            votes_total?: number
          }>
        }>
      }
    }
    const referents = data?.response?.referents || []

    const annotations: GeniusAnnotation[] = []
    referents.forEach((ref) => {
      ref.annotations?.forEach((ann) => {
        const text = ann.body?.plain || ''
        if (text.length > 20) {
          annotations.push({
            id: ann.id,
            body: text.substring(0, 2000),
            fragment: ref.fragment || '',
            url: ann.share_url || `https://genius.com/annotations/${ann.id}/standalone_embed`,
            votes: ann.votes_total || 0,
          })
        }
      })
    })
    return annotations
  } catch (error) {
    logError('genius referents request failed', error, { songId })
    return []
  }
}

export async function scrapeSongPage(
  url: string,
  geniusIdHint: number,
  apiToken?: string
): Promise<GeniusSongData | null> {
  let res: Response

  try {
    res = await fetchWithRetry(url, {
      headers: { 'User-Agent': BROWSER_UA },
    })
  } catch (error) {
    logError('genius scrape page request failed', error, { url, geniusIdHint })
    throw error
  }

  logInfo('genius scrape page fetched', { url, status: res.status, geniusIdHint })
  if (!res.ok) {
    logWarn('genius scrape page upstream non-ok', { url, status: res.status, geniusIdHint })
    return null
  }

  let preloadedState = ''
  let currentScript = ''

  const lyricsParts: string[] = []

  const rewriter = new HTMLRewriter()
    .on('script', {
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
    .on('div[data-lyrics-container="true"]', {
      element() {
        lyricsParts.push('\n')
      },
      text(t) {
        lyricsParts.push(t.text)
      },
    })
    .on('div[data-lyrics-container="true"] br', {
      element() {
        lyricsParts.push('\n')
      }
    })

  await rewriter.transform(res).arrayBuffer()

  logInfo('genius scrape preloaded state parsed', { url, geniusIdHint, preloadedStateLength: preloadedState.length })
  if (!preloadedState) {
    logWarn('genius scrape preloaded state missing', { url, geniusIdHint })
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
        lyricsData?: { plain?: string }
        body?: { plain?: string }
      }>
      albums?: Record<string, { name?: string }>
      annotations?: Record<string, {
        id: number
        body?: { plain?: string; html?: string }
        share_url?: string
        votes_total?: number
      }>
      referents?: Record<string, {
        id: number
        annotations?: number[]
      }>
    }
  }

  try {
    data = extractData(preloadedState) as typeof data
  } catch (error: unknown) {
    logError('genius scrape extract data failed', error, { url, geniusIdHint })
    return null
  }

  if (!data) {
    logWarn('genius scrape data empty', { url, geniusIdHint })
    return null
  }

  if (!data?.entities) {
    logWarn('genius scrape entities missing', { url, geniusIdHint })
    return null
  }

  const songId = data.songPage?.song ?? geniusIdHint
  if (!songId) {
    logWarn('genius scrape song id missing', { url, geniusIdHint })
    return null
  }

  const songData = data.entities.songs?.[String(songId)]
  if (!songData?.title) {
    logWarn('genius scrape song payload missing', { url, geniusIdHint, songId })
    return null
  }

  // primaryArtist is a nested object; album is a numeric ID → albums entity
  const artistName = songData.primaryArtist?.name ?? ''

  const albumId = songData.album
  const albumName = albumId
    ? (data.entities.albums?.[String(albumId)]?.name)
    : undefined

  // Strip basic HTML tags but preserve newlines
  function plainFromHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .trim()
  }

  const entities = data.entities || {}
  const annotationsMap = entities.annotations || {}

  // 1. 收集实体中的所有注解（通常是歌曲描述）
  const allAnnotationsMap = new Map<number, GeniusAnnotation>()
  Object.values(annotationsMap).forEach((a) => {
    if (a.id) {
      const text = a.body?.plain ?? plainFromHtml(a.body?.html ?? '') ?? ''
      if (text.length > 20) {
        allAnnotationsMap.set(a.id, {
          id: a.id,
          body: text.substring(0, 2000),
          fragment: '',
          url: a.share_url ?? url,
          votes: a.votes_total ?? 0,
        })
      }
    }
  })

  // 2. 如果有 API Token，抓取更完整的歌词注解
  if (apiToken) {
    logInfo('genius referents fetch started', { songId, url })
    const apiAnnotations = await fetchReferents(Number(songId), apiToken)
    apiAnnotations.forEach(ann => {
      // 避免重复，且 API 拿到的通常更完整
      allAnnotationsMap.set(ann.id, ann)
    })
  }

  const annotations = Array.from(allAnnotationsMap.values())
    .sort((x, y) => (y.votes ?? 0) - (x.votes ?? 0))
    .slice(0, 15)

  logInfo('genius annotations prepared', { songId, url, annotations: annotations.length })

  // 尝试从状态中获取歌词
  let lyricsRaw = songData.lyricsData?.plain || songData.body?.plain || null

  // 如果状态中没有，尝试使用 HTMLRewriter 抓取的片段
  if (!lyricsRaw && lyricsParts.length > 0) {
    logInfo('genius lyrics resolved from html', { songId, url })
    lyricsRaw = lyricsParts.join('').trim()
  }
  
  // 如果还是没有，尝试通过内部接口（兜底）
  if (!lyricsRaw) {
    logInfo('genius lyrics fallback to internal api', { songId, url })
    lyricsRaw = await fetchInternalLyrics(Number(songId))
  }

  const lyrics = lyricsRaw ? cleanLyrics(lyricsRaw) : undefined

  return {
    geniusId: Number(songId),
    title: songData.title,
    artist: artistName,
    album: albumName,
    releaseDate: songData.releaseDateForDisplay ?? songData.release_date_for_display,
    geniusUrl: url,
    pageViews: songData.stats?.pageviews,
    annotations,
    lyrics: lyrics || undefined,
    cachedAt: new Date().toISOString(),
  }
}
