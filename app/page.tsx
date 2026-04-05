import Link from 'next/link'
import { Suspense } from 'react'
import { getPostsByCategory, getPostsByTags, getPostsByYear, getYearArchive, getPostsCount, getCategories, getSiteConfig, getAllTags, getCommentCounts } from '@/lib/blog'
import type { Post } from '@/lib/blog'
import ReindexButton from '@/components/ReindexButton'
import { getUserRole } from '@/lib/auth'
import PostCard from '@/components/PostCard'
import AuthorProfileCard from '@/components/AuthorProfileCard'
import CategoriesCard from '@/components/CategoriesCard'
import TagsCloudCard from '@/components/TagsCloudCard'
import RecentPostsCard from '@/components/RecentPostsCard'
import ArchiveCard from '@/components/ArchiveCard'
import ToolsCard from '@/components/ToolsCard'

export const revalidate = 60

async function AdminToolbar() {
  const isAdmin = (await getUserRole()) === 'admin'
  if (!isAdmin) return null
  return <ReindexButton />
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; tags?: string; year?: string }>
}) {
  const { category, tags: tagsParam, year: yearParam } = await searchParams
  const activeCategory = category ? decodeURIComponent(category) : null
  const activeTags = tagsParam
    ? tagsParam.split(',').map((t) => decodeURIComponent(t)).filter(Boolean)
    : []
  const activeYear = yearParam ? parseInt(yearParam, 10) : null

  const currentYear = new Date().getFullYear()

  let fetchError = false

  // 同时发起 posts 查询和所有侧边栏查询，消除串行瀑布流
  const postsPromise = (async () => {
    if (activeCategory) return getPostsByCategory(activeCategory, 20, 0)
    if (activeTags.length > 0) return getPostsByTags(activeTags, 20, 0)
    return getPostsByYear(activeYear ?? currentYear, 50, 0)
  })()

  const [posts, categories, tags, siteConfig, totalPostsCount, yearArchive] = await Promise.all([
    postsPromise.catch(() => { fetchError = true; return [] as Post[] }),
    getCategories().catch(() => []),
    getAllTags().catch(() => []),
    getSiteConfig().catch(() => ({} as Record<string, string>)),
    getPostsCount().catch(() => 0),
    getYearArchive().catch(() => []),
  ])

  // commentCounts 依赖 posts.id，单独等待
  const commentCounts = await getCommentCounts(posts.map((p) => p.id)).catch(() => ({} as Record<string, number>))

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
                postsCount={totalPostsCount}
                categoriesCount={categories.length}
                tagsCount={tags.length}
                name={siteConfig.author_name}
                bio={siteConfig.author_bio}
                avatarUrl={siteConfig.author_avatar_url}
              />
              <CategoriesCard categories={categories} activeCategory={activeCategory} />
              <TagsCloudCard tags={tags.slice(0, 14)} activeTags={activeTags} />
            </div>
          </aside>

          {/* ── Main Feed ────────────────────────────────────────────── */}
          {/* Desktop: col-span-6 | Tablet: col-span-8 | Mobile: full */}
          <section className="md:col-span-8 lg:col-span-6">
            {/* Feed header / Category filter banner */}
            <div className="flex items-center justify-between mb-5 px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              {activeCategory || activeTags.length > 0 || activeYear ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[10px] tracking-[0.15em] text-[#86868B] dark:text-zinc-500 uppercase">
                    {activeCategory ? '分类' : activeTags.length > 0 ? '标签' : '归档'}
                  </span>
                  <span className="text-sm font-medium text-[#1D1D1F] dark:text-zinc-100">
                    {activeCategory ?? (activeTags.length > 0 ? activeTags.join(' + ') : `${activeYear} 年`)}
                  </span>
                  <span className="text-xs text-[#86868B] dark:text-zinc-500">· 共 {posts.length} 篇</span>
                  <Link
                    href="/"
                    className="ml-1 text-xs text-[#86868B] dark:text-zinc-500 hover:text-[#1D1D1F] dark:hover:text-zinc-300 transition-colors"
                  >
                    ✕
                  </Link>
                </div>
              ) : (
                <span className="font-mono text-[11px] tracking-[0.15em] text-[#86868B] dark:text-zinc-500 uppercase">
                  {posts.length > 0 ? `${posts.length} 篇文章` : '文章'}
                </span>
              )}
              <Suspense fallback={null}>
                <AdminToolbar />
              </Suspense>
            </div>

            {/* Empty / error state */}
            {posts.length === 0 && (
              <div className="py-24 flex flex-col items-center gap-2">
                <span className="font-mono text-xs text-zinc-300 dark:text-zinc-700">
                  {fetchError ? '— 加载失败 —' : '— 暂无文章 —'}
                </span>
                <span className="text-xs text-[#86868B] dark:text-zinc-600">
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
                  <PostCard key={post.id} post={post} index={index} commentCount={commentCounts[post.id]} />
                ))}
              </div>
            )}
          </section>

          {/* ── Right Sidebar ─────────────────────────────────────────── */}
          {/* Desktop only: col-span-3 | Tablet + Mobile: hidden */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-24 space-y-4">
              <RecentPostsCard posts={posts} />
              <ArchiveCard archive={yearArchive} activeYear={activeYear} />
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
