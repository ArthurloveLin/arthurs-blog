import Link from 'next/link'
import Image from 'next/image'
import { memo, unstable_ViewTransition as ViewTransition } from 'react'
import type { Post } from '@/lib/blog'
import PrefetchOnHover from './PrefetchOnHover'

// Removed hardcoded gradient array as we now use the theme's primary gradient

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

interface PostCardProps {
  post: Post
  index?: number
}

const PostCard = memo(function PostCard({ post, index = 0 }: PostCardProps) {
  const date = formatDate(post.published_at)

  // 解码一次，避免 DB 中已编码的 URL（如 %7B）被 next/image 二次编码成 %257B
  const coverSrc = post.cover_image ? decodeURIComponent(post.cover_image) : null
  // obsidian 自建服务响应慢，跳过服务端代理让浏览器直连；同时解决 {} 文件名问题
  const unoptimized = coverSrc?.includes('obsidian.arthurlovegrace.top') ?? false

  return (
    <PrefetchOnHover
      href={`/blog/${post.slug}`}
      className="bg-card text-card-foreground border border-border/50 dark:border-white/10 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none transition duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:border-white/20 overflow-hidden group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: '0 400px', // Estimates the height of the card
      }}
    >

      {/* ── Cover Image (Hero: Cover) ────────────────────────────────── */}
      <ViewTransition name={`post-cover-${post.id}`} share="morph" default="none">
        <div className="relative aspect-video w-full overflow-hidden bg-muted rounded-t-2xl">
          {coverSrc ? (
            <Image
              src={coverSrc}
              alt={post.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              priority={index === 0}
              unoptimized={unoptimized}
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

        {/* Hero: Meta (Date · Category · Tags) */}
        <ViewTransition name={`post-meta-${post.id}`} default="none">
          <div className="blog-hero-meta mb-4 flex items-center gap-x-1">
          <time dateTime={post.published_at ?? ''} className="tabular-nums whitespace-nowrap">{date}</time>
          {post.category && (
            <><span className="text-foreground/20 font-bold">·</span><Link href={`/blog/category/${encodeURIComponent(post.category)}`} className="relative z-10 hover:text-primary transition-colors whitespace-nowrap">{post.category}</Link></>
          )}
          {post.tags.length > 0 && (
            <><span className="text-foreground/20 font-bold">·</span><div className="flex flex-wrap gap-1 items-center">{post.tags.slice(0, 2).map((tag) => (<Link key={tag} href={`/blog/tags/${encodeURIComponent(tag)}`} className="relative z-10 px-1.5 py-0.5 rounded-md bg-muted text-[10px] text-muted-foreground hover:bg-muted-foreground hover:text-background transition-all">#{tag}</Link>))}</div></>
          )}
          </div>
        </ViewTransition>

        {/* Excerpt */}
        {post.summary && (
          <p className="text-muted-foreground text-sm line-clamp-2 leading-relaxed opacity-70">
            {post.summary}
          </p>
        )}
      </div>

    </PrefetchOnHover>
  )
})

export default PostCard

