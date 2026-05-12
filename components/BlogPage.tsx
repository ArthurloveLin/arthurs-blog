import Link from 'next/link'
import { Suspense } from 'react'
import type { Post } from '@/lib/blog'

import DirectionalTransition from '@/components/DirectionalTransition'
import ScrollRestorer from '@/components/ScrollRestorer'
import BlogHero from '@/components/BlogHero'
import BlogFeedSection from '@/components/BlogFeedSection'
import BlogFeedLoader from '@/components/BlogFeedLoader'
import BlogFeedSkeleton from '@/components/BlogFeedSkeleton'
import BlogSidebarLeft from '@/components/BlogSidebarLeft'
import BlogSidebarRight from '@/components/BlogSidebarRight'
import { getNoteBoardConfig, type NoteBoardViewConfig } from '@/lib/note-board-config'
import type { NoteMessage } from '@/lib/note-boards'

interface BlogPageProps {
  posts?: Post[]
  currentYear: number
  fetchError?: boolean
  activeCategory?: string | null
  activeTags?: string[]
  activeYear?: number | null
  initialGuestbookMessages?: NoteMessage[]
  guestbookBoard?: NoteBoardViewConfig
  slogan?: { text1: string; text2?: string }
}

export default function BlogPage({
  posts,
  currentYear,
  fetchError = false,
  activeCategory = null,
  activeTags = [],
  activeYear = null,
  initialGuestbookMessages = [],
  guestbookBoard = getNoteBoardConfig('guestbook'),
  slogan,
}: BlogPageProps) {
  return (
    <DirectionalTransition>
    <ScrollRestorer />
    <main className="min-h-screen bg-background">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <BlogHero guestbookBoard={guestbookBoard} initialGuestbookMessages={initialGuestbookMessages} slogan={slogan} />

      {/* ── 3-Column Body ────────────────────────────────────────────── */}
      <div className="site-shell-triad py-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12 lg:grid-cols-[minmax(15rem,16rem)_minmax(0,48rem)_minmax(15rem,16rem)] lg:justify-center">

          {/* ── Left Sidebar ─────────────────────────────────────────── */}
          <BlogSidebarLeft activeCategory={activeCategory} activeTags={activeTags} />

          {/* ── Main Feed ────────────────────────────────────────────── */}
          {posts !== undefined ? (
            <BlogFeedSection
              posts={posts}
              fetchError={fetchError}
              activeCategory={activeCategory}
              activeTags={activeTags}
              activeYear={activeYear}
            />
          ) : (
            <Suspense fallback={<BlogFeedSkeleton />}>
              <BlogFeedLoader
                currentYear={currentYear}
                activeCategory={activeCategory}
                activeTags={activeTags}
                activeYear={activeYear}
              />
            </Suspense>
          )}

          {/* ── Right Sidebar ─────────────────────────────────────────── */}
          <BlogSidebarRight activeYear={activeYear} />

        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-border mt-6">
        <div className="site-shell-triad py-7 flex flex-col sm:flex-row items-center justify-between gap-3">
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
