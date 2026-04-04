import Link from 'next/link'
import { getPosts, getCategories } from '@/lib/blog'
import type { Post } from '@/lib/blog'
import ReindexButton from '@/components/ReindexButton'
import PostCard from '@/components/PostCard'
import AuthorProfileCard from '@/components/AuthorProfileCard'
import CategoriesCard from '@/components/CategoriesCard'
import TagsCloudCard from '@/components/TagsCloudCard'
import RecentPostsCard from '@/components/RecentPostsCard'
import ArchiveCard from '@/components/ArchiveCard'
import ToolsCard from '@/components/ToolsCard'

export const revalidate = 60

function collectTags(posts: Post[]): { tag: string; count: number }[] {
  const tagMap = new Map<string, number>()
  posts.forEach((post) => {
    post.tags.forEach((tag) => {
      tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1)
    })
  })
  return Array.from(tagMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 14)
}


export default async function HomePage() {
  let posts: Post[] = []
  try {
    posts = await getPosts(20, 0)
  } catch {
    // Supabase unreachable (e.g. local dev) — render empty state
  }

  const categories = await getCategories().catch(() => [])
  const tags = collectTags(posts)

  return (
    <main className="min-h-screen bg-[#F5F5F7] dark:bg-zinc-950">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="border-b border-zinc-100 dark:border-zinc-800/70 bg-[#F5F5F7] dark:bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-12 lg:pt-20 lg:pb-16">
          <p className="font-mono text-[11px] tracking-[0.18em] text-[#86868B] dark:text-zinc-500 uppercase mb-5">
            Arthur &amp; Grace · Journal
          </p>
          <h1 className="text-[2rem] lg:text-[2.5rem] font-semibold tracking-tight leading-[1.2] text-[#1D1D1F] dark:text-zinc-100 max-w-lg">
            技术、生活与创意<br className="hidden sm:block" />的记录与分享
          </h1>
          <p className="mt-4 text-sm text-[#86868B] dark:text-zinc-400 leading-relaxed max-w-sm">
            探索编程、设计、选衣搭配等领域的见解与思考。记录成长，分享知识，连接彼此。
          </p>
        </div>
      </div>

      {/* ── 3-Column Body ────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

          {/* ── Left Sidebar ─────────────────────────────────────────── */}
          {/* Desktop: col-span-3 | Tablet: col-span-4 | Mobile: hidden */}
          <aside className="hidden md:block md:col-span-4 lg:col-span-3">
            <div className="sticky top-24 space-y-4">
              <AuthorProfileCard
                postsCount={posts.length}
                categoriesCount={categories.length}
                tagsCount={tags.length}
              />
              <CategoriesCard categories={categories} />
              <TagsCloudCard tags={tags.length > 0 ? tags : []} />
            </div>
          </aside>

          {/* ── Main Feed ────────────────────────────────────────────── */}
          {/* Desktop: col-span-6 | Tablet: col-span-8 | Mobile: full */}
          <section className="md:col-span-8 lg:col-span-6">
            {/* Feed header */}
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-zinc-100 dark:border-zinc-800/70">
              <span className="font-mono text-[11px] tracking-[0.15em] text-[#86868B] dark:text-zinc-500 uppercase">
                {posts.length > 0 ? `${posts.length} 篇文章` : '文章'}
              </span>
              <ReindexButton />
            </div>

            {/* Empty state */}
            {posts.length === 0 && (
              <div className="py-24 flex flex-col items-center gap-2">
                <span className="font-mono text-xs text-zinc-300 dark:text-zinc-700">— 暂无文章 —</span>
                <span className="text-xs text-[#86868B] dark:text-zinc-600">点击同步按钮获取最新内容</span>
              </div>
            )}

            {/* Post cards */}
            {posts.length > 0 && (
              <div className="space-y-6">
                {posts.map((post, index) => (
                  <PostCard key={post.id} post={post} index={index} />
                ))}
              </div>
            )}
          </section>

          {/* ── Right Sidebar ─────────────────────────────────────────── */}
          {/* Desktop only: col-span-3 | Tablet + Mobile: hidden */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-24 space-y-4">
              <RecentPostsCard posts={posts} />
              <ArchiveCard posts={posts} />
              <ToolsCard />
            </div>
          </aside>

        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-100 dark:border-zinc-800/70 mt-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-mono text-[11px] text-[#86868B] dark:text-zinc-600">
            © {new Date().getFullYear()} Arthur &amp; Grace
          </p>
          <nav className="lg:hidden flex items-center gap-5 font-mono text-[11px] text-[#86868B] dark:text-zinc-500">
            <Link href="/wardrobe" className="hover:text-[#1D1D1F] dark:hover:text-zinc-300 transition-colors">
              选衣记录
            </Link>
            <a
              href="https://trendradar.arthurlovegrace.top"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#1D1D1F] dark:hover:text-zinc-300 transition-colors"
            >
              新闻汇总
            </a>
          </nav>
        </div>
      </footer>

    </main>
  )
}
