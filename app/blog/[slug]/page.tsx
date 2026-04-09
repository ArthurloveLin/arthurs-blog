import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Suspense, unstable_ViewTransition as ViewTransition } from 'react'
import { getPosts, getPostMeta, getPostContent, getAdjacentPosts, type Post } from '@/lib/blog'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import CommentBox from '@/components/CommentBox'
import ArticleBackButton from '@/components/ArticleBackButton'
import CurrentArticleReturnTarget from '@/components/CurrentArticleReturnTarget'
import DirectionalTransition from '@/components/DirectionalTransition'
import AuthorProfileCard from '@/components/AuthorProfileCard'
import TableOfContents from '@/components/TableOfContents'
import CategoriesCard from '@/components/CategoriesCard'
import RecentPostsCard from '@/components/RecentPostsCard'
import ToolsCard from '@/components/ToolsCard'
import ScrollHideWrapper from '@/components/ScrollHideWrapper'
import { supabaseAdmin } from '@/lib/supabase'
import ScrollToTop from '@/components/ScrollToTop'
import { getPostAnchorHref } from '@/lib/blog-return'

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

type Comment = { id: string; author: string; content: string; created_at: string; parent_id: string | null }

// async-suspense-boundaries: inner Server Component for TOC — shares contentPromise
async function TableOfContentsSection({ contentPromise }: { contentPromise: Promise<string> }) {
  const content = await contentPromise
  return <TableOfContents content={content} />
}

