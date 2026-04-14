import { NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import matter from 'gray-matter'
import { parseBlogFrontmatterDate } from '@/lib/date-format'
import { listR2ObjectsWithMeta, getR2Object } from '@/lib/r2'
import { upsertPost, deletePostsNotIn } from '@/lib/blog'

const BLOG_BUCKET = process.env.R2_BLOG_BUCKET!
const CONCURRENCY = 10

function generateSlug(r2Key: string, frontmatterSlug?: string): string {
  if (frontmatterSlug) return frontmatterSlug
  const filename = r2Key.split('/').pop()!.replace(/\.md$/i, '')
  return encodeURIComponent(filename)
}

async function processFile(
  key: string,
  domain: string | undefined
): Promise<{ slug: string; status: 'ok' | 'skip'; reason?: string }> {
  const raw = await getR2Object(BLOG_BUCKET, key)
  const { data: fm, content: mdContent, excerpt } = matter(raw, { excerpt: true, excerpt_separator: '<!-- more -->' })

  if (fm.type === 'site_config') {
    return { slug: '', status: 'skip', reason: 'site_config (deprecated)' }
  }

  if (!fm.title) return { slug: '', status: 'skip', reason: 'missing title' }
  
  const published = fm.published === true
  const slug = generateSlug(key, fm.slug)
  const summary = fm.summary ?? fm.excerpt ?? (excerpt?.trim().slice(0, 200)) ?? null

  await upsertPost({
    slug,
    title: fm.title,
    summary,
    tags: Array.isArray(fm.tags) ? fm.tags : [],
    category: typeof fm.category === 'string' ? fm.category : null,
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
    published,
    published_at: parseBlogFrontmatterDate(fm.date),
  })

  return { slug, status: 'ok' }
}

export async function POST() {
  const domain = process.env.R2_BLOG_PUBLIC_DOMAIN

  const allObjects = await listR2ObjectsWithMeta(BLOG_BUCKET)

  const mdObjects = allObjects.filter((o) => o.key.endsWith('.md'))
  const mdKeys = mdObjects.map((o) => o.key)
  const toProcess = mdObjects
  const unchangedCount = 0

  type Result = { key: string; slug: string; status: 'ok' | 'skip' | 'error' | 'unchanged'; reason?: string }
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
          return { key, slug: '', status: 'error' as const, reason: String(err) }
        }
      })
    )
    results.push(...batchResults)
  }

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

  revalidatePath('/')
  revalidatePath('/blog/[slug]', 'page')
  revalidatePath('/blog/tags/[tag]', 'page')
  revalidatePath('/blog/category/[category]', 'page')
  revalidatePath('/archive')
  revalidatePath('/wardrobe')

  // P1: Data Cache Invalidation (More precise than path revalidation)
  revalidateTag('posts', 'max')
  revalidateTag('categories', 'max')
  revalidateTag('all-tags', 'max')
  revalidateTag('year-archive', 'max')

  const updatedResults = results.filter((r) => r.status === 'ok')

  // Invalidating specific post data
  for (const { slug, key } of updatedResults) {
    const normalizedSlug = decodeURIComponent(slug)
    revalidateTag(`post-meta-${normalizedSlug}`, 'max')
    revalidateTag(`post-content-${normalizedSlug}`, 'max')
    revalidateTag(`post-raw-${key}`, 'max')
  }

  if (updatedResults.length > 0 && process.env.CF_ZONE_ID && process.env.CF_API_TOKEN) {
    await fetch(
      `https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}/purge_cache`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ purge_everything: true }),
      }
    )
  }

  return NextResponse.json({ summary, details: results })
}
