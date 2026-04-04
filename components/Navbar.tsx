'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { logout } from '@/app/auth/logout/actions'

const navLinks = [
  { href: '/', label: '首页' },
  { href: '/blog/tags', label: '标签' },
  { href: '/wardrobe', label: '选衣' },
  { href: 'https://trendradar.arthurlovegrace.top', label: '新闻', external: true },
]

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const { role, displayName, email, guestId, loading } = useAuth()

  useEffect(() => {
    const stored = localStorage.getItem('theme') as 'light' | 'dark' | null
    const initial = stored ?? (document.documentElement.classList.contains('dark') ? 'dark' : 'light')
    setTheme(initial)
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    document.documentElement.classList.toggle('dark')
    localStorage.setItem('theme', newTheme)
  }

  return (
    <header className="sticky top-0 z-50 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-zinc-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between gap-4">

          {/* ── Left: Logo / Title ─────────────────────────────────── */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            <div className="w-8 h-8 rounded-xl bg-[#1D1D1F] dark:bg-white flex items-center justify-center shadow-[0_2px_8px_rgb(0,0,0,0.15)] group-hover:scale-105 transition-transform duration-200">
              <span className="text-white dark:text-[#1D1D1F] text-[10px] font-bold tracking-tight leading-none">A&G</span>
            </div>
            <span className="text-[#1D1D1F] dark:text-white font-bold text-xl tracking-tight hidden sm:block">
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
                  className="px-4 py-2 text-sm font-medium text-[#1D1D1F]/70 dark:text-white/70 hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-all duration-200"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 text-sm font-medium text-[#1D1D1F]/70 dark:text-white/70 hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-all duration-200"
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
              className="p-2 text-[#1D1D1F]/50 dark:text-white/50 hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-all duration-200 hidden md:flex"
              aria-label="RSS 订阅"
              title="RSS 订阅"
            >
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7M6 17a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>

            {/* Search Placeholder */}
            <button
              className="p-2 text-[#1D1D1F]/50 dark:text-white/50 hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-all duration-200 hidden md:flex"
              aria-label="搜索"
              title="搜索功能开发中"
            >
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-[#1D1D1F]/50 dark:text-white/50 hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-all duration-200"
              aria-label="切换主题"
            >
              {theme === 'light' ? (
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              ) : (
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              )}
            </button>

            {/* Auth Status */}
            {!loading && (
              <div className="hidden sm:flex items-center gap-1.5">
                {role === 'guest' && (
                  <>
                    {guestId && (
                      <span className="text-xs text-[#1D1D1F]/35 dark:text-white/35 font-mono">
                        游客&nbsp;{guestId.slice(0, 6)}
                      </span>
                    )}
                    <Link
                      href="/auth/login"
                      className="px-3 py-1.5 text-sm font-medium text-[#1D1D1F]/70 dark:text-white/70 hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-all duration-200"
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
                    <span className="text-sm text-[#1D1D1F]/60 dark:text-white/60 max-w-[120px] truncate">
                      {displayName ?? email}
                    </span>
                    <form action={logout}>
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-sm font-medium text-[#1D1D1F]/50 dark:text-white/50 hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-all duration-200"
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
              className="md:hidden p-2 text-[#1D1D1F]/60 dark:text-white/60 hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-all duration-200"
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
          <nav className="md:hidden pb-4 pt-2 border-t border-gray-200/60 dark:border-zinc-700/60">
            <div className="space-y-0.5">
              {navLinks.map((link) =>
                link.external ? (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-2.5 text-sm font-medium text-[#1D1D1F]/70 dark:text-white/70 hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-all duration-200"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block px-4 py-2.5 text-sm font-medium text-[#1D1D1F]/70 dark:text-white/70 hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-all duration-200"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                )
              )}
              <button
                onClick={() => { toggleTheme(); setIsMobileMenuOpen(false) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-[#1D1D1F]/60 dark:text-white/60 hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-all duration-200"
              >
                {theme === 'light' ? '深色模式' : '浅色模式'}
              </button>
              {/* Mobile Auth */}
              {!loading && role === 'guest' && (
                <Link
                  href="/auth/login"
                  className="block px-4 py-2.5 text-sm font-medium text-[#1D1D1F]/70 dark:text-white/70 hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-all duration-200"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  登录{guestId ? `（游客 ${guestId.slice(0, 6)}）` : ''}
                </Link>
              )}
              {!loading && (role === 'user' || role === 'admin') && (
                <div className="px-4 py-2.5 flex items-center justify-between">
                  <span className="text-sm text-[#1D1D1F]/60 dark:text-white/60 flex items-center gap-2">
                    {role === 'admin' && (
                      <span className="text-xs font-semibold px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-md">
                        管理员
                      </span>
                    )}
                    {displayName ?? email}
                  </span>
                  <form action={logout}>
                    <button type="submit" className="text-sm text-[#1D1D1F]/50 dark:text-white/50 hover:text-[#1D1D1F] dark:hover:text-white">
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
