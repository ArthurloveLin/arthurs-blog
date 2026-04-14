import Link from 'next/link'
import Image from 'next/image'
import { memo, ViewTransition } from 'react'
import type { Post } from '@/lib/blog'
import { formatBlogPublishedDate } from '@/lib/date-format'
import PrefetchOnHover from './PrefetchOnHover'

// Removed hardcoded gradient array as we now use the theme's primary gradient

interface PostCardProps {
  post: Post
  index?: number
}

type PostCardRenderMode = 'auto' | 'eager'

interface PostCardContentProps extends PostCardProps {
  renderMode: PostCardRenderMode
}

const PostCardContent = memo(function PostCardContent({ post, index = 0, renderMode }: PostCardContentProps) {
  const date = post.published_at ? formatBlogPublishedDate(post.published_at) : ''
  const isEager = renderMode === 'eager'

  // 解码一次，避免 DB 中已编码的 URL（如 %7B）被 next/image 二次编码成 %257B
  const coverSrc = post.cover_image ? decodeURIComponent(post.cover_image) : null

  return (
    <PrefetchOnHover
      href={`/blog/${post.slug}`}
      id={`post-${post.id}`}
      className="bg-card text-card-foreground border border-border/50 dark:border-white/10 rounded-2xl shadow-[3px_5px_30px_rgba(0,0,0,0.08)] dark:shadow-none transition duration-300 hover:-translate-y-1 hover:shadow-[3px_8px_36px_rgba(0,0,0,0.12)] dark:hover:border-white/20 overflow-hidden group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{
        contentVisibility: isEager ? 'visible' : 'auto',
        containIntrinsicSize: isEager ? undefined : '0 400px',
        scrollMarginTop: '6rem',
      }}
    >

      {/* ── Cover Image (Hero: Cover) ────────────────────────────────── */}
      <ViewTransition name={`post-cover-${post.id}`} share="morph" default="none">
        <div className="relative aspect-[2.4/1] w-full overflow-hidden bg-muted rounded-t-2xl">
          {coverSrc ? (
            <Image
              src={coverSrc}
              alt={post.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              priority={index === 0}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full default-cover-bg transition-transform duration-500 group-hover:scale-105" />
          )}
        </div>
      </ViewTransition>

      {/* ── Body ───────────────────────────────────────────────────── */}
      <div className="p-5 md:p-6 pb-6">

        {/* Hero: Title */}
        <ViewTransition name={`post-title-${post.id}`} share="morph" default="none">
          <h2 className="blog-hero-title mb-3 leading-tight group-hover:text-primary transition-colors duration-200">
            <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0">
              {post.title}
            </Link>
          </h2>
        </ViewTransition>

        {/* Excerpt */}
        {post.summary && (
          <ViewTransition name={`post-first-p-${post.id}`} share="morph" default="none">
            <p className="text-foreground/80 dark:text-foreground/75 text-base line-clamp-3 leading-relaxed mb-5 font-normal">
              {post.summary}
            </p>
          </ViewTransition>
        )}

        {/* Hero: Meta (Date · Category · Tags) */}
        <ViewTransition name={`post-meta-${post.id}`} share="morph" default="none">
          <div className="blog-hero-meta flex items-center gap-x-1">
          <time dateTime={post.published_at ?? ''} className="tabular-nums whitespace-nowrap">{date}</time>
          {post.category && (
            <><span className="text-foreground/20 font-bold">·</span><Link href={`/blog/category/${encodeURIComponent(post.category)}`} className="relative z-10 hover:text-primary transition-colors whitespace-nowrap">{post.category}</Link></>
          )}
          {post.tags.length > 0 && (
            <><span className="text-foreground/20 font-bold">·</span><div className="flex flex-wrap gap-1.5 items-center">{post.tags.map((tag, i) => (<Link key={tag} href={`/blog/tags/${encodeURIComponent(tag)}`} className={`relative z-10 px-2 py-0.5 rounded-md bg-muted text-[11px] text-foreground/65 hover:bg-muted-foreground hover:text-background transition-all ${i >= 2 ? 'hidden md:inline-block' : ''}`}>#{tag}</Link>))}</div></>
          )}
          </div>
        </ViewTransition>
      </div>

    </PrefetchOnHover>
  )
})

const PostCard = memo(function PostCard(props: PostCardProps) {
  return <PostCardContent {...props} renderMode="auto" />
})

export const EagerPostCard = memo(function EagerPostCard(props: PostCardProps) {
  return <PostCardContent {...props} renderMode="eager" />
})

export default PostCard

