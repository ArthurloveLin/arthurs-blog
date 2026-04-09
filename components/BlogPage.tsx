'use client'
import Link from 'next/link'
import { unstable_ViewTransition as ViewTransition, useEffect, useRef, useState } from 'react'
import type { Post } from '@/lib/blog'
import { useSiteData } from '@/components/SiteDataProvider'

import PostCard from '@/components/PostCard'
import AuthorProfileCard from '@/components/AuthorProfileCard'
import CategoriesCard from '@/components/CategoriesCard'
import TagsCloudCard from '@/components/TagsCloudCard'
import RecentPostsCard from '@/components/RecentPostsCard'
import ArchiveCard from '@/components/ArchiveCard'
import ToolsCard from '@/components/ToolsCard'
import AdminOnly from '@/components/AdminOnly'
import ReindexButton from '@/components/ReindexButton'
import DirectionalTransition from '@/components/DirectionalTransition'
import ScrollRestorer from '@/components/ScrollRestorer'
import ScrollHideWrapper from '@/components/ScrollHideWrapper'
import dynamic from 'next/dynamic'

const Live2D = dynamic(() => import('@/components/Live2D'), { 
  ssr: false,
  loading: () => <div className="h-40 w-40" /> // Basic placeholder to avoid layout shift if needed
})

interface BlogPageProps {
  posts: Post[]
  fetchError?: boolean
  activeCategory?: string | null
  activeTags?: string[]
  activeYear?: number | null
}

function getInitialReturningPostSlug() {
  if (typeof window === 'undefined') return null

  const storedPathname = sessionStorage.getItem('blog-return:pathname')
  const storedPostSlug = sessionStorage.getItem('blog-return:post-slug')

  if (storedPathname !== window.location.pathname || !storedPostSlug) {
    return null
  }

  return storedPostSlug
}

export default function BlogPage({
  posts,
  fetchError = false,
  activeCategory = null,
  activeTags = [],
  activeYear = null,
}: BlogPageProps) {
  const { config: siteConfig } = useSiteData()
  const leftSidebarRef = useRef<HTMLDivElement>(null)
  const rightSidebarRef = useRef<HTMLDivElement>(null)
  const [returningPostSlug, setReturningPostSlug] = useState<string | null>(getInitialReturningPostSlug)

  useEffect(() => {
    const handleScroll = () => {
      // 当 window 滚动回顶部时，同步复位侧边栏内部滚动
      if (window.scrollY === 0) {
        leftSidebarRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
        rightSidebarRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!returningPostSlug) {
      sessionStorage.removeItem('blog-return:pathname')
      sessionStorage.removeItem('blog-return:post-slug')
      return
    }

    const clear = window.setTimeout(() => {
      setReturningPostSlug(null)
      sessionStorage.removeItem('blog-return:pathname')
      sessionStorage.removeItem('blog-return:post-slug')
    }, 1200)

    return () => window.clearTimeout(clear)
  }, [returningPostSlug])

  return (
    <DirectionalTransition>
    <ScrollRestorer />
    <main className="min-h-screen bg-background">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="relative border-b border-border bg-background overflow-hidden">
        {/* Blob Ornaments */}
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-blob-1 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob dark:mix-blend-screen pointer-events-none"></div>
        <div className="absolute -top-10 right-1/4 w-72 h-72 bg-blob-2 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000 dark:mix-blend-screen pointer-events-none"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-12 lg:pt-20 lg:pb-16 z-10">
          <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase mb-5">
            {siteConfig.site_subtitle || "Arthur & Grace · Journal"}
          </p>
          <h1 className="text-[2rem] lg:text-[2.5rem] font-semibold tracking-tight leading-[1.2] text-foreground max-w-lg">
            <span className="block sm:inline text-gradient-primary">{siteConfig.site_title_highlight || "技术、生活与创意"}</span>
            {siteConfig.site_title_highlight_2 && (
              <>
                <br className="hidden sm:block" />
                <span className="block sm:inline text-gradient-primary">{siteConfig.site_title_highlight_2}</span>
              </>
            )}
            <br className="hidden sm:block" />
            <span className="block sm:inline">{siteConfig.site_title_rest || "的记录与分享"}</span>
          </h1>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-sm">
            {siteConfig.site_description || "探索编程、设计、LifeLens 智能评价等领域的见解与思考。记录成长，分享知识，连接彼此。"}
          </p>
          
          <Live2D />
        </div>
      </div>

      {/* ── 3-Column Body ────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

          {/* ── Left Sidebar ─────────────────────────────────────────── */}
          {/* Desktop: col-span-3 | Tablet: col-span-4 | Mobile: hidden */}
          <aside className="hidden md:block md:col-span-4 lg:col-span-3">
            <div 
              ref={leftSidebarRef}
              className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-none overscroll-contain pb-12 space-y-4"
            >
              <ScrollHideWrapper threshold={300} vanish={false}>
                {(isTriggered) => (
                  <ViewTransition name="sidebar-author-card">
                    <AuthorProfileCard id="sidebar" compact={isTriggered} />
                  </ViewTransition>
                )}
              </ScrollHideWrapper>
              <CategoriesCard activeCategory={activeCategory} />
              <TagsCloudCard activeTags={activeTags} />
            </div>
          </aside>

          {/* ── Main Feed ────────────────────────────────────────────── */}
          {/* Desktop: col-span-6 | Tablet: col-span-8 | Mobile: full */}
          <section className="md:col-span-8 lg:col-span-6">
            {/* Feed header / Category filter banner */}
            <div className="flex items-center justify-between mb-5 px-4 py-3 rounded-xl bg-card border border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
              {activeCategory || activeTags.length > 0 || activeYear ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
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
              <div className="space-y-6">
                {posts.map((post, index) => (
                  <ViewTransition key={post.id}>
                    <PostCard post={post} index={index} forceRender={returningPostSlug === post.slug} />
                  </ViewTransition>
                ))}
              </div>
            )}
          </section>

          {/* ── Right Sidebar ─────────────────────────────────────────── */}
          {/* Desktop only: col-span-3 | Tablet + Mobile: hidden */}
          <aside className="hidden lg:block lg:col-span-3">
            <div 
              ref={rightSidebarRef}
              className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-none overscroll-contain pb-12 space-y-4"
            >
              <RecentPostsCard />
              <ToolsCard />
              <ArchiveCard activeYear={activeYear} />
            </div>
          </aside>

        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-border mt-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-mono text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} Arthur &amp; Grace
          </p>
          <nav className="lg:hidden flex items-center gap-5 font-mono text-[11px] text-muted-foreground">
            <Link href="/wardrobe" className="hover:text-foreground transition-colors">
              LifeLens
            </Link>
            <a
              href="https://trendradar.arthurlovegrace.top"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              News
            </a>
          </nav>
        </div>
      </footer>

    </main>
    </DirectionalTransition>
  )
}
