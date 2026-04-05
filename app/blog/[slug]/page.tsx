import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPosts, getPostMeta, getPostContent, getAdjacentPosts } from '@/lib/blog'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import CommentBox from '@/components/CommentBox'
import { supabaseAdmin } from '@/lib/supabase'

export const revalidate = 60

export async function generateStaticParams() {
  const posts = await getPosts(1000, 0)
  return posts.map((p) => ({ slug: p.slug }))
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const date = d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  return time === '00:00' ? date : `${date} ${time}`
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // 第一步：只查 Supabase 元数据（快，~100ms）
  const post = await getPostMeta(slug)
  if (!post) notFound()

  // 第二步：拿到 post.id / published_at 后，立即并发启动 R2 拉取 + 相邻文章 + 评论
  const [content, { prev, next }, { data: initialComments }] = await Promise.all([
    getPostContent(post),
    getAdjacentPosts(post.published_at!),
    supabaseAdmin
      .from('comments')
      .select('id, author, content, created_at, parent_id')
      .eq('target_type', 'blog_post')
      .eq('target_id', post.id)
      .order('created_at', { ascending: true }),
  ])

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      {/* Back */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        ← 返回
      </Link>

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground leading-tight">{post.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <time className="text-sm text-muted-foreground">{formatDate(post.published_at)}</time>
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/blog/tags/${encodeURIComponent(tag)}`}
                  className="text-xs px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground hover:bg-foreground hover:text-background transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <MarkdownRenderer content={content} />

      {/* Comments */}
      <section className="mt-12 pt-8 border-t border-border">
        <CommentBox
          targetType="blog_post"
          targetId={post.id}
          initialComments={initialComments ?? []}
        />
      </section>

      {/* Prev / Next navigation */}
      {(prev || next) && (
        <nav className="mt-12 pt-8 border-t border-border grid grid-cols-2 gap-4">
          <div>
            {prev && (
              <Link href={`/blog/${prev.slug}`} className="group block text-left">
                <span className="text-xs text-muted-foreground">上一篇</span>
                <p className="mt-1 text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
                  {prev.title}
                </p>
              </Link>
            )}
          </div>
          <div>
            {next && (
              <Link href={`/blog/${next.slug}`} className="group block text-right">
                <span className="text-xs text-muted-foreground">下一篇</span>
                <p className="mt-1 text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
                  {next.title}
                </p>
              </Link>
            )}
          </div>
        </nav>
      )}
    </main>
  )
}
