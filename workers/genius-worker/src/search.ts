import { fetchWithRetry } from './http'
import { logError, logInfo, logWarn } from './log'

export interface GeniusSearchResult {
  url: string
  id: number
  title: string
  artistName: string
}

export async function searchGenius(
  title: string,
  artist: string,
  apiToken: string
): Promise<GeniusSearchResult | null> {
  const query = `${title} ${artist}`
  const url = `https://api.genius.com/search?q=${encodeURIComponent(query)}&access_token=${apiToken}`

  let res: Response

  try {
    res = await fetchWithRetry(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LyricsBot/1.0)',
      },
    })
  } catch (error) {
    logError('genius search request failed', error, { title, artist })
    throw error
  }

  if (!res.ok) {
    logWarn('genius search upstream non-ok', { title, artist, status: res.status })
    return null
  }

  let data: {
    response?: {
      hits?: Array<{
        result?: {
          url: string
          id: number
          title: string
          primary_artist?: { name: string }
        }
      }>
    }
  }

  try {
    data = await res.json() as {
      response?: {
        hits?: Array<{
          result?: {
            url: string
            id: number
            title: string
            primary_artist?: { name: string }
          }
        }>
      }
    }
  } catch (error) {
    logError('genius search response parse failed', error, { title, artist, status: res.status })
    return null
  }

  const hits = data?.response?.hits
  if (!hits || hits.length === 0) return null

  // 改进匹配逻辑：提取主唱艺人，处理 Spotify 常见的 "Artist A, Artist B" 格式
  const artists = artist.split(/[,&]|\bfeat\.?\b/i).map(s => s.trim()).filter(Boolean)
  const primaryArtist = artists[0] || artist
  
  const artistNorm = artist.toLowerCase().replace(/[^a-z0-9一-鿿]/g, '')
  const primaryArtistNorm = primaryArtist.toLowerCase().replace(/[^a-z0-9一-鿿]/g, '')

  const best = hits
    .map((h) => h?.result)
    .filter((r): r is NonNullable<typeof r> => !!r)
    .find((r) => {
      const resultArtist = (r.primary_artist?.name ?? '').toLowerCase().replace(/[^a-z0-9一-鿿]/g, '')
      // 匹配策略：
      // 1. 搜索结果包含主唱名 (e.g. "Kanye West" includes "Kanye West")
      // 2. 主唱名包含搜索结果 (e.g. "Kanye West" matches "Kanye")
      // 3. 搜索结果包含在完整的艺人列表中 (e.g. "Kanye West, Pusha T" includes "Kanye West")
      return resultArtist.includes(primaryArtistNorm) || 
             primaryArtistNorm.includes(resultArtist) ||
             artistNorm.includes(resultArtist)
    })

  if (!best) {
    logInfo('genius search artist mismatch', { title, artist, hits: hits.length })
    return null
  }

  return {
    url: best.url,
    id: best.id,
    title: best.title,
    artistName: best.primary_artist?.name ?? '',
  }
}
