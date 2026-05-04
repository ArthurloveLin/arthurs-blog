import matter from 'gray-matter'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { supabase } from './supabase'
import { supabaseAdmin } from './supabase-admin'
import { getR2Object } from './r2'
import { buildSearchSnippet, normalizeSearchQuery, SEARCH_MIN_QUERY_LENGTH, type SearchMatchField } from './blog-search'

const BLOG_BUCKET = process.env.R2_BLOG_BUCKET!
const BLOG_PUBLIC_DOMAIN = process.env.R2_BLOG_PUBLIC_DOMAIN

export interface Post {
  id: string
  slug: string
  title: string
  summary: string | null
  tags: string[]
  category: string | null
  cover_image: string | null
  r2_key: string
  published: boolean
  published_at: string | null
  updated_at: string
  sticky: number
  reading_minutes: number
}

export interface SearchPostResult extends Post {
  rank: number
  matched_fields: SearchMatchField[]
  snippet: string
  type?: 'post' | 'internal'
}

interface SearchPostRow extends Post {
  matched_fields: SearchMatchField[] | null
  rank: number | null
  search_content: string | null
  total_count: number | null
}

export async function getPosts(limit = 20, offset = 0): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('published', true)
    .order('sticky', { ascending: false })
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)
  return data ?? []
}

// 轻量级获取文章元数据，用于侧边栏渲染，减少序列化开销
export const getRecentPostsMetadata = unstable_cache(
  async function (limit = 10): Promise<Post[]> {
    const { data, error } = await supabase
      .from('posts')
      .select('id, slug, title, published_at, sticky')
      .eq('published', true)
      .order('sticky', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    return (data ?? []) as Post[]
  },
  ['recent-posts-metadata'],
  { revalidate: 3600, tags: ['posts'] }
)

export const getPostsCount = unstable_cache(
  async function (): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('published', true)
      if (error) throw new Error(error.message)
      return count ?? 0
    } catch (error) {
      console.error('Failed to load posts count from Supabase:', error)
      return 0
    }
  },
  ['posts-count'],
  { revalidate: 3600, tags: ['posts-count'] }
)

export async function getPostsByTag(tag: string, limit = 20, offset = 0): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('published', true)
    .contains('tags', [tag])
    .order('sticky', { ascending: false })
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)
  return data ?? []
}

export const getPostsByTags = unstable_cache(
  async function (tags: string[], limit = 20, offset = 0): Promise<Post[]> {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('published', true)
      .contains('tags', tags)
      .order('sticky', { ascending: false })
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw new Error(error.message)
    return data ?? []
  },
  ['posts-by-tags'],
  { revalidate: 3600, tags: ['posts'] }
)

// 通用的数据缓存包装器，确保 slug 在作为 tag 使用时经过统一的解码处理
const getCachedPostMeta = unstable_cache(
  async (slug: string) => {
    const { data: post, error } = await supabase
      .from('posts')
      .select('*')
      .eq('slug', slug)
      .eq('published', true)
      .single()

    if (error || !post) return null
    return post
  },
  ['post-meta'],
  { revalidate: 60, tags: ['posts'] }
)

export const getPostMeta = cache(async function getPostMeta(slug: string): Promise<Post | null> {
  const normalizedSlug = decodeURIComponent(slug)
  const encodedSlug = encodeURIComponent(normalizedSlug)
  return unstable_cache(
    () => getCachedPostMeta(normalizedSlug),
    [`post-meta-${encodedSlug}`],
    { revalidate: 60, tags: ['posts', `post-meta-${encodedSlug}`] }
  )()
})

const getCachedPostContent = (r2Key: string) => {
  const encodedKey = encodeURIComponent(r2Key)
  return unstable_cache(
    async () => {
      const raw = await getR2Object(BLOG_BUCKET, r2Key)
      const { content } = matter(raw)
      return content
    },
    [`post-content-${encodedKey}`],
    { revalidate: 300, tags: [`post-raw-${encodedKey}`] }
  )()
}


export async function getPostContent(post: Post): Promise<string> {
  const normalizedSlug = decodeURIComponent(post.slug)
  const encodedSlug = encodeURIComponent(normalizedSlug)
  const encodedKey = encodeURIComponent(post.r2_key)
  
  return unstable_cache(
    async () => {
      const content = (await getCachedPostContent(post.r2_key)).replace('<!-- more -->', '')

      // 将 Obsidian 附件引用替换为 R2 公开域名 URL
      const noteDir = post.r2_key.includes('/')
        ? post.r2_key.split('/').slice(0, -1).join('/') + '/'
        : ''
        
      return BLOG_PUBLIC_DOMAIN
        ? content.replace(
            /!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g,
            (_, filename: string) =>
              `![](https://${BLOG_PUBLIC_DOMAIN}/${noteDir}images/${encodeURIComponent(filename.trim())})`
          )
        : content
    },
    [`post-rendered-content-${encodedKey}`],
    { revalidate: 300, tags: [`post-content-${encodedSlug}`] }
  )()
}

