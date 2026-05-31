import Link from 'next/link'
import Image from 'next/image'
import { memo, ViewTransition } from 'react'
import { Star } from 'lucide-react'
import type { Post } from '@/lib/blog'
import { formatBlogPublishedDate } from '@/lib/date-format'
import PrefetchOnHover from './PrefetchOnHover'
import PostCardStats from './PostCardStats'
import { CARD_SURFACE } from './cardSurface'

const MAX_VISIBLE_TAGS = 3

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
      className={`${CARD_SURFACE} overflow-hidden group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
      style={{
        contentVisibility: isEager ? 'visible' : 'auto',
        // auto 关键字: 浏览器在卡片首次渲染后记住真实尺寸，滚回时不再用估值重排，
        // 消除卡片滚入视口时的布局跳动；480px 也比旧的 400px 更接近真实卡片高度
        containIntrinsicSize: isEager ? undefined : 'auto 480px',
        scrollMarginTop: '6rem',
      }}
    >

      {/* ── Cover Image (Hero: Cover) ────────────────────────────────── */}
      <ViewTransition name={`post-cover-${post.id}`} share="morph" default="none">
        <div className="relative aspect-[2.4/1] w-full overflow-hidden bg-muted rounded-t-2xl">
          {post.sticky > 0 && (
            <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 dark:bg-black/90 backdrop-blur-md dark:backdrop-blur-none border border-black/5 dark:border-white/10 shadow-sm text-[10px] font-bold tracking-[0.1em] text-foreground/90 uppercase animate-in fade-in slide-in-from-top-1 duration-500 fill-mode-both">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-500" strokeWidth={2.5} />
              <span>PINNED</span>
            </div>
          )}
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
          {/* Hover depth: a bottom-up scrim fades in so the cover reads as lifting
              toward the viewer alongside the card's -translate-y. Pure CSS, inert. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-black/0 to-black/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          />
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

        {/* Hero: Meta (Date · Category · Stats · Tags) */}
        <ViewTransition name={`post-meta-${post.id}`} share="morph" default="none">
          <div className="blog-hero-meta flex flex-col gap-1.5 items-start">
            {/* Stats row: date · category · reading time · views */}
            <div className="flex flex-wrap items-center gap-x-1 gap-y-1 w-full">
              <time dateTime={post.published_at ?? ''} className="tabular-nums whitespace-nowrap">{date}</time>
              {post.category && (
                <><span className="text-foreground/20 font-bold">·</span><Link href={`/category/${encodeURIComponent(post.category)}`} className="relative z-10 hover:text-primary transition-colors whitespace-nowrap">{post.category}</Link></>
              )}
              <PostCardStats slug={post.slug} readingMinutes={post.reading_minutes ?? 1} />
            </div>
            {/* Tags row: mobile caps at MAX_VISIBLE_TAGS + overflow badge; desktop shows all */}
            {post.tags.length > 0 && (
              <div className="flex gap-1.5 items-center w-full">
                {post.tags.map((tag, i) => (
                  <Link
                    key={tag}
                    href={`/tag/${encodeURIComponent(tag)}`}
                    className={`relative z-10 px-2 py-0.5 rounded-md bg-muted text-[11px] text-foreground/65 hover:bg-muted-foreground hover:text-background transition-all whitespace-nowrap shrink-0${i >= MAX_VISIBLE_TAGS ? ' hidden md:block' : ''}`}
                  >
                    #{tag}
                  </Link>
                ))}
                {post.tags.length > MAX_VISIBLE_TAGS && (
                  <span className="md:hidden px-2 py-0.5 rounded-md bg-muted text-[11px] text-foreground/40 whitespace-nowrap shrink-0">
                    +{post.tags.length - MAX_VISIBLE_TAGS}
                  </span>
                )}
              </div>
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

