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

  // Validate: artist name must loosely match.
  // Genius search can return completely unrelated results when the title has
  // non-ASCII characters (e.g. Chinese title matches a translated-lyrics page).
  const artistNorm = artist.toLowerCase().replace(/[^a-z0-9一-鿿]/g, '')

  const best = hits
    .map((h) => h?.result)
    .filter((r): r is NonNullable<typeof r> => !!r)
    .find((r) => {
      const resultArtist = (r.primary_artist?.name ?? '').toLowerCase().replace(/[^a-z0-9一-鿿]/g, '')
      // Accept if either contains the other (handles partial names)
      return resultArtist.includes(artistNorm) || artistNorm.includes(resultArtist)
    })

  if (!best) {
    console.log(`[search] no matching artist among ${hits.length} hits for "${artist}"`)
    return null
  }

  return {
    url: best.url,
    id: best.id,
    title: best.title,
    artistName: best.primary_artist?.name ?? '',
  }
}
