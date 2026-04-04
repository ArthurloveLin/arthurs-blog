import matter from 'gray-matter'
import { supabase, supabaseAdmin } from './supabase'
import { getR2Object } from './r2'

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
}

export async function getPosts(limit = 20, offset = 0): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('published', true)
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getPostsCount(): Promise<number> {
  const { count, error } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('published', true)
  if (error) return 0
  return count ?? 0
}

export async function getPostsByTag(tag: string, limit = 20, offset = 0): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('published', true)
    .contains('tags', [tag])
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getPostsByTags(tags: string[], limit = 20, offset = 0): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('published', true)
    .contains('tags', tags)
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getPostBySlug(slug: string): Promise<{ post: Post; content: string } | null> {
  const { data: post, error } = await supabase
    .from('posts')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .single()

  if (error || !post) return null

  const raw = await getR2Object(BLOG_BUCKET, post.r2_key)
  const { content } = matter(raw)

  // 将 Obsidian 附件引用替换为 R2 公开域名 URL
  // ![[Pasted image xxx.png|750]] → ![](https://domain/path/to/images/Pasted image xxx.png)
  const noteDir = post.r2_key.includes('/')
    ? post.r2_key.split('/').slice(0, -1).join('/') + '/'
    : ''
  const processedContent = BLOG_PUBLIC_DOMAIN
    ? content.replace(
        /!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g,
        (_, filename: string) =>
          `![](https://${BLOG_PUBLIC_DOMAIN}/${noteDir}images/${encodeURIComponent(filename.trim())})`
      )
    : content

  return { post, content: processedContent }
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
    .map((r) => r.r2_key as string)
    .filter((k) => !r2Keys.includes(k))

  if (toDelete.length === 0) return 0

  const { data, error } = await supabaseAdmin
    .from('posts')
    .delete()
    .in('r2_key', toDelete)
    .select('id')

  if (error) throw new Error(error.message)
  return data?.length ?? 0
}

export async function getPostsByCategory(category: string, limit = 20, offset = 0): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('published', true)
    .eq('category', category)
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getCategories(): Promise<{ name: string; count: number; slug: string }[]> {
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
}

export async function getPostsByYear(year: number, limit = 50, offset = 0): Promise<Post[]> {
  const start = `${year}-01-01T00:00:00.000Z`
  const end = `${year + 1}-01-01T00:00:00.000Z`
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('published', true)
    .gte('published_at', start)
    .lt('published_at', end)
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getYearArchive(): Promise<{ year: number; count: number }[]> {
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
}

export async function getAllTags(): Promise<{ tag: string; count: number }[]> {
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
}

export async function getSiteConfig(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('site_config')
    .select('key, value')

  if (error) return {}
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
}

export async function getCommentCount(postId: string): Promise<number> {
  const { count, error } = await supabase
    .from('comments')
    .select('*', { count: 'exact', head: true })
    .eq('target_type', 'blog_post')
    .eq('target_id', postId)
  if (error) return 0
  return count ?? 0
}

export async function getCommentCounts(postIds: string[]): Promise<Record<string, number>> {
  if (postIds.length === 0) return {}
  const { data, error } = await supabase
    .from('comments')
    .select('target_id')
    .eq('target_type', 'blog_post')
    .in('target_id', postIds)
  if (error) return {}
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const id = row.target_id as string
    counts[id] = (counts[id] ?? 0) + 1
  }
  return counts
}

// 仅服务端（reindex 接口使用）
export async function getPostsMetadata(): Promise<{ r2_key: string; updated_at: string }[]> {
  const { data, error } = await supabaseAdmin
    .from('posts')
    .select('r2_key, updated_at')

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
  published: boolean
  published_at?: string
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
