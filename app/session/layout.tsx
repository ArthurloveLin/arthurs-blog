import type { Metadata } from 'next'

// Life Lens 软归档：/session 子树（含 'use client' 的 new 页）统一 noindex。
// meta 级 noindex 能主动让已收录的 URL 从索引中移除，robots.txt 的 disallow 做不到这点。
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function SessionLayout({ children }: { children: React.ReactNode }) {
  return children
}
