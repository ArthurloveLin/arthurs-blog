import Link from 'next/link'
import type { Metadata } from 'next'
import SearchResultCard from '@/components/SearchResultCard'
import { searchPosts } from '@/lib/blog'
import { normalizeSearchQuery, SEARCH_MIN_QUERY_LENGTH } from '@/lib/blog-search'

const PAGE_SIZE = 12

export const metadata: Metadata = {
  title: '博客搜索 | Arthur & Grace',
  description: '搜索文章标题、正文、标签和分类',
  robots: {
    index: false,
    follow: true,
  },
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const queryParam = Array.isArray(params.q) ? params.q[0] : params.q
  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page
  const query = normalizeSearchQuery(queryParam ?? '')
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1)
  const shouldSearch = query.length >= SEARCH_MIN_QUERY_LENGTH
  const { results, total, limit } = shouldSearch
    ? await searchPosts(query, page, PAGE_SIZE)
    : { results: [], total: 0, limit: PAGE_SIZE }

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const previousPage = page > 1 ? `/search?q=${encodeURIComponent(query)}&page=${page - 1}` : null
  const nextPage = page < totalPages ? `/search?q=${encodeURIComponent(query)}&page=${page + 1}` : null

  return (
    <main className="min-h-screen bg-background pb-20 pt-10 md:pt-14">
      <div className="site-shell-narrow">
        <section className="rounded-[1.75rem] border border-border/70 bg-card/85 px-6 py-7 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.35)] backdrop-blur-sm md:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Blog Search</p>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-[2.4rem]">搜索文章</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
                支持标题、正文、标签和分类检索。结果页可分享，桌面导航栏与移动端搜索层都会跳转到这里。
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background px-5 text-sm font-medium text-foreground transition hover:border-foreground/20 hover:bg-muted"
            >
              返回首页
            </Link>
          </div>
        </section>

        <section className="mt-8 rounded-[1.75rem] border border-border/70 bg-card/90 px-6 py-6 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.28)] md:px-8">
          {query.length === 0 ? (
            <div className="py-10 text-center">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">输入关键词开始搜索</p>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">可以直接在导航栏打开搜索，也可以在地址栏访问 /search?q=关键词。</p>
            </div>
          ) : null}

          {query.length > 0 && query.length < SEARCH_MIN_QUERY_LENGTH ? (
            <div className="py-10 text-center">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">关键词太短</p>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">至少输入 {SEARCH_MIN_QUERY_LENGTH} 个字符，搜索体验会更稳定。</p>
            </div>
          ) : null}

          {shouldSearch ? (
            <>
              <div className="flex flex-col gap-2 border-b border-border/70 pb-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Query</p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground">“{query}”</h2>
                </div>
                <p className="text-sm text-muted-foreground">共 {total} 条结果，当前第 {page} / {totalPages} 页</p>
              </div>

              {results.length === 0 ? (
                <div className="py-14 text-center">
                  <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">没有找到匹配结果</p>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">可以换一个更短的关键词，或尝试标题、标签、分类中的核心词。</p>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {results.map((result) => (
                    <SearchResultCard key={result.id} result={result} query={query} />
                  ))}
                </div>
              )}

              {results.length > 0 ? (
                <div className="mt-8 flex items-center justify-between gap-4 border-t border-border/70 pt-5">
                  {previousPage ? (
                    <Link href={previousPage} className="inline-flex h-11 items-center rounded-full border border-border bg-background px-5 text-sm font-medium text-foreground transition hover:bg-muted">
                      上一页
                    </Link>
                  ) : <span />}

                  {nextPage ? (
                    <Link href={nextPage} className="inline-flex h-11 items-center rounded-full border border-border bg-background px-5 text-sm font-medium text-foreground transition hover:bg-muted">
                      下一页
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      </div>
    </main>
  )
}