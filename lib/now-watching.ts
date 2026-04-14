import { unstable_cache } from 'next/cache'
import { getR2Object } from '@/lib/r2'

const NOW_WATCHING_PREFIXES = ['now-watching/', 'obsidian-vault/now-watching/']
const NOW_WATCHING_METADATA_KEYS = ['now-watching/metadata.json', 'obsidian-vault/now-watching/metadata.json']
const COLUMN_COUNT = 3
const ITEMS_PER_COLUMN = 10
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif'])

type PosterKind = 'fanart' | 'poster'

interface NowWatchingMetadataEntry {
  fanart_key?: string | null
  rating?: number | null
  s3_key?: string | null
  title?: string | null
  watch_date?: string | null
  year?: string | null
}

type NowWatchingMetadataIndex = Record<string, NowWatchingMetadataEntry>

export interface NowWatchingPoster {
  id: string
  title: string
  displayTitle: string
  imageUrl: string
  key: string
  posterKind: PosterKind
  rating: number | null
  subjectUrl: string
  watchDate: string | null
}

export interface PagedNowWatchingPosters {
  posters: NowWatchingPoster[]
  totalCount: number
  hasMore: boolean
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

function normalizeMetadataObjectKey(key: string | null | undefined) {
  const trimmedKey = key?.trim().replace(/^\/+/, '')
  if (!trimmedKey) return null

  if (NOW_WATCHING_PREFIXES.some((prefix) => trimmedKey.startsWith(prefix))) {
    return trimmedKey
  }

  return `now-watching/${trimmedKey}`
}

function expandNowWatchingKeyVariants(key: string) {
  const normalizedKey = normalizeMetadataObjectKey(key)
  if (!normalizedKey) return []

  if (normalizedKey.startsWith('obsidian-vault/now-watching/')) {
    return [normalizedKey, normalizedKey.replace(/^obsidian-vault\/now-watching\//, 'now-watching/')]
  }

  if (normalizedKey.startsWith('now-watching/')) {
    return [normalizedKey, `obsidian-vault/${normalizedKey}`]
  }

  return [normalizedKey]
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

function sortPosters(left: NowWatchingPoster, right: NowWatchingPoster) {
  const leftTime = left.watchDate ? Date.parse(left.watchDate) : Number.NEGATIVE_INFINITY
  const rightTime = right.watchDate ? Date.parse(right.watchDate) : Number.NEGATIVE_INFINITY

  if (leftTime !== rightTime) {
    return rightTime - leftTime
  }

  return left.displayTitle.localeCompare(right.displayTitle, 'zh-CN')
}

function sortMetadataEntries(
  left: [string, NowWatchingMetadataEntry],
  right: [string, NowWatchingMetadataEntry]
) {
  const leftTime = left[1].watch_date ? Date.parse(left[1].watch_date) : Number.NEGATIVE_INFINITY
  const rightTime = right[1].watch_date ? Date.parse(right[1].watch_date) : Number.NEGATIVE_INFINITY

  if (leftTime !== rightTime) {
    return rightTime - leftTime
  }

  return (left[1].title ?? left[0]).localeCompare(right[1].title ?? right[0], 'zh-CN')
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

async function getFirstAvailableMetadataObject(bucket: string) {
  let lastError: unknown

  for (const key of NOW_WATCHING_METADATA_KEYS) {
    try {
      return await getR2Object(bucket, key)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError ?? new Error('Now Watching metadata was not found.')
}

function buildPosterCandidates(entry: NowWatchingMetadataEntry) {
  return [
    { key: normalizeMetadataObjectKey(entry.fanart_key), kind: 'fanart' as const },
    { key: normalizeMetadataObjectKey(entry.s3_key), kind: 'poster' as const },
  ].filter((candidate): candidate is { key: string; kind: PosterKind } => Boolean(candidate.key))
}

function selectDisplayTitle(entry: NowWatchingMetadataEntry, key: string) {
  const normalized = normalizeNowWatchingKey(key)
  const parsedTitle = parsePosterTitle(normalized?.normalizedKey ?? key)
  return parsedTitle || entry.title?.trim() || 'Untitled'
}

/**
 * 同步解析海报条目，不做任何 R2 图片读取。
 * 横屏图（fanart）由 CSS aspect-ratio + object-fit: cover 自动裁切为竖向展示。
 */
function resolvePosterEntrySync(
  publicDomain: string,
  subjectUrl: string,
  entry: NowWatchingMetadataEntry
): NowWatchingPoster | null {
  const candidates = buildPosterCandidates(entry)

  for (const candidate of candidates) {
    for (const keyVariant of expandNowWatchingKeyVariants(candidate.key)) {
      const normalized = normalizeNowWatchingKey(keyVariant)
      if (!normalized || !isImageKey(normalized.normalizedKey)) continue

      const displayTitle = selectDisplayTitle(entry, keyVariant)
      return {
        id: subjectUrl,
        key: keyVariant,
        title: entry.title?.trim() || displayTitle,
        displayTitle,
        imageUrl: toPublicUrl(publicDomain, keyVariant),
        posterKind: candidate.kind,
        rating: entry.rating ?? null,
        subjectUrl,
        watchDate: entry.watch_date ?? null,
      }
    }
  }

  return null
}

const getCachedAllNowWatchingPosters = unstable_cache(
  async (): Promise<NowWatchingPoster[]> => {
    const { bucket, publicDomain } = getNowWatchingConfig()
    const metadataRaw = await getFirstAvailableMetadataObject(bucket)
    const metadata = JSON.parse(metadataRaw) as NowWatchingMetadataIndex

    return Object.entries(metadata)
      .sort(sortMetadataEntries)
      .map(([subjectUrl, entry]) => resolvePosterEntrySync(publicDomain, subjectUrl, entry))
      .filter((poster): poster is NowWatchingPoster => poster !== null)
  },
  ['now-watching-all-posters'],
  { revalidate: 3600, tags: ['now-watching'] }
)

export async function getPagedNowWatchingPosters(
  page: number,
  perPage: number
): Promise<PagedNowWatchingPosters> {
  const all = await getCachedAllNowWatchingPosters()
  const start = (page - 1) * perPage

  return {
    posters: all.slice(start, start + perPage),
    totalCount: all.length,
    hasMore: start + perPage < all.length,
  }
}

export async function getNowWatchingColumns(): Promise<NowWatchingPoster[][]> {
  const { posters } = await getPagedNowWatchingPosters(1, COLUMN_COUNT * ITEMS_PER_COLUMN)
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