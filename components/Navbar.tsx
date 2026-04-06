'use client'

import { Link, useTransitionRouter } from 'next-view-transitions'
import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useAuth } from '@/components/AuthProvider'
import { logout } from '@/app/auth/logout/actions'
import { useTheme } from 'next-themes'
import { useSiteData } from './SiteDataProvider'

const ThemeToggle = dynamic(() => import('./ThemeToggle'), { ssr: false })
const MobileDrawers = dynamic(() => import('./MobileDrawers'), { ssr: false })
import type { DrawerType } from './MobileDrawers'

const navLinks = [
  { href: '/', label: 'Home', tooltip: '首页 - 返回网站主页' },
  { href: '/wardrobe', label: 'LifeLens', tooltip: 'LifeLens - 智能评价与决策系统' },
  { href: 'https://trendradar.arthurlovegrace.top', label: 'News', tooltip: '新闻 - 获取最新的趋势资讯', external: true },
]

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [activeDrawer, setActiveDrawer] = useState<DrawerType>(null)
  const { role, displayName, email, guestId, loading } = useAuth()
  const { config } = useSiteData()
  const logoUrl = config?.author_avatar_url
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const router = useTransitionRouter()
  const pathname = usePathname()

  // 追踪上一个 pathname，用于判断是否能安全地 back()
  const prevPathnameRef = useRef<string | null>(null)
  const currentPathnameRef = useRef(pathname)
  useEffect(() => {
    prevPathnameRef.current = currentPathnameRef.current
    currentPathnameRef.current = pathname
  }, [pathname])

  // 智能返回处理：
  // - 在文章页 AND 上一页是列表/首页 → router.back()（恢复滚动位置）
  // - 在文章页 AND 上一页也是文章（如从侧边栏跳转）→ router.push('/') 正常导航
  const handleHomeClick = useCallback((e: React.MouseEvent) => {
    const isOnArticle = pathname.startsWith('/blog/') && pathname !== '/blog'
    if (!isOnArticle) return

    e.preventDefault()

    const prev = prevPathnameRef.current
    const prevIsArticle = prev !== null && prev.startsWith('/blog/') && prev !== '/blog'

    if (!prevIsArticle && prev !== null) {
      // 上一页是列表/首页，back() 可以精准恢复滚动位置
      router.back()
    } else {
      // 上一页是另一篇文章（侧边栏跳转），或首次直接访问 → 正常导航到首页
      router.push('/')
    }
  }, [pathname, router])

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <>
    <header 
      style={{ viewTransitionName: 'navbar' }}
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
          <Link 
            href="/" 
            onClick={handleHomeClick}
            className="flex items-center gap-2.5 flex-shrink-0 group"
          >
            <div className="w-8 h-8 relative rounded-xl bg-gradient-primary flex items-center justify-center shadow-[0_2px_8px_rgb(0,0,0,0.15)] group-hover:scale-105 transition-transform duration-200 overflow-hidden">
              {logoUrl ? (
                <Image src={logoUrl} alt="Logo" fill className="object-cover" unoptimized priority />
              ) : (
                <span className="text-primary-foreground text-[10px] font-bold tracking-tight leading-none">A&G</span>
              )}
            </div>
            <span className="text-gradient-primary font-bold text-lg sm:text-xl tracking-tight">
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
                  title={link.tooltip}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={link.href === '/' ? handleHomeClick : undefined}
                  className="px-4 py-2 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-foreground/5 rounded-lg transition duration-200"
                  title={link.tooltip}
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
                    onClick={(e) => {
                      if (link.href === '/') handleHomeClick(e)
                      setIsMobileMenuOpen(false)
                    }}
                    className="block px-4 py-2.5 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-foreground/5 rounded-lg transition duration-200"
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

    {/* ── Mobile Bottom Dock ───────────────────────────── */}
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 md:hidden">
      <div className={
        "flex items-center gap-0.5 px-2 py-1.5 " +
        "bg-white/85 backdrop-blur-md border border-black/5 " +
        "dark:bg-black/90 dark:backdrop-blur-none dark:border-white/10 " +
        "rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
      }>
        {/* Author */}
        <button
          onClick={() => setActiveDrawer(activeDrawer === 'author' ? null : 'author')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full transition-colors ${activeDrawer === 'author' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'}`}
          aria-label="作者"
        >
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          <span className="text-[9px] font-medium leading-none">作者</span>
        </button>

        <div className="w-px h-5 bg-border/60 mx-0.5" />

        {/* Categories */}
        <button
          onClick={() => setActiveDrawer(activeDrawer === 'categories' ? null : 'categories')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full transition-colors ${activeDrawer === 'categories' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'}`}
          aria-label="分类"
        >
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          <span className="text-[9px] font-medium leading-none">分类</span>
        </button>

        {/* Tags */}
        <button
          onClick={() => setActiveDrawer(activeDrawer === 'tags' ? null : 'tags')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full transition-colors ${activeDrawer === 'tags' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'}`}
          aria-label="标签"
        >
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581a2.25 2.25 0 003.182 0l4.318-4.318a2.25 2.25 0 000-3.182L11.159 3.659A2.25 2.25 0 009.568 3z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
          </svg>
          <span className="text-[9px] font-medium leading-none">标签</span>
        </button>

        {/* Recent */}
        <button
          onClick={() => setActiveDrawer(activeDrawer === 'recent' ? null : 'recent')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full transition-colors ${activeDrawer === 'recent' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'}`}
          aria-label="最新推文"
        >
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-[9px] font-medium leading-none">最新</span>
        </button>

        {/* Archive */}
        <button
          onClick={() => setActiveDrawer(activeDrawer === 'archive' ? null : 'archive')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full transition-colors ${activeDrawer === 'archive' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'}`}
          aria-label="归档"
        >
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
          <span className="text-[9px] font-medium leading-none">归档</span>
        </button>

        {/* Tools */}
        <button
          onClick={() => setActiveDrawer(activeDrawer === 'tools' ? null : 'tools')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full transition-colors ${activeDrawer === 'tools' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'}`}
          aria-label="工具"
        >
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
          </svg>
          <span className="text-[9px] font-medium leading-none">工具</span>
        </button>
      </div>
    </div>

    {/* ── Mobile Sidebar Drawers ────────────────────────── */}
    <MobileDrawers activeDrawer={activeDrawer} setActiveDrawer={setActiveDrawer} />
    </>
  )
}
