'use client'

import Link from 'next/link'
import { useEffect, useCallback, startTransition, useSyncExternalStore } from 'react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { logout } from '@/app/auth/logout/actions'
import { useTheme } from 'next-themes'
import { useSiteConfig } from './SiteDataProvider'
import { Rss, Search, Menu, X, Settings, User, LayoutList, Tag, Clock, Archive, Wrench } from 'lucide-react'
import {
  BLOG_RETURN_CURRENT_POST_ID_KEY,
  BLOG_RETURN_CURRENT_POST_SLUG_KEY,
  BLOG_RETURN_PATHNAME_KEY,
  BLOG_RETURN_POST_SLUG_KEY,
  BLOG_RETURN_TARGET_EVENT,
  getPostAnchorHref,
} from '@/lib/blog-return'

const ThemeToggle = dynamic(() => import('./ThemeToggle'), { ssr: false })
import MobileDrawers, { preloadMobileDrawerModules } from './MobileDrawers'
import { NavbarUiStateProvider, useNavbarUiState, type DrawerType } from './NavbarUiState'

interface DrawerToggleItem {
  key: Exclude<DrawerType, null>
  label: string
  Icon: LucideIcon
}

const navLinks = [
  { href: '/', label: 'Home', tooltip: '首页 - 返回网站主页', external: false },
  { href: '/life-gallery', label: 'Life Gallery', tooltip: '生活画廊 - 我的生活图像轮播', external: false },
  { href: '/wardrobe', label: 'Life Lens', tooltip: 'Life Lens - 记录真实评价的决策系统', external: false },
  { href: '/trend-radar', label: 'News', tooltip: '趋势雷达 - 获取最新的趋势资讯', external: false },
  { href: '/guestbook', label: 'Message', tooltip: '留言板 - 留下你的印记', external: false },
]

const mobileDrawerItems: DrawerToggleItem[] = [
  { key: 'author', label: '作者', Icon: User },
  { key: 'categories', label: '分类', Icon: LayoutList },
  { key: 'tags', label: '标签', Icon: Tag },
  { key: 'recent', label: '最新', Icon: Clock },
  { key: 'archive', label: '归档', Icon: Archive },
  { key: 'tools', label: '工具', Icon: Wrench },
]

function getDrawerButtonClass(isActive: boolean) {
  return `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full transition-colors ${isActive ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'}`
}

function AdminRoleBadge() {
  return (
    <span className="text-xs font-semibold px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-md">
      管理员
    </span>
  )
}

function GuestIdentity({ guestId }: { guestId: string }) {
  if (!guestId) return null

  return (
    <span className="text-xs text-muted-foreground font-mono">
      游客&nbsp;{guestId.slice(0, 6)}
    </span>
  )
}

function DesktopGuestAuth({ guestId }: { guestId: string }) {
  return (
    <>
      <GuestIdentity guestId={guestId} />
      <Link
        href="/auth/login"
        className="px-3 py-1.5 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-foreground/5 rounded-lg transition duration-200"
      >
        登录
      </Link>
    </>
  )
}

function DesktopSignedInAuth({
  displayName,
  email,
  isAdmin,
}: {
  displayName: string | null
  email: string | null
  isAdmin: boolean
}) {
  return (
    <>
      {isAdmin && <AdminRoleBadge />}
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
  )
}

function MobileGuestAuth({ guestId, onClose }: { guestId: string; onClose: () => void }) {
  return (
    <Link
      href="/auth/login"
      className="block px-4 py-2.5 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-foreground/5 rounded-lg transition duration-200"
      onClick={onClose}
    >
      登录{guestId ? `（游客 ${guestId.slice(0, 6)}）` : ''}
    </Link>
  )
}

function MobileSignedInAuth({
  displayName,
  email,
  isAdmin,
  onClose,
}: {
  displayName: string | null
  email: string | null
  isAdmin: boolean
  onClose: () => void
}) {
  return (
    <div className="px-4 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {isAdmin && (
          <>
            <AdminRoleBadge />
            <Link
              href="/admin/settings"
              className="p-1 px-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-foreground/5 rounded-md flex items-center gap-1"
              onClick={onClose}
            >
              <Settings className="w-3 h-3" strokeWidth={2} />
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
  )
}

