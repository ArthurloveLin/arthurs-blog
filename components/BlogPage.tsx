'use client'
import Link from 'next/link'
import { ViewTransition, useEffect, useRef, useState } from 'react'
import type { Post } from '@/lib/blog'

import AuthorProfileCard, { AuthorProfileCardContent } from '@/components/AuthorProfileCard'
import CategoriesCard from '@/components/CategoriesCard'
import TagsCloudCard from '@/components/TagsCloudCard'
import RecentPostsCard from '@/components/RecentPostsCard'
import ArchiveCard from '@/components/ArchiveCard'
import ToolsCard from '@/components/ToolsCard'
import DirectionalTransition from '@/components/DirectionalTransition'
import ScrollRestorer from '@/components/ScrollRestorer'
import { ScrollStateWrapper } from '@/components/ScrollHideWrapper'
import BlogHero from '@/components/BlogHero'
import BlogFeedSection from '@/components/BlogFeedSection'
import { BLOG_RETURN_PATHNAME_KEY, BLOG_RETURN_POST_SLUG_KEY } from '@/lib/blog-return'

interface BlogPageProps {
  posts: Post[]
  currentYear: number
  fetchError?: boolean
  activeCategory?: string | null
  activeTags?: string[]
  activeYear?: number | null
}

function getInitialReturningPostSlug() {
  if (typeof window === 'undefined') return null

  const storedPathname = sessionStorage.getItem(BLOG_RETURN_PATHNAME_KEY)
  const storedPostSlug = sessionStorage.getItem(BLOG_RETURN_POST_SLUG_KEY)

  if (storedPathname !== window.location.pathname || !storedPostSlug) {
    return null
  }

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

export default function BlogPage({
  posts,
  currentYear,
  fetchError = false,
  activeCategory = null,
  activeTags = [],
  activeYear = null,
}: BlogPageProps) {
  const leftSidebarRef = useRef<HTMLDivElement>(null)
  const rightSidebarRef = useRef<HTMLDivElement>(null)
  const returningPostSlug = useReturningPost()

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY === 0) {
        leftSidebarRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
        rightSidebarRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <DirectionalTransition>
    <ScrollRestorer />
    <main className="min-h-screen bg-background">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <BlogHero />

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
              <ScrollStateWrapper threshold={300}>
                {(isTriggered) => (
                  <ViewTransition name="sidebar-author-card">
                    <AuthorProfileCardContent id="sidebar" variant={isTriggered ? 'compact' : 'full'} />
                  </ViewTransition>
                )}
              </ScrollStateWrapper>
              <CategoriesCard activeCategory={activeCategory} />
              <TagsCloudCard activeTags={activeTags} />
            </div>
          </aside>

          {/* ── Main Feed ────────────────────────────────────────────── */}
          {/* Desktop: col-span-6 | Tablet: col-span-8 | Mobile: full */}
          <BlogFeedSection
            posts={posts}
            returningPostSlug={returningPostSlug}
            fetchError={fetchError}
            activeCategory={activeCategory}
            activeTags={activeTags}
            activeYear={activeYear}
          />

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
            © {currentYear} Arthur &amp; Grace
          </p>
          <nav className="lg:hidden flex items-center gap-5 font-mono text-[11px] text-muted-foreground">
            <Link href="/wardrobe" className="hover:text-foreground transition-colors">
              Life Lens
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
