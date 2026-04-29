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

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LyricsBot/1.0)',
    },
  })

  if (!res.ok) return null

  const data = await res.json() as {
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

  const hits = data?.response?.hits
  if (!hits || hits.length === 0) return null

  const best = hits[0]?.result
  if (!best) return null

  return {
    url: best.url,
    id: best.id,
    title: best.title,
    artistName: best.primary_artist?.name ?? '',
  }
}
