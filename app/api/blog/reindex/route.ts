import { NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import matter from 'gray-matter'
import { parseBlogFrontmatterDate } from '@/lib/date-format'
import { stripMarkdownToText } from '@/lib/blog-search'
import { listR2ObjectsWithMeta, getR2Object } from '@/lib/r2'
import {
  BLOG_CACHE_TAGS,
  deletePostsNotIn,
  getArchivePostsTag,
  getCategoryPostsTag,
  getPostContentTag,
  getPostMetaTag,
  getPostRawTag,
  getPostsMetadata,
  getTagPostsTag,
  upsertPost,
} from '@/lib/blog'
import { purgeCloudflareFiles } from '@/lib/cloudflare-cache'

const BLOG_BUCKET = process.env.R2_BLOG_BUCKET!
const CONCURRENCY = 10

interface IndexedPostSnapshot {
  slug: string
  category: string | null
  tags: string[]
  published_at: string | null
  published: boolean
}

function generateSlug(r2Key: string, frontmatterSlug?: string): string {
  if (frontmatterSlug) return frontmatterSlug
  const filename = r2Key.split('/').pop()!.replace(/\.md$/i, '')
  return encodeURIComponent(filename)
}

async function processFile(
  key: string,
  domain: string | undefined
): Promise<{ snapshot?: IndexedPostSnapshot; status: 'ok' | 'skip'; reason?: string }> {
  const raw = await getR2Object(BLOG_BUCKET, key)
  const { data: fm, content: mdContent, excerpt } = matter(raw, { excerpt: true, excerpt_separator: '<!-- more -->' })

  if (fm.type === 'site_config') {
    return { status: 'skip', reason: 'site_config (deprecated)' }
  }

  if (!fm.title) return { status: 'skip', reason: 'missing title' }
  
  const published = fm.published === true
  const slug = generateSlug(key, fm.slug)
  const publishedAt = parseBlogFrontmatterDate(fm.date)
  const tags = Array.isArray(fm.tags) ? fm.tags : []
  const category = typeof fm.category === 'string' ? fm.category : null
  
  // 提取摘要逻辑：优先 fm.summary，其次 <!-- more --> (fm.excerpt)，最后尝试提取正文第一段
  const firstParagraph = mdContent.split(/\n\s*\n/).find(p => p.trim() && !p.trim().startsWith('#'))?.trim()
  const summary = fm.summary ?? fm.excerpt ?? (excerpt?.trim()) ?? firstParagraph ?? null
  const searchContent = stripMarkdownToText(mdContent)
  const charCount = searchContent.replace(/\s/g, '').length
  const reading_minutes = Math.max(1, Math.ceil(charCount / 320))

  await upsertPost({
    slug,
    title: fm.title,
    summary,
    tags,
    category,
    cover_image: (() => {
      const firstImageMatch = mdContent.match(/!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/)
      const rawImg = typeof fm.cover_image === 'string'
        ? fm.cover_image
        : (firstImageMatch?.[1] ?? null)
      if (!rawImg) return null
      if (rawImg.startsWith('http')) return rawImg
      if (!domain) return null
      const noteDir = key.includes('/') ? key.split('/').slice(0, -1).join('/') + '/' : ''
      const imagePath = rawImg.includes('/')
        ? rawImg.split('/').map(encodeURIComponent).join('/')
        : `images/${encodeURIComponent(rawImg.trim())}`
      return `https://${domain}/${noteDir}${imagePath}`
    })(),
    r2_key: key,
    search_content: searchContent,
    published,
    published_at: publishedAt,
    sticky: typeof fm.sticky === 'number' ? fm.sticky : 0,
    reading_minutes,
  })

  return {
    status: 'ok',
    snapshot: {
      slug,
      category,
      tags,
      published_at: publishedAt,
      published,
    },
  }
}

function getArchiveYear(publishedAt: string | null) {
  if (!publishedAt) return null

  const parsed = new Date(publishedAt)
  if (Number.isNaN(parsed.getTime())) return null

  return parsed.getUTCFullYear().toString()
}

function addAggregationInvalidations(paths: {
  tags: Set<string>
  categories: Set<string>
  archiveYears: Set<string>
}, cacheTags: Set<string>, snapshot?: IndexedPostSnapshot) {
  if (!snapshot?.published) return

  for (const tag of snapshot.tags) {
    paths.tags.add(`/tag/${encodeURIComponent(tag)}`)
    cacheTags.add(getTagPostsTag(tag))
  }

  if (snapshot.category) {
    paths.categories.add(`/category/${encodeURIComponent(snapshot.category)}`)
    cacheTags.add(getCategoryPostsTag(snapshot.category))
  }

  const archiveYear = getArchiveYear(snapshot.published_at)
  if (archiveYear) {
    paths.archiveYears.add(`/archive/${archiveYear}`)
    cacheTags.add(getArchivePostsTag(archiveYear))
  }
}

export async function POST(request: Request) {
  const domain = process.env.R2_BLOG_PUBLIC_DOMAIN
  const force = new URL(request.url).searchParams.get('force') === '1'

  const [allObjects, existingPosts] = await Promise.all([
    listR2ObjectsWithMeta(BLOG_BUCKET),
    getPostsMetadata(),
  ])

  const mdObjects = allObjects.filter((o) => o.key.endsWith('.md'))
  const mdKeys = mdObjects.map((o) => o.key)

  // P1: 建立 r2_key → DB updated_at 的映射，用于跳过未变更文件
  const dbMap = new Map(existingPosts.map((p) => [p.r2_key, p]))

  const toProcess = force
    ? mdObjects
    : mdObjects.filter(({ key, lastModified }) => {
        const existing = dbMap.get(key)
        if (!existing) return true // 新文件
        if (!lastModified) return true // R2 无时间戳，保守处理
        return lastModified > new Date(existing.updated_at) // 文件在上次 reindex 后有修改
      })

  const unchangedCount = mdObjects.length - toProcess.length

  type Result = { key: string; snapshot?: IndexedPostSnapshot; status: 'ok' | 'skip' | 'error' | 'unchanged'; reason?: string }
  const results: Result[] = []

  // P0: 分批并行处理需要更新的文件
  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    const batch = toProcess.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map(async ({ key }) => {
        try {
          const result = await processFile(key, domain)
          return { key, ...result }
        } catch (err) {
          return { key, status: 'error' as const, reason: String(err) }
        }
      })
    )
    results.push(...batchResults)
  }

  const deletedPosts = existingPosts.filter((post) => !mdKeys.includes(post.r2_key))
  const deleted = await deletePostsNotIn(mdKeys)

  const summary = {
    total: mdKeys.length,
    processed: toProcess.length,
    unchanged: unchangedCount,
    indexed: results.filter((r) => r.status === 'ok').length,
    skipped: results.filter((r) => r.status === 'skip').length,
    errors: results.filter((r) => r.status === 'error').length,
    deleted,
  }

  const updatedResults = results.filter((r) => r.status === 'ok')
  const cloudflarePurgePaths = new Set<string>()

  if (toProcess.length > 0 || deleted > 0) {
    const aggregationPaths = {
      tags: new Set<string>(),
      categories: new Set<string>(),
      archiveYears: new Set<string>(),
    }
    const aggregationCacheTags = new Set<string>()
    const blogPaths = new Set<string>()

    cloudflarePurgePaths.add('/')
    cloudflarePurgePaths.add('/archive')

    revalidatePath('/')
    revalidatePath('/archive')
    revalidatePath('/wardrobe')

    revalidateTag(BLOG_CACHE_TAGS.recentPosts, 'max')
    revalidateTag(BLOG_CACHE_TAGS.postsCount, 'max')
    revalidateTag(BLOG_CACHE_TAGS.categories, 'max')
    revalidateTag(BLOG_CACHE_TAGS.allTags, 'max')
    revalidateTag(BLOG_CACHE_TAGS.yearArchive, 'max')

    for (const deletedPost of deletedPosts) {
      addAggregationInvalidations(aggregationPaths, aggregationCacheTags, deletedPost)
      blogPaths.add(`/blog/${decodeURIComponent(deletedPost.slug)}`)
    }

    for (const { snapshot, key } of updatedResults) {
      const previousSnapshot = dbMap.get(key)

      addAggregationInvalidations(aggregationPaths, aggregationCacheTags, previousSnapshot)
      addAggregationInvalidations(aggregationPaths, aggregationCacheTags, snapshot)

      if (previousSnapshot?.slug) {
        blogPaths.add(`/blog/${decodeURIComponent(previousSnapshot.slug)}`)
      }

      if (snapshot?.slug) {
        blogPaths.add(`/blog/${decodeURIComponent(snapshot.slug)}`)
      }

      const postSlugs = new Set(
        [previousSnapshot?.slug, snapshot?.slug].filter((value): value is string => Boolean(value))
      )
      const encodedKey = encodeURIComponent(key)

      for (const slug of postSlugs) {
        revalidateTag(getPostMetaTag(slug), 'max')
        revalidateTag(getPostContentTag(slug), 'max')
      }

      revalidateTag(getPostRawTag(key), 'max')
    }

    for (const tag of aggregationCacheTags) {
      revalidateTag(tag, 'max')
    }

    for (const path of blogPaths) {
      cloudflarePurgePaths.add(path)
      revalidatePath(path)
    }

    for (const path of aggregationPaths.tags) {
      cloudflarePurgePaths.add(path)
      revalidatePath(path)
    }

    for (const path of aggregationPaths.categories) {
      cloudflarePurgePaths.add(path)
      revalidatePath(path)
    }

    for (const path of aggregationPaths.archiveYears) {
      cloudflarePurgePaths.add(path)
      revalidatePath(path)
    }
  }

  if ((updatedResults.length > 0 || deleted > 0) && process.env.CF_ZONE_ID && process.env.CF_API_TOKEN) {
    await purgeCloudflareFiles(new URL(request.url).origin, cloudflarePurgePaths)
  }

  return NextResponse.json({ summary, details: results })
}
