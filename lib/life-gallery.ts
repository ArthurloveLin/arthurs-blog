import { unstable_cache } from 'next/cache'
import { listR2Objects } from '@/lib/r2'

const GALLERY_PREFIX = 'Gallery/'
const MAX_THEMES = 4
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'])

export interface LifeGallerySlide {
  id: string
  title: string
  imageUrl: string
  key: string
  themeIndex: number
}

export interface LifeGalleryRound {
  id: string
  generatedAt: string
  slides: LifeGallerySlide[]
}

interface LifeGalleryTheme {
  title: string
  keys: string[]
}

function getGalleryConfig() {
  const bucket = process.env.R2_BLOG_BUCKET
  const publicDomain = process.env.R2_BLOG_PUBLIC_DOMAIN

  if (!bucket || !publicDomain) {
    throw new Error('Life Gallery is not configured.')
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

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)]
}

function sortThemes(themes: LifeGalleryTheme[]) {
  return [...themes].sort((left, right) => left.title.localeCompare(right.title, 'zh-CN'))
}

const getCachedLifeGalleryThemes = unstable_cache(
  async (): Promise<LifeGalleryTheme[]> => {
    const { bucket } = getGalleryConfig()
    const keys = await listR2Objects(bucket, GALLERY_PREFIX)
    const themeMap = new Map<string, string[]>()

    for (const key of keys) {
      if (!key.startsWith(GALLERY_PREFIX)) continue

      const relativeKey = key.slice(GALLERY_PREFIX.length)
      const slashIndex = relativeKey.indexOf('/')
      if (slashIndex === -1) continue

      const folderName = relativeKey.slice(0, slashIndex).trim()
      const fileName = relativeKey.slice(slashIndex + 1).trim()

      if (!folderName || !fileName || fileName.endsWith('/')) continue
      if (!isImageKey(fileName)) continue

      const currentKeys = themeMap.get(folderName) ?? []
      currentKeys.push(key)
      themeMap.set(folderName, currentKeys)
    }

    return sortThemes(
      Array.from(themeMap.entries())
        .filter(([, themeKeys]) => themeKeys.length > 0)
        .map(([title, themeKeys]) => ({ title, keys: themeKeys }))
    )
  },
  ['life-gallery-themes'],
  { revalidate: 3600, tags: ['life-gallery'] }
)

export async function listLifeGalleryThemes(): Promise<LifeGalleryTheme[]> {
  return getCachedLifeGalleryThemes()
}

export async function getLifeGalleryRound(): Promise<LifeGalleryRound> {
  const { publicDomain } = getGalleryConfig()
  const themes = await listLifeGalleryThemes()

  if (themes.length < MAX_THEMES) {
    throw new Error(`Life Gallery requires at least ${MAX_THEMES} populated themes.`)
  }

  const selectedThemes = themes.slice(0, MAX_THEMES)
  const slides = selectedThemes.map((theme, index) => {
    const key = randomItem(theme.keys)

    return {
      id: `${theme.title}-${index}-${key}`,
      title: theme.title,
      imageUrl: toPublicUrl(publicDomain, key),
      key,
      themeIndex: index,
    }
  })

  return {
    id: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    slides,
  }
}