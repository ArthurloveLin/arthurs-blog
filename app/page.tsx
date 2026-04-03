import { getPosts } from '@/lib/blog'
import PostCard from '@/components/PostCard'
import ReindexButton from '@/components/ReindexButton'

export const revalidate = 60

export default async function HomePage() {
  const posts = await getPosts(20, 0)
  const featuredPost = posts[0]
  const recentPosts = posts.slice(1)

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-violet-50 via-white to-purple-50 dark:from-violet-950/20 dark:via-gray-950 dark:to-purple-950/20 border-b border-gray-100 dark:border-gray-800">
        <div className="absolute inset-0 opacity-30 dark:opacity-20">
          <div className="absolute top-0 left-0 w-96 h-96 bg-violet-300 dark:bg-violet-600 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 animate-blob" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-300 dark:bg-purple-600 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
          <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-pink-300 dark:bg-pink-600 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-32">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-violet-200 dark:border-violet-800">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
              </span>
              <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
                欢迎来到 Arthur & Grace 的博客
              </span>
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
                分享技术、
                <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                  生活
                </span>
                与创意
              </h1>
              <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl leading-relaxed">
                探索编程、设计、选衣搭配等领域的见解与思考。
                记录成长，分享知识，连接彼此。
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span>{posts.length} 篇文章</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span>技术 · 生活 · 搭配</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 sticky top-20 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm py-4 -mx-4 px-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">最新文章</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              探索最新的思考和分享
            </p>
          </div>
          <ReindexButton />
        </div>

        {/* Featured Post */}
        {featuredPost && (
          <div className="mb-10">
            <div className="group relative bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 rounded-2xl p-6 sm:p-8 border border-violet-100 dark:border-violet-900/50 overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-violet-200 dark:hover:border-violet-800">
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-200 dark:bg-violet-800 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 group-hover:opacity-30 transition-opacity duration-300" />

              <div className="relative space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  精选文章
                </div>

                <Link href={`/blog/${featuredPost.slug}`} className="group/block">
                  <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors leading-tight">
                    {featuredPost.title}
                  </h3>
                </Link>

                {featuredPost.summary && (
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3">
                    {featuredPost.summary}
                  </p>
                )}

                {featuredPost.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {featuredPost.tags.map((tag) => (
                      <Link
                        key={tag}
                        href={`/blog/tags/${encodeURIComponent(tag)}`}
                        className="text-xs font-medium px-3 py-1 rounded-full bg-white/80 dark:bg-gray-900/80 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors"
                      >
                        {tag}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Recent Posts */}
        {recentPosts.length > 0 ? (
          <div className="space-y-0">
            {recentPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : posts.length > 0 ? null : (
          <div className="py-16 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              还没有发布的文章
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              敬请期待更多内容
            </p>
          </div>
        )}

        {/* Load More (placeholder) */}
        {posts.length >= 20 && (
          <div className="mt-12 text-center">
            <button className="px-8 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50" disabled>
              加载更多 (开发中)
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-20 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">关于</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Arthur & Grace 的个人博客，分享技术见解、生活感悟和选衣搭配经验。
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">链接</h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>
                  <Link href="/wardrobe" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
                    选衣记录
                  </Link>
                </li>
                <li>
                  <a
                    href="https://trendradar.arthurlovegrace.top"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                  >
                    新闻汇总
                  </a>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">订阅</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                获取最新文章推送
              </p>
              <button className="w-full px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50" disabled>
                订阅 (开发中)
              </button>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500 dark:text-gray-500">
              © 2024 Arthur & Grace. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-gray-400 dark:text-gray-600">
              <a href="#" className="hover:text-gray-600 dark:hover:text-gray-400 transition-colors" title="GitHub">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.05-.015-2.055-3.33.72-4.035-1.605-4.035-1.605-.54-1.38-1.335-1.755-1.335-1.755-1.087-.75.075-.735.075-.735 1.2.09 1.83 1.245 1.83 1.245 1.08 1.845 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
