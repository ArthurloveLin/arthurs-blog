import Link from 'next/link'
import type { Metadata } from 'next'
import { EYEBROW } from '@/components/cardSurface'

export const metadata: Metadata = {
  title: '页面不存在 · 404',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <main className="site-shell relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden py-20 text-center">
      {/* Atmosphere — mirrors the homepage hero blobs, hidden from a11y/print */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-blob-1 opacity-40 blur-2xl animate-blob"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[60%] top-1/4 h-64 w-64 rounded-full bg-blob-2 opacity-40 blur-2xl animate-blob animation-delay-2000"
      />

      <div className="relative z-10 flex flex-col items-center">
        <p className={`${EYEBROW} mb-6`}>Error · 404</p>
        <h1 className="text-gradient-primary text-7xl font-bold leading-none tracking-tight sm:text-8xl">
          404
        </h1>
        <h2 className="mt-6 text-xl font-semibold text-foreground sm:text-2xl">
          这一页迷路了
        </h2>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          你要找的页面也许被移动、重命名,或从未存在。不如回到首页,从头开始探索。
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-lg bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
          >
            返回首页
          </Link>
          <Link
            href="/search"
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground/80 transition hover:bg-foreground/5 hover:text-foreground"
          >
            搜索文章
          </Link>
        </div>
      </div>
    </main>
  )
}
