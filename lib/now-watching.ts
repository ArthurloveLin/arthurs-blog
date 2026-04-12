import { unstable_cache } from 'next/cache'
import { listR2Objects } from '@/lib/r2'

const NOW_WATCHING_PREFIXES = ['now-watching/', 'obsidian-vault/now-watching/']
const COLUMN_COUNT = 3
const ITEMS_PER_COLUMN = 10
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif'])

export interface NowWatchingPoster {
  id: string
  title: string
  imageUrl: string
  key: string
}

function getNowWatchingConfig() {
  const bucket = process.env.R2_BLOG_BUCKET
  const publicDomain = process.env.R2_BLOG_PUBLIC_DOMAIN

  if (!bucket || !publicDomain) {
    throw new Error('Now Watching is not configured.')
  }

  return { bucket, publicDomain }
}

function isImageKey(key: string) {
  const extensionIndex = key.lastIndexOf('.')
  if (extensionIndex === -1) return false
  return IMAGE_EXTENSIONS.has(key.slice(extensionIndex).toLowerCase())
}

function encodeKeyForPublicUrl(key: string) {
  return key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function toPublicUrl(publicDomain: string, key: string) {
  return `https://${publicDomain}/${encodeKeyForPublicUrl(key)}`
}

function parsePosterTitle(key: string) {
  const fileName = key.split('/').pop() ?? key
  const extensionIndex = fileName.lastIndexOf('.')
  const rawTitle = extensionIndex === -1 ? fileName : fileName.slice(0, extensionIndex)

  try {
    return decodeURIComponent(rawTitle).trim()
  } catch {
    return rawTitle.trim()
  }
}

function repeatPosters(posters: NowWatchingPoster[], targetCount: number) {
  if (posters.length === 0) return []

  const repeated: NowWatchingPoster[] = []

  while (repeated.length < targetCount) {
    const poster = posters[repeated.length % posters.length]
    repeated.push(poster)
  }

  return repeated
}

function normalizeNowWatchingKey(key: string) {
  for (const prefix of NOW_WATCHING_PREFIXES) {
    if (key.startsWith(prefix)) {
      return {
        key,
        normalizedKey: key.slice(prefix.length),
      }
    }
  }

  return null
}

const getCachedNowWatchingPosters = unstable_cache(
  async (): Promise<NowWatchingPoster[]> => {
    const { bucket, publicDomain } = getNowWatchingConfig()
    const keyGroups = await Promise.all(
      NOW_WATCHING_PREFIXES.map((prefix) => listR2Objects(bucket, prefix))
    )
    const keys = Array.from(new Set(keyGroups.flat()))

    return keys
      .map((key) => {
        const normalized = normalizeNowWatchingKey(key)
        if (!normalized) return null
        if (!isImageKey(normalized.normalizedKey)) return null

        return {
          id: key,
          key,
          title: parsePosterTitle(normalized.normalizedKey),
          imageUrl: toPublicUrl(publicDomain, key),
        }
      })
      .filter((poster): poster is NowWatchingPoster => poster !== null)
        .sort((left, right) => left.key.localeCompare(right.key, 'zh-CN'))
  },
  ['now-watching-posters'],
  { revalidate: 60, tags: ['now-watching'] }
)

export async function getNowWatchingPosters() {
  return getCachedNowWatchingPosters()
}

export async function getNowWatchingColumns(): Promise<NowWatchingPoster[][]> {
  const posters = await getNowWatchingPosters()
  const repeated = repeatPosters(posters, COLUMN_COUNT * ITEMS_PER_COLUMN)

  return Array.from({ length: COLUMN_COUNT }, (_, columnIndex) => {
    const start = columnIndex * ITEMS_PER_COLUMN
    const end = start + ITEMS_PER_COLUMN

    return repeated.slice(start, end).map((poster, itemIndex) => ({
      ...poster,
      id: `${poster.key}-${columnIndex}-${itemIndex}`,
    }))
  })
}