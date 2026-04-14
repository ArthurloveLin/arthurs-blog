import { unstable_cache } from 'next/cache'
import { imageSize } from 'image-size'
import { getR2Object, getR2ObjectBufferRange } from '@/lib/r2'

const NOW_WATCHING_PREFIXES = ['now-watching/', 'obsidian-vault/now-watching/']
const NOW_WATCHING_METADATA_KEYS = ['now-watching/metadata.json', 'obsidian-vault/now-watching/metadata.json']
const COLUMN_COUNT = 3
const ITEMS_PER_COLUMN = 10
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif'])
const IMAGE_HEADER_BYTES = 64 * 1024
const METADATA_SCAN_BATCH_SIZE = 8
const INITIAL_POSTER_TARGET = COLUMN_COUNT * ITEMS_PER_COLUMN

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
  height: number
  imageUrl: string
  key: string
  posterKind: PosterKind
  rating: number | null
  subjectUrl: string
  width: number
  watchDate: string | null
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

function isPortraitImage(width: number, height: number) {
  return height > width
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

async function getImageDimensions(bucket: string, key: string) {
  const buffer = await getR2ObjectBufferRange(bucket, key, 0, IMAGE_HEADER_BYTES - 1)
  const dimensions = imageSize(buffer)

  if (!dimensions.width || !dimensions.height) {
    return null
  }

  return {
    width: dimensions.width,
    height: dimensions.height,
  }
}

async function resolvePortraitCandidate(bucket: string, candidate: { key: string; kind: PosterKind }) {
  for (const keyVariant of expandNowWatchingKeyVariants(candidate.key)) {
    const normalized = normalizeNowWatchingKey(keyVariant)
    if (!normalized || !isImageKey(normalized.normalizedKey)) {
      continue
    }

    try {
      const dimensions = await getImageDimensions(bucket, keyVariant)
      if (!dimensions || !isPortraitImage(dimensions.width, dimensions.height)) {
        continue
      }

      return {
        key: keyVariant,
        kind: candidate.kind,
        dimensions,
      }
    } catch {
      continue
    }
  }

  return null
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

async function resolvePosterEntry(
  bucket: string,
  publicDomain: string,
  subjectUrl: string,
  entry: NowWatchingMetadataEntry
): Promise<NowWatchingPoster | null> {
  const candidates = await Promise.all(
    buildPosterCandidates(entry).map((candidate) => resolvePortraitCandidate(bucket, candidate))
  )

  const selectedCandidate = candidates
    .filter(
      (
        candidate
      ): candidate is {
        dimensions: { height: number; width: number }
        key: string
        kind: PosterKind
      } => candidate !== null
    )
    .sort((left, right) => {
      if (left.kind === right.kind) {
        return 0
      }

      return left.kind === 'fanart' ? -1 : 1
    })[0]

  if (!selectedCandidate) {
    return null
  }

  const displayTitle = selectDisplayTitle(entry, selectedCandidate.key)

  return {
    id: `${subjectUrl}:${selectedCandidate.key}`,
    key: selectedCandidate.key,
    title: entry.title?.trim() || displayTitle,
    displayTitle,
    width: selectedCandidate.dimensions.width,
    height: selectedCandidate.dimensions.height,
    imageUrl: toPublicUrl(publicDomain, selectedCandidate.key),
    posterKind: selectedCandidate.kind,
    rating: entry.rating ?? null,
    subjectUrl,
    watchDate: entry.watch_date ?? null,
  }
}

const getCachedNowWatchingPosters = unstable_cache(
  async (): Promise<NowWatchingPoster[]> => {
    const { bucket, publicDomain } = getNowWatchingConfig()
    const metadataRaw = await getFirstAvailableMetadataObject(bucket)
    const metadata = JSON.parse(metadataRaw) as NowWatchingMetadataIndex

    const sortedEntries = Object.entries(metadata).sort(sortMetadataEntries)
    const posters: NowWatchingPoster[] = []

    for (let index = 0; index < sortedEntries.length && posters.length < INITIAL_POSTER_TARGET; index += METADATA_SCAN_BATCH_SIZE) {
      const batch = sortedEntries.slice(index, index + METADATA_SCAN_BATCH_SIZE)
      const resolvedBatch = await Promise.all(
        batch.map(([subjectUrl, entry]) => resolvePosterEntry(bucket, publicDomain, subjectUrl, entry))
      )

      for (const poster of resolvedBatch) {
        if (!poster) continue
        posters.push(poster)

        if (posters.length >= INITIAL_POSTER_TARGET) {
          break
        }
      }
    }

    return posters.sort(sortPosters)
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