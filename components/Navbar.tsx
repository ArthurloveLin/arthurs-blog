'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useAuth } from '@/components/AuthProvider'
import { logout } from '@/app/auth/logout/actions'
import ThemeToggle from './ThemeToggle'
import { useTheme } from 'next-themes'

const navLinks = [
  { href: '/', label: '首页' },
    { href: '/wardrobe', label: '选衣' },
  { href: 'https://trendradar.arthurlovegrace.top', label: '新闻', external: true },
]

export default function Navbar({ logoUrl }: { logoUrl?: string }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { role, displayName, email, guestId, loading } = useAuth()
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <header 
      className={
        "sticky top-0 z-50 border-b transition-colors duration-300 " +
        // 浅色模式: 灰色透明磨砂效果
        "bg-white/80 backdrop-blur-md border-black/5 " +
        // 深色模式(独立逻辑): 替换为纯黑色，去除磨砂模糊
        "dark:bg-black dark:backdrop-blur-none dark:border-white/10"
      }
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between gap-4">

          {/* ── Left: Logo / Title ─────────────────────────────────── */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            <div className="w-8 h-8 relative rounded-xl bg-gradient-primary flex items-center justify-center shadow-[0_2px_8px_rgb(0,0,0,0.15)] group-hover:scale-105 transition-transform duration-200 overflow-hidden">
              {logoUrl ? (
                <Image src={logoUrl} alt="Logo" fill className="object-cover" unoptimized />
              ) : (
                <span className="text-primary-foreground text-[10px] font-bold tracking-tight leading-none">A&G</span>
              )}
            </div>
            <span className="text-gradient-primary font-bold text-xl tracking-tight hidden sm:block">
              Arthur & Grace
            </span>
          </Link>

          {/* ── Center: Navigation Links ───────────────────────────── */}
          <nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
            {navLinks.map((link) =>
              link.external ? (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-foreground/5 rounded-lg transition duration-200"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-foreground/5 rounded-lg transition duration-200"
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>

          {/* ── Right: Icons ───────────────────────────────────────── */}
          <div className="flex items-center gap-1 flex-shrink-0">

            {/* RSS Placeholder */}
            <button
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-foreground/5 rounded-lg transition duration-200 hidden md:flex"
              aria-label="RSS 订阅"
              title="RSS 订阅"
            >
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7M6 17a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>

            {/* Search Placeholder */}
            <button
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-foreground/5 rounded-lg transition duration-200 hidden md:flex"
              aria-label="搜索"
              title="搜索功能开发中"
            >
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </button>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Auth Status */}
            {!loading && (
              <div className="hidden sm:flex items-center gap-1.5 ml-1">
                {role === 'guest' && (
                  <>
                    {guestId && (
                      <span className="text-xs text-muted-foreground font-mono">
                        游客&nbsp;{guestId.slice(0, 6)}
                      </span>
                    )}
                    <Link
                      href="/auth/login"
                      className="px-3 py-1.5 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-foreground/5 rounded-lg transition duration-200"
                    >
                      登录
                    </Link>
                  </>
                )}
                {(role === 'user' || role === 'admin') && (
                  <>
                    {role === 'admin' && (
                      <span className="text-xs font-semibold px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-md">
                        管理员
                      </span>
                    )}
                    <span className="text-sm text-foreground/60 max-w-[120px] truncate">
                      {displayName ?? email}
                    </span>
                    <form action={logout}>
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 rounded-lg transition duration-200"
                      >
                        退出
                      </button>
                    </form>
                  </>
                )}
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-foreground/60 hover:text-foreground hover:bg-foreground/5 rounded-lg transition duration-200"
              aria-label="菜单"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* ── Mobile Menu ─────────────────────────────────────────── */}
        {isMobileMenuOpen && (
          <nav className="md:hidden pb-4 pt-2 border-t border-gray-200/60 dark:border-white/10 bg-white dark:bg-black">
            <div className="space-y-0.5">
              {navLinks.map((link) =>
                link.external ? (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-2.5 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-foreground/5 rounded-lg transition duration-200"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block px-4 py-2.5 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-foreground/5 rounded-lg transition duration-200"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                )
              )}
              <div className="px-4 py-2.5 space-y-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">主题模式</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'light', name: '默认紫', color: 'bg-violet-500' },
                    { id: 'ocean', name: '海洋蓝', color: 'bg-sky-500' },
                    { id: 'sunset', name: '日落橙', color: 'bg-orange-500' },
                    { id: 'forest', name: '森林绿', color: 'bg-emerald-500' },
                    { id: 'dark', name: '暗色', color: 'bg-zinc-800 border border-zinc-600' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setTheme(t.id); setIsMobileMenuOpen(false) }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        mounted && theme === t.id
                          ? 'bg-foreground text-background'
                          : 'bg-[#F5F5F7] dark:bg-zinc-800 text-muted-foreground'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${t.color}`} />
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
              {/* Mobile Auth */}
              {!loading && role === 'guest' && (
                <Link
                  href="/auth/login"
                  className="block px-4 py-2.5 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-foreground/5 rounded-lg transition duration-200"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  登录{guestId ? `（游客 ${guestId.slice(0, 6)}）` : ''}
                </Link>
              )}
              {!loading && (role === 'user' || role === 'admin') && (
                <div className="px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {role === 'admin' && (
                      <>
                        <span className="text-xs font-semibold px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-md">
                          管理员
                        </span>
                        <Link
                          href="/admin/settings"
                          className="p-1 px-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-foreground/5 rounded-md flex items-center gap-1"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          </svg>
                          设置
                        </Link>
                      </>
                    )}
                    <span className="text-sm text-foreground/60">{displayName ?? email}</span>
                  </div>
                  <form action={logout}>
                    <button type="submit" className="text-sm text-muted-foreground hover:text-foreground">
                      退出
                    </button>
                  </form>
                </div>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}
