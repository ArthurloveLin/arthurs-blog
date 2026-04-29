import type { GeniusSongData } from './types'

export function buildCacheKey(trackId: string, artist: string, title: string): string {
  if (trackId) return `song:${trackId}`
  const a = artist.toLowerCase().trim()
  const t = title.toLowerCase().trim()
  return `song:${a}:${t}`
}

export async function getFromCache(
  kv: KVNamespace,
  key: string
): Promise<GeniusSongData | null> {
  const raw = await kv.get(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as GeniusSongData
  } catch {
    return null
  }
}

export async function writeToCache(
  kv: KVNamespace,
  key: string,
  data: GeniusSongData
): Promise<void> {
  await kv.put(key, JSON.stringify(data))
}