function NavDesktopAuthStatus() {
  const { role, displayName, email, loading, guestId } = useAuth()

  if (loading) return null

  return (
    <div className="hidden sm:flex items-center gap-1.5 ml-1">
      {role === 'guest'
        ? <DesktopGuestAuth guestId={guestId} />
        : <DesktopSignedInAuth displayName={displayName} email={email} isAdmin={role === 'admin'} />}
    </div>
  )
}

function NavMobileAuthSection({ onClose }: { onClose: () => void }) {
  const { role, displayName, email, loading, guestId } = useAuth()

  if (loading) return null

  return (
    <>
      {role === 'guest'
        ? <MobileGuestAuth guestId={guestId} onClose={onClose} />
        : <MobileSignedInAuth displayName={displayName} email={email} isAdmin={role === 'admin'} onClose={onClose} />}
    </>
  )
}

function NavMobileBar({
  activeDrawer,
  toggleDrawer,
}: {
  activeDrawer: DrawerType
  toggleDrawer: (drawer: Exclude<DrawerType, null>) => void
}) {
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 md:hidden">
      <div className={
        "flex items-center gap-0.5 px-2 py-1.5 " +
        "bg-white/94 border border-black/5 " +
        "dark:bg-black/90 dark:backdrop-blur-none dark:border-white/10 " +
        "rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.32)]"
      }>
        {mobileDrawerItems.map(({ key, label, Icon }, index) => (
          <div key={key} className="flex items-center">
            {index > 0 && <div className="w-px h-5 bg-border/60 mx-0.5" />}
            <button
              onClick={() => toggleDrawer(key)}
              className={getDrawerButtonClass(activeDrawer === key)}
              aria-label={label}
            >
              <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
              <span className="text-[9px] font-medium leading-none">{label}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function NavbarContent() {
  const config = useSiteConfig()
  const logoUrl = config?.author_avatar_url
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()
  const {
    activeDrawer,
    closeDrawer,
    closeMobileMenu,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    toggleDrawer: toggleDrawerInternal,
  } = useNavbarUiState()

  const isNowWatchingPage = pathname === '/now-watching'

  const isOnArticle = pathname.startsWith('/blog/') && pathname !== '/blog'

  const articleHomeHref = useSyncExternalStore(
    useCallback((onStoreChange: () => void) => {
      if (typeof window === 'undefined' || !isOnArticle) {
        return () => {}
      }

      const handleStoreChange = () => onStoreChange()

      window.addEventListener(BLOG_RETURN_TARGET_EVENT, handleStoreChange)
      window.addEventListener('storage', handleStoreChange)

      return () => {
        window.removeEventListener(BLOG_RETURN_TARGET_EVENT, handleStoreChange)
        window.removeEventListener('storage', handleStoreChange)
      }
    }, [isOnArticle]),
    () => {
      if (typeof window === 'undefined') {
        return '/'
      }

      const currentPostId = sessionStorage.getItem(BLOG_RETURN_CURRENT_POST_ID_KEY)
      return currentPostId ? getPostAnchorHref(currentPostId) : '/'
    },
    () => '/'
  )

  const homeHref = isOnArticle ? articleHomeHref : '/'

  const handleHomeClick = useCallback(() => {
    if (!isOnArticle) return

    const currentPostSlug = sessionStorage.getItem(BLOG_RETURN_CURRENT_POST_SLUG_KEY)
    if (currentPostSlug) {
      sessionStorage.setItem(BLOG_RETURN_PATHNAME_KEY, '/')
      sessionStorage.setItem(BLOG_RETURN_POST_SLUG_KEY, currentPostSlug)
    }
  }, [isOnArticle])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(min-width: 768px)').matches) return

    const preloadDrawers = () => preloadMobileDrawerModules()
    const warmOnFirstInteraction = () => preloadDrawers()
    const requestIdle = window.requestIdleCallback?.bind(window)
    const cancelIdle = window.cancelIdleCallback?.bind(window)

    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null
    let idleId: number | null = null

    if (requestIdle) {
      idleId = requestIdle(preloadDrawers, { timeout: 1500 })
    } else {
      timeoutId = globalThis.setTimeout(preloadDrawers, 600)
    }

    window.addEventListener('touchstart', warmOnFirstInteraction, { passive: true, once: true })
    window.addEventListener('pointerdown', warmOnFirstInteraction, { passive: true, once: true })

    return () => {
      window.removeEventListener('touchstart', warmOnFirstInteraction)
      window.removeEventListener('pointerdown', warmOnFirstInteraction)

      if (idleId !== null && cancelIdle) {
        cancelIdle(idleId)
      }
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId)
      }
    }
  }, [])

  const toggleDrawer = useCallback((drawer: Exclude<DrawerType, null>) => {
    startTransition(() => {
      closeMobileMenu()
      toggleDrawerInternal(drawer)
    })
  }, [closeMobileMenu, toggleDrawerInternal])

  const toggleMobileMenu = useCallback(() => {
    if (!isMobileMenuOpen) {
      closeDrawer()
    }
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }, [closeDrawer, isMobileMenuOpen, setIsMobileMenuOpen])

  const closeMobileNavigation = useCallback(() => {
    closeMobileMenu()
  }, [closeMobileMenu])

  if (isNowWatchingPage) {
    return null
  }

  return (
    <>

    <header
      className={
        "sticky top-0 z-50 border-b transition-colors duration-300 " +
        // 浅色模式: 移动端减少 blur 合成，桌面保留磨砂效果
        "bg-white/92 backdrop-blur-none border-black/5 md:bg-white/80 md:backdrop-blur-md " +
        // 深色模式(独立逻辑): 替换为纯黑色，去除磨砂模糊
        "dark:bg-black dark:backdrop-blur-none dark:border-white/10"
      }
    >
      <div className="site-shell">
        <div className="h-16 flex items-center justify-between gap-4">

          {/* ── Left: Logo / Title ─────────────────────────────────── */}
          <Link 
            href={homeHref}
            onClick={handleHomeClick}
            transitionTypes={isOnArticle ? ['nav-back'] : undefined}
            className="flex items-center gap-2.5 flex-shrink-0 group"
          >
            <div className="w-8 h-8 relative flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              {/* Elegant Blur Glow */}
              <div className="absolute inset-0 rounded-xl bg-gradient-primary opacity-0 group-hover:opacity-40 blur-md group-hover:blur-lg transition-all duration-500 scale-50 group-hover:scale-125" />
              
              <div className="w-full h-full relative rounded-xl bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 flex items-center justify-center shadow-sm overflow-hidden z-10">
                {logoUrl ? (
                  <Image 
                    src={logoUrl} 
                    alt="Logo" 
                    fill 
                    className="object-cover" 
                    sizes="32px"
                    priority 
                  />
                ) : (
                  <span className="text-primary text-[10px] font-bold tracking-tight leading-none">A&G</span>
                )}
              </div>
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
                  href={link.href === '/' ? homeHref : link.href}
                  onClick={link.href === '/' ? handleHomeClick : undefined}
                  transitionTypes={link.href === '/' && isOnArticle ? ['nav-back'] : undefined}
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
              <Rss className="w-[18px] h-[18px]" strokeWidth={1.75} />
            </button>

            {/* Search Placeholder */}
            <button
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-foreground/5 rounded-lg transition duration-200 hidden md:flex"
              aria-label="搜索"
              title="搜索功能开发中"
            >
              <Search className="w-[18px] h-[18px]" strokeWidth={1.75} />
            </button>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Auth Status */}
            <NavDesktopAuthStatus />

            {/* Mobile Menu Toggle */}
            <button
              onClick={toggleMobileMenu}
              className="md:hidden p-2 text-foreground/60 hover:text-foreground hover:bg-foreground/5 rounded-lg transition duration-200"
              aria-label="菜单"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" strokeWidth={1.75} />
              ) : (
                <Menu className="w-5 h-5" strokeWidth={1.75} />
              )}
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
                    onClick={closeMobileNavigation}
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href === '/' ? homeHref : link.href}
                    onClick={() => {
                      if (link.href === '/') handleHomeClick()
                      closeMobileNavigation()
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
                      onClick={() => { setTheme(t.id); closeMobileNavigation() }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        theme === t.id
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
              <NavMobileAuthSection onClose={closeMobileNavigation} />
            </div>
          </nav>
        )}
      </div>
    </header>


    {/* ── Mobile Bottom Dock ───────────────────────────── */}
    <NavMobileBar activeDrawer={activeDrawer} toggleDrawer={toggleDrawer} />

    {/* ── Mobile Sidebar Drawers ────────────────────────── */}
    <MobileDrawers />
    </>
  )
}

export default function Navbar() {
  const pathname = usePathname()

  return (
    <NavbarUiStateProvider key={pathname}>
      <NavbarContent />
    </NavbarUiStateProvider>
  )
}
