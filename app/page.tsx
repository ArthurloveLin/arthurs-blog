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

  // getUserRole 依赖 cookies()，必须单独调用，不能放入 Promise.all
  // 否则会触发 Next.js 动态渲染 bailout，导致 unstable_cache 命中 0
  const isAdmin = await getUserRole().then((role) => role === 'admin').catch(() => false)

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
            <span className="text-gradient-primary">{siteConfig.site_title_highlight || "技术、生活与创意"}</span><br className="hidden sm:block" />{siteConfig.site_title_rest || "的记录与分享"}
          </h1>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-sm">
            {siteConfig.site_description || "探索编程、设计、LifeLens 智能评价等领域的见解与思考。记录成长，分享知识，连接彼此。"}
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
                isAdmin={isAdmin}
                role={siteConfig.author_role}
                company={siteConfig.author_company}
                location={siteConfig.author_location}
                skills={siteConfig.author_skills}
                status={siteConfig.author_status}
                github={siteConfig.author_github}
                weibo={siteConfig.author_weibo}
                wechat={siteConfig.author_wechat}
                email={siteConfig.author_email}
              />
              <CategoriesCard categories={categories} activeCategory={activeCategory} />
              <TagsCloudCard tags={tags.slice(0, 14)} activeTags={activeTags} />
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
  )
}