export async function getPostBySlug(slug: string): Promise<{ post: Post; content: string } | null> {
  const post = await getPostMeta(slug)
  if (!post) return null
  const content = await getPostContent(post)
  return { post, content }
}

export async function getAdjacentPosts(publishedAt: string): Promise<{ prev: Post | null; next: Post | null }> {
  const [{ data: prev }, { data: next }] = await Promise.all([
    supabase
      .from('posts')
      .select('*')
      .eq('published', true)
      .lt('published_at', publishedAt)
      .order('published_at', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('posts')
      .select('*')
      .eq('published', true)
      .gt('published_at', publishedAt)
      .order('published_at', { ascending: true })
      .limit(1)
      .single(),
  ])

  return { prev: prev ?? null, next: next ?? null }
}

// 删除 r2_key 不在给定列表中的所有记录（reindex 用于清理已删除文件）
export async function deletePostsNotIn(r2Keys: string[]): Promise<number> {
  if (r2Keys.length === 0) return 0

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('posts')
    .select('r2_key')

  if (fetchError) throw new Error(fetchError.message)

  const toDelete = (existing ?? [])
    .map((r: { r2_key: string }) => r.r2_key)
    .filter((k: string) => !r2Keys.includes(k))

  if (toDelete.length === 0) return 0

  const { data, error } = await supabaseAdmin
    .from('posts')
    .delete()
    .in('r2_key', toDelete)
    .select('id')

  if (error) throw new Error(error.message)
  return data?.length ?? 0
}

export const getPostsByCategory = unstable_cache(
  async function (category: string, limit = 20, offset = 0): Promise<Post[]> {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('published', true)
      .eq('category', category)
      .order('sticky', { ascending: false })
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw new Error(error.message)
    return data ?? []
  },
  ['posts-by-category'],
  { revalidate: 60, tags: ['posts'] }
)

export const getCategories = unstable_cache(
  async function (): Promise<{ name: string; count: number; slug: string }[]> {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('category')
        .eq('published', true)
        .not('category', 'is', null)

      if (error) throw new Error(error.message)

      const countMap = new Map<string, number>()
      for (const row of data ?? []) {
        const cat = row.category as string
        countMap.set(cat, (countMap.get(cat) ?? 0) + 1)
      }

      return Array.from(countMap.entries())
        .map(([name, count]) => ({ name, count, slug: encodeURIComponent(name) }))
        .sort((a, b) => b.count - a.count)
    } catch (error) {
      console.error('Failed to load categories from Supabase:', error)
      return []
    }
  },
  ['categories'],
  { revalidate: 3600, tags: ['categories'] }
)

export const getPostsByYear = unstable_cache(
  async function (year: number, limit = 50, offset = 0): Promise<Post[]> {
    const start = `${year}-01-01T00:00:00.000Z`
    const end = `${year + 1}-01-01T00:00:00.000Z`
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('published', true)
      .gte('published_at', start)
      .lt('published_at', end)
      .order('sticky', { ascending: false })
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw new Error(error.message)
    return data ?? []
  },
  ['posts-by-year'],
  { revalidate: 3600, tags: ['posts'] }
)

export const getYearArchive = unstable_cache(
  async function (): Promise<{ year: number; count: number }[]> {
    try {
      const currentYear = new Date().getFullYear()

      const { data, error } = await supabase
        .from('posts')
        .select('published_at')
        .eq('published', true)
        .not('published_at', 'is', null)
        .lt('published_at', `${currentYear}-01-01T00:00:00.000Z`)

      if (error) throw new Error(error.message)

      const yearMap = new Map<number, number>()
      for (const row of data ?? []) {
        const year = new Date(row.published_at as string).getFullYear()
        yearMap.set(year, (yearMap.get(year) ?? 0) + 1)
      }

      return Array.from(yearMap.entries())
        .map(([year, count]) => ({ year, count }))
        .sort((a, b) => b.year - a.year)
    } catch (error) {
      console.error('Failed to load year archive from Supabase:', error)
      return []
    }
  },
  ['year-archive'],
  { revalidate: 3600, tags: ['year-archive'] }
)

