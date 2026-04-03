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
  const processedContent = BLOG_PUBLIC_DOMAIN
    ? content.replace(/!\[\[(.+?)\]\]/g, `![](https://${BLOG_PUBLIC_DOMAIN}/$1)`)
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

  const { data, error } = await supabaseAdmin
    .from('posts')
    .delete()
    .not('r2_key', 'in', `(${r2Keys.map((k) => `"${k}"`).join(',')})`)
    .select('id')

  if (error) throw new Error(error.message)
  return data?.length ?? 0
}

// 仅服务端（reindex 接口使用）
export async function upsertPost(post: {
  slug: string
  title: string
  summary?: string
  tags?: string[]
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
