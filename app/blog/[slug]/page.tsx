import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Suspense, ViewTransition } from 'react'
import { getPosts, getPostMeta, getPostContent, getAdjacentPosts, type Post } from '@/lib/blog'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import CommentBox from '@/components/CommentBox'
import ArticleBackButton from '@/components/ArticleBackButton'
import CurrentArticleReturnTarget from '@/components/CurrentArticleReturnTarget'
import DirectionalTransition from '@/components/DirectionalTransition'
import { AuthorProfileCompactCard } from '@/components/AuthorProfileCard'
import TableOfContents from '@/components/TableOfContents'
import CategoriesCard from '@/components/CategoriesCard'
import RecentPostsCard from '@/components/RecentPostsCard'
import ToolsCard from '@/components/ToolsCard'
import ScrollCollapseWrapper from '@/components/ScrollHideWrapper'
import { formatBlogPublishedDate } from '@/lib/date-format'
import { supabaseAdmin } from '@/lib/supabase'
import ScrollToTop from '@/components/ScrollToTop'
import { getPostAnchorHref } from '@/lib/blog-return'

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return formatBlogPublishedDate(d)
}

export const revalidate = 60

export async function generateStaticParams() {
  const posts = await getPosts(1000, 0)
  return posts.map((p) => ({ slug: p.slug }))
}

type Comment = { id: string; author: string; content: string; created_at: string; updated_at: string | null; parent_id: string | null }

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
  skipFirstParagraph,
}: {
  contentPromise: Promise<string>
  adjacentPromise: Promise<{ prev: Post | null; next: Post | null }>
  commentsPromise: Promise<Comment[] | null>
  postId: string
  skipFirstParagraph?: boolean
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
        <MarkdownRenderer content={content} postId={postId} skipFirstParagraph={skipFirstParagraph} />
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
      .select('id, author, content, created_at, updated_at, parent_id')
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
      <div className="site-shell-triad py-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12 lg:grid-cols-[minmax(15rem,16rem)_minmax(0,48rem)_minmax(15rem,16rem)] lg:justify-center">
          {/* Left Sidebar Space - Matches Blog List Grid */}
          <aside className="hidden h-full md:block md:col-span-4 lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              <ScrollCollapseWrapper threshold={300}>
                <ViewTransition name="sidebar-author-card">
                  <AuthorProfileCompactCard id="sidebar" />
                </ViewTransition>
              </ScrollCollapseWrapper>
              <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-muted" />}>
                <TableOfContentsSection contentPromise={contentPromise} />
              </Suspense>
              <CategoriesCard activeCategory={post.category} />
            </div>
          </aside>

          {/* Main Article Content - Perfectly aligned with PostCard width */}
          <article className="min-w-0 md:col-span-8 lg:col-span-1 bg-card rounded-2xl md:rounded-3xl border border-border/50 shadow-[3px_5px_30px_rgba(0,0,0,0.08)] dark:shadow-none overflow-hidden h-fit">
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
                  className="relative aspect-[2.4/1] w-full overflow-hidden bg-muted border-b border-border/50 rounded-t-2xl md:rounded-t-3xl"
                >
                  {post.cover_image ? (
                    <Image
                      src={decodeURIComponent(post.cover_image)}
                      alt={post.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 66vw, 960px"
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
                  <ViewTransition name={`post-meta-${post.id}`} share="morph" default="none">
                    <div className="blog-hero-meta flex flex-wrap items-center gap-x-1.5 gap-y-2">
                      <time className="tabular-nums whitespace-nowrap">{formatDate(post.published_at)}</time>
                      {post.category && (
                        <><span className="text-foreground/20 font-bold">·</span><Link href={`/blog/category/${encodeURIComponent(post.category)}`} className="font-medium text-foreground/80 hover:text-primary transition-colors whitespace-nowrap">{post.category}</Link></>
                      )}
                      {post.tags.length > 0 && (
                        <><span className="text-foreground/20 font-bold">·</span><div className="flex flex-wrap gap-1.5 items-center">{post.tags.map((tag) => (<Link key={tag} href={`/blog/tags/${encodeURIComponent(tag)}`} className="px-2 py-0.5 rounded-md bg-muted text-[11px] text-foreground/65 hover:bg-muted-foreground hover:text-background transition-all">#{tag}</Link>))}</div></>
                      )}
                    </div>
                  </ViewTransition>

                  {/* Hero: Immediate First Paragraph (Transition Target) */}
                  {post.summary && (
                    <div className="mt-6 prose prose-gray dark:prose-invert max-w-none">
                      <ViewTransition name={`post-first-p-${post.id}`} share="morph" default="none">
                        <p>{post.summary}</p>
                      </ViewTransition>
                    </div>
                  )}
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
                    skipFirstParagraph={true}
                  />
                </Suspense>
              </ViewTransition>
            </div>
          </article>

          {/* Right Sidebar Space */}
          <aside className="hidden lg:block lg:col-span-1">
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