export const getAllTags = unstable_cache(
  async function (): Promise<{ tag: string; count: number }[]> {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('tags')
        .eq('published', true)

      if (error) throw new Error(error.message)

      const tagMap = new Map<string, number>()
      for (const row of data ?? []) {
        for (const tag of (row.tags as string[]) ?? []) {
          tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1)
        }
      }

      return Array.from(tagMap.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
    } catch (error) {
      console.error('Failed to load tags from Supabase:', error)
      return []
    }
  },
  ['all-tags'],
  { revalidate: 3600, tags: ['all-tags'] }
)

export const getSiteConfig = unstable_cache(
  async function (): Promise<Record<string, string>> {
    try {
      const { data, error } = await supabase
        .from('site_config')
        .select('key, value')

      if (error) throw new Error(error.message)
      return Object.fromEntries((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]))
    } catch (error) {
      console.error('Failed to load site config from Supabase:', error)
      return {}
    }
  },
  ['site-config'],
  { revalidate: 3600, tags: ['site-config'] }
)

export async function getCommentCount(postId: string): Promise<number> {
  const { count, error } = await supabase
    .from('comments')
    .select('*', { count: 'exact', head: true })
    .eq('target_type', 'blog_post')
    .eq('target_id', postId)
  if (error) return 0
  return count ?? 0
}

export const getCommentCounts = unstable_cache(
  async function (postIds: string[]): Promise<Record<string, number>> {
    if (postIds.length === 0) return {}
    const { data, error } = await supabase
      .from('comments')
      .select('target_id')
      .eq('target_type', 'blog_post')
      .in('target_id', postIds)
    if (error) throw new Error(error.message)
    const counts: Record<string, number> = {}
    for (const row of data ?? []) {
      const id = row.target_id as string
      counts[id] = (counts[id] ?? 0) + 1
    }
    return counts
  },
  ['comment-counts'],
  { revalidate: 30, tags: ['comments'] }
)

// 仅服务端（reindex 接口使用）
export async function getPostsMetadata(): Promise<{
  r2_key: string
  updated_at: string
  slug: string
  category: string | null
  tags: string[]
  published_at: string | null
  published: boolean
}[]> {
  const { data, error } = await supabaseAdmin
    .from('posts')
    .select('r2_key, updated_at, slug, category, tags, published_at, published')

  if (error) return []
  return data ?? []
}

// 仅服务端（reindex 接口使用）
export async function upsertSiteConfig(entries: Record<string, string>): Promise<void> {
  const rows = Object.entries(entries).map(([key, value]) => ({ key, value }))
  const { error } = await supabaseAdmin
    .from('site_config')
    .upsert(rows, { onConflict: 'key' })

  if (error) throw new Error(error.message)
}

// 仅服务端（reindex 接口使用）
export async function upsertPost(post: {
  slug: string
  title: string
  summary?: string
  tags?: string[]
  category?: string | null
  cover_image?: string | null
  r2_key: string
  search_content?: string
  published: boolean
  published_at?: string
  sticky?: number
  reading_minutes?: number
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from('posts')
    .upsert(
      {
        ...post,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'slug' }
    )

  if (error) throw new Error(error.message)
}

export async function searchPosts(
  query: string,
  page = 1,
  limit = 12,
): Promise<{ results: SearchPostResult[]; total: number; page: number; limit: number }> {
  const normalizedQuery = normalizeSearchQuery(query)

  if (normalizedQuery.length < SEARCH_MIN_QUERY_LENGTH) {
    return { results: [], total: 0, page, limit }
  }

  const safeLimit = Math.min(Math.max(limit, 1), 50)
  const safePage = Math.max(page, 1)
  const offset = (safePage - 1) * safeLimit

  const { data, error } = await supabaseAdmin.rpc('search_posts', {
    p_query: normalizedQuery,
    p_limit: safeLimit,
    p_offset: offset,
  })

  if (error) throw new Error(error.message)

  const rows = ((data ?? []) as SearchPostRow[])
  const total = rows[0]?.total_count ?? 0

  return {
    results: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      tags: row.tags ?? [],
      category: row.category,
      cover_image: row.cover_image,
      r2_key: row.r2_key,
      published: row.published,
      published_at: row.published_at,
      updated_at: row.updated_at,
      sticky: row.sticky,
      reading_minutes: row.reading_minutes ?? 0,
      rank: row.rank ?? 0,
      matched_fields: row.matched_fields ?? [],
      snippet: buildSearchSnippet(row.search_content || row.summary || row.title, normalizedQuery),
    })),
    total,
    page: safePage,
    limit: safeLimit,
  }
}