// async-suspense-boundaries: inner Server Component for article body — streams in after meta shell
async function ArticleBody({
  contentPromise,
  adjacentPromise,
  commentsPromise,
  postId,
}: {
  contentPromise: Promise<string>
  adjacentPromise: Promise<{ prev: Post | null; next: Post | null }>
  commentsPromise: Promise<Comment[] | null>
  postId: string
}) {
  const [content, { prev, next }, initialComments] = await Promise.all([
    contentPromise,
    adjacentPromise,
    commentsPromise,
  ])

  return (
    <>
      {/* Content Body - Expanded padding for premium feel */}
      <div className="mt-10 px-6 md:px-10">
        <MarkdownRenderer content={content} />
      </div>

      {/* Comments */}
      <section className="mt-16 pt-10 border-t border-border px-6 md:px-10 pb-10">
        <CommentBox
          targetType="blog_post"
          targetId={postId}
          initialComments={initialComments ?? []}
        />
      </section>

      {/* Prev / Next navigation */}
      {(prev || next) && (
        <nav className="border-t border-border grid grid-cols-2 text-sm bg-muted/20 dark:bg-white/5">
          <div className="p-6 border-r border-border hover:bg-muted/30 transition-colors">
            {prev && (
              <Link href={`/blog/${prev.slug}`} className="group block text-left">
                <span className="text-xs text-muted-foreground font-mono uppercase tracking-widest">上一篇</span>
                <p className="mt-2 font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                  {prev.title}
                </p>
              </Link>
            )}
          </div>
          <div className="p-6 hover:bg-muted/30 transition-colors">
            {next && (
              <Link href={`/blog/${next.slug}`} className="group block text-right">
                <span className="text-xs text-muted-foreground font-mono uppercase tracking-widest">下一篇</span>
                <p className="mt-2 font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                  {next.title}
                </p>
              </Link>
            )}
          </div>
        </nav>
      )}
    </>
  )
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

  // 第二步：立即并发启动所有后续请求，但不 await——通过 Suspense 流式传输页面外壳与正文
  // async-suspense-boundaries: fire promises without blocking, share across Suspense children
  const contentPromise = getPostContent(post)
  const adjacentPromise = getAdjacentPosts(post.published_at!)
  const commentsPromise = Promise.resolve(
    supabaseAdmin
      .from('comments')
      .select('id, author, content, created_at, parent_id')
      .eq('target_type', 'blog_post')
      .eq('target_id', post.id)
      .order('created_at', { ascending: true })
      .then((r) => r.data as Comment[] | null)
  )

  return (
    <DirectionalTransition>
    <main className="min-h-screen bg-background">
      <CurrentArticleReturnTarget postId={post.id} postSlug={post.slug} />
      <ScrollToTop />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Sidebar Space - Matches Blog List Grid */}
          <aside className="hidden md:block md:col-span-4 lg:col-span-3 h-full">
            <div className="sticky top-24 space-y-4">
              <ScrollHideWrapper threshold={300}>
                <ViewTransition name="sidebar-author-card">
                  <AuthorProfileCard id="sidebar" compact />
                </ViewTransition>
              </ScrollHideWrapper>
              <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-muted" />}>
                <TableOfContentsSection contentPromise={contentPromise} />
              </Suspense>
              <CategoriesCard activeCategory={post.category} />
            </div>
          </aside>

          {/* Main Article Content - Perfectly aligned with PostCard width */}
          <article className="md:col-span-8 lg:col-span-6 bg-card rounded-2xl md:rounded-3xl border border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none overflow-hidden h-fit">
            {/* ── Outer padding for the whole article card content ── */}
            <div>
              {/* Hero Header (Synced with PostCard) */}
              <header className="relative">
                {/* Floating back button — keep it outside the shared cover snapshot.
                    Otherwise the detail snapshot becomes "cover + button" while the list snapshot
                    is only the cover, which degrades the shared-element morph into a cross-fade. */}
                <ArticleBackButton returnHref={getPostAnchorHref(post.id)} />

                {/* Hero: Cover - No rounded-2xl md:rounded-3xl here because it's at the top of an overflow-hidden card */}
                <ViewTransition name={`post-cover-${post.id}`} share="morph" default="none">
                <div
                  className="relative aspect-video w-full overflow-hidden bg-muted border-b border-border/50 rounded-t-2xl md:rounded-t-3xl"
                >
                  {post.cover_image ? (
                    <Image
                      src={decodeURIComponent(post.cover_image)}
                      alt={post.title}
                      fill
                      priority
                      className="object-cover"
                    />
                  ) : (
                    <div className="h-full w-full default-cover-bg" />
                  )}
                </div>
                </ViewTransition>

                {/* Hero Text Content - Padded to match PostCard Body padding (p-5 md:p-6) */}
                <div className="p-5 md:p-6">
                  {/* Hero: Title */}
                  <ViewTransition name={`post-title-${post.id}`} share="morph" default="none">
                    <h1 className="blog-hero-title mb-3">
                      {post.title}
                    </h1>
                  </ViewTransition>

                  {/* Hero: Meta (Date · Category · Tags) */}
                  <ViewTransition name={`post-meta-${post.id}`} default="none">
                    <div className="blog-hero-meta flex items-center gap-x-1">
                      <time className="tabular-nums whitespace-nowrap">{formatDate(post.published_at)}</time>
                      {post.category && (
                        <><span className="text-foreground/20 font-bold">·</span><Link href={`/blog/category/${encodeURIComponent(post.category)}`} className="font-medium text-foreground/80 hover:text-primary transition-colors whitespace-nowrap">{post.category}</Link></>
                      )}
                      {post.tags.length > 0 && (
                        <><span className="text-foreground/20 font-bold">·</span><div className="flex flex-wrap gap-1.5 items-center">{post.tags.map((tag) => (<Link key={tag} href={`/blog/tags/${encodeURIComponent(tag)}`} className="px-2 py-0.5 rounded-md bg-muted text-[11px] text-muted-foreground hover:bg-foreground hover:text-background transition-all">#{tag}</Link>))}</div></>
                      )}
                    </div>
                  </ViewTransition>
                </div>
              </header>

              {/* Article body streams in while header shows immediately */}
              {/* async-suspense-boundaries: content + comments + nav are Suspense-deferred */}
              {/* Article body: we wrap the whole Suspense in the body transition name
                  to keep the layout stable and animate content entrance smoothly */}
              <ViewTransition name="article-body" default="none">
                <Suspense
                  fallback={
                    <div className="mt-10 px-6 md:px-10 pb-10 space-y-3">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className={`h-4 animate-pulse rounded bg-muted ${i === 7 ? 'w-3/4' : 'w-full'}`} />
                      ))}
                    </div>
                  }
                >
                  <ArticleBody
                    contentPromise={contentPromise}
                    adjacentPromise={adjacentPromise}
                    commentsPromise={commentsPromise}
                    postId={post.id}
                  />
                </Suspense>
              </ViewTransition>
            </div>
          </article>

          {/* Right Sidebar Space */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-24 space-y-4">
              <RecentPostsCard />
              <ToolsCard />
            </div>
          </aside>
        </div>
      </div>
    </main>
    </DirectionalTransition>
  )
}
