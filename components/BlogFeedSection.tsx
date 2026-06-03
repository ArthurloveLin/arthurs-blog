'use client'

import Link from 'next/link'
import gsap from 'gsap'
import { ViewTransition, useState, useEffect, useLayoutEffect, useRef } from 'react'
import type { Post } from '@/lib/blog'
import PostCard, { EagerPostCard } from '@/components/PostCard'
import AdminOnly from '@/components/AdminOnly'
import ReindexButton from '@/components/ReindexButton'
import { BLOG_RETURN_PATHNAME_KEY, BLOG_RETURN_POST_SLUG_KEY } from '@/lib/blog-return'

interface BlogFeedSectionProps {
  posts: Post[]
  fetchError?: boolean
  activeCategory?: string | null
  activeTags?: string[]
  activeYear?: number | null
}

function getInitialReturningPostSlug() {
  if (typeof window === 'undefined') return null
  const storedPathname = sessionStorage.getItem(BLOG_RETURN_PATHNAME_KEY)
  const storedPostSlug = sessionStorage.getItem(BLOG_RETURN_POST_SLUG_KEY)
  if (storedPathname !== window.location.pathname || !storedPostSlug) return null
  return storedPostSlug
}

function useReturningPost() {
  const [returningPostSlug, setReturningPostSlug] = useState<string | null>(getInitialReturningPostSlug)

  useEffect(() => {
    if (!returningPostSlug) {
      sessionStorage.removeItem(BLOG_RETURN_PATHNAME_KEY)
      sessionStorage.removeItem(BLOG_RETURN_POST_SLUG_KEY)
      return
    }
    const clear = window.setTimeout(() => {
      setReturningPostSlug(null)
      sessionStorage.removeItem(BLOG_RETURN_PATHNAME_KEY)
      sessionStorage.removeItem(BLOG_RETURN_POST_SLUG_KEY)
    }, 1200)
    return () => window.clearTimeout(clear)
  }, [returningPostSlug])

  return returningPostSlug
}

function getPostCardComponent(isReturningPost: boolean) {
  return isReturningPost ? EagerPostCard : PostCard
}

export default function BlogFeedSection({
  posts,
  fetchError = false,
  activeCategory = null,
  activeTags = [],
  activeYear = null,
}: BlogFeedSectionProps) {
  const returningPostSlug = useReturningPost()
  // Stable ref so the GSAP effects can read the latest returning slug without
  // it appearing in their dependency arrays (which would re-trigger the animation
  // when the slug is cleared after 1200 ms).  Updated in a useEffect so the
  // update doesn't happen during render (react-hooks/refs).
  const returningPostSlugRef = useRef(returningPostSlug)
  useEffect(() => {
    returningPostSlugRef.current = returningPostSlug
  })

  const gridRef = useRef<HTMLDivElement>(null)

  // Set initial hidden state synchronously before first paint so cards don't
  // flash visible before GSAP animates them in.  We skip the card that is
  // already being morphed back by ViewTransition.
  useLayoutEffect(() => {
    if (!gridRef.current || posts.length === 0) return
    const cards = Array.from(gridRef.current.querySelectorAll('article'))
    const returningSlug = returningPostSlugRef.current
    const targets = returningSlug
      ? cards.filter((el) => el.id !== `post-${returningSlug}`)
      : cards
    if (targets.length === 0) return
    gsap.set(targets, { opacity: 0, y: 28, scale: 0.97 })
  }, [posts])

  // Stagger cards into view after the DOM settles.
  useEffect(() => {
    if (!gridRef.current || posts.length === 0) return
    const cards = Array.from(gridRef.current.querySelectorAll('article'))
    const returningSlug = returningPostSlugRef.current
    const targets = returningSlug
      ? cards.filter((el) => el.id !== `post-${returningSlug}`)
      : cards
    if (targets.length === 0) return

    const mm = gsap.matchMedia()
    mm.add(
      {
        reduceMotion: '(prefers-reduced-motion: reduce)',
        fullMotion: '(prefers-reduced-motion: no-preference)',
      },
      (ctx) => {
        const { reduceMotion } = ctx.conditions as { reduceMotion: boolean; fullMotion: boolean }
        const tween = gsap.to(targets, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: reduceMotion ? 0.15 : 0.52,
          stagger: reduceMotion ? 0 : 0.07,
          ease: 'power3.out',
          clearProps: 'opacity,transform',
        })
        return () => { tween.kill() }
      },
    )
    return () => { mm.revert() }
  }, [posts])

  return (
    <section className="min-w-0 md:col-span-8 lg:col-span-1">
      {/* Feed header / Category filter banner */}
      <div className="flex items-center justify-between mb-5 px-4 py-3 rounded-xl bg-card border border-border/60 dark:border-white/10 shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-none">
        {activeCategory || activeTags.length > 0 || activeYear ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
              {activeCategory ? '分类' : activeTags.length > 0 ? '标签' : '归档'}
            </span>
            <span className="text-sm font-medium text-foreground">
              {activeCategory ?? (activeTags.length > 0 ? activeTags.join(' + ') : `${activeYear} 年`)}
            </span>
            <span className="text-xs text-muted-foreground">· 共 {posts.length} 篇</span>
            <Link
              href="/"
              className="ml-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ✕
            </Link>
          </div>
        ) : (
          <span className="font-mono text-[11px] tracking-[0.15em] text-muted-foreground uppercase">
            {posts.length > 0 ? `${posts.length} 篇文章` : '文章'}
          </span>
        )}
        <AdminOnly>
          <ReindexButton />
        </AdminOnly>
      </div>

      {/* Empty / error state */}
      {posts.length === 0 && (
        <div className="py-24 flex flex-col items-center gap-2">
          <span className="font-mono text-xs text-zinc-300 dark:text-zinc-700">
            {fetchError ? '— 加载失败 —' : '— 暂无文章 —'}
          </span>
          <span className="text-xs text-muted-foreground">
            {fetchError
              ? '数据库连接异常，请刷新重试'
              : activeCategory
              ? '该分类下暂无文章'
              : activeTags.length > 0
              ? '该标签下暂无文章'
              : activeYear
              ? `${activeYear} 年暂无归档文章`
              : '点击同步按钮获取最新内容'}
          </span>
        </div>
      )}

      {/* Post cards */}
      {posts.length > 0 && (
        <div ref={gridRef} className="space-y-6">
          {posts.map((post, index) => {
            const CardComponent = getPostCardComponent(returningPostSlug === post.slug)

            return (
              // default="none": the card container itself must not cross-fade.
              // On navigation only the inner post-cover/title/meta shared morphs
              // (and revalidations/Suspense resolves) should animate — letting the
              // outer VT auto-fade would make ~20 cards flicker around the morph.
              <ViewTransition key={post.id} default="none">
                <CardComponent post={post} index={index} />
              </ViewTransition>
            )
          })}
        </div>
      )}
    </section>
  )
}
