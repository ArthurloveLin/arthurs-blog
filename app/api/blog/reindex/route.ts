import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import matter from 'gray-matter'
import { listR2Objects, getR2Object } from '@/lib/r2'
import { upsertPost } from '@/lib/blog'

const BLOG_BUCKET = process.env.R2_BLOG_BUCKET!

function generateSlug(r2Key: string, frontmatterSlug?: string): string {
  if (frontmatterSlug) return frontmatterSlug
  // 去掉路径前缀和 .md 后缀，中文保留（URL encode 由浏览器处理）
  const filename = r2Key.split('/').pop()!.replace(/\.md$/i, '')
  return encodeURIComponent(filename)
}

export async function POST() {
  const keys = await listR2Objects(BLOG_BUCKET)
  const mdKeys = keys.filter((k) => k.endsWith('.md'))

  const results: { key: string; slug: string; status: 'ok' | 'skip' | 'error'; reason?: string }[] = []

  for (const key of mdKeys) {
    try {
      const raw = await getR2Object(BLOG_BUCKET, key)
      const { data: fm, excerpt } = matter(raw, { excerpt: true, excerpt_separator: '<!-- more -->' })

      if (!fm.title) {
        results.push({ key, slug: '', status: 'skip', reason: 'missing title' })
        continue
      }

      if (fm.published !== true) {
        results.push({ key, slug: '', status: 'skip', reason: 'published != true' })
        continue
      }

      const slug = generateSlug(key, fm.slug)
      const summary = fm.summary ?? fm.excerpt ?? (excerpt?.trim().slice(0, 200)) ?? null

      await upsertPost({
        slug,
        title: fm.title,
        summary,
        tags: Array.isArray(fm.tags) ? fm.tags : [],
        r2_key: key,
        published: true,
        published_at: fm.date ? new Date(fm.date).toISOString() : new Date().toISOString(),
      })

      results.push({ key, slug, status: 'ok' })
    } catch (err) {
      results.push({ key, slug: '', status: 'error', reason: String(err) })
    }
  }

  const summary = {
    total: mdKeys.length,
    indexed: results.filter((r) => r.status === 'ok').length,
    skipped: results.filter((r) => r.status === 'skip').length,
    errors: results.filter((r) => r.status === 'error').length,
  }

  revalidatePath('/')
  revalidatePath('/blog/[slug]', 'page')
  revalidatePath('/blog/tags/[tag]', 'page')

  return NextResponse.json({ summary, details: results })
}
