'use client'

import Link from 'next/link'
import { useEffect, useCallback, useRef, startTransition, useSyncExternalStore, useTransition, type CSSProperties, type MouseEvent } from 'react'
import gsap from 'gsap'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { LucideIcon } from 'lucide-react'
import { GUEST_AUTH_STATE, useAuth } from '@/components/AuthProvider'
import { logout } from '@/app/auth/logout/actions'
import { useTheme } from 'next-themes'
import { useSiteConfig } from './SiteDataProvider'
import { Menu, X, Settings, User, LayoutList, Tag, Clock, Archive, Wrench, Sun, Moon } from 'lucide-react'
import NavbarSearch from './NavbarSearch'
import {
  BLOG_RETURN_CURRENT_POST_ID_KEY,
  BLOG_RETURN_CURRENT_POST_SLUG_KEY,
  BLOG_RETURN_PATHNAME_KEY,
  BLOG_RETURN_POST_SLUG_KEY,
  BLOG_RETURN_TARGET_EVENT,
  getPostAnchorHref,
} from '@/lib/blog-return'

const ThemeToggle = dynamic(() => import('./ThemeToggle'), { ssr: false })
const MarkdownThemePicker = dynamic(() => import('./MarkdownThemePicker'), { ssr: false })
const SiteThemePicker = dynamic(() => import('./SiteThemePicker'), { ssr: false })
const HeroVariantPicker = dynamic(() => import('./HeroVariantPicker'), { ssr: false })
import MobileDrawers, { preloadMobileDrawerModules } from './MobileDrawers'
import { NavbarUiStateProvider, useNavbarUiState, type DrawerType } from './NavbarUiState'
import { ChangelogBadge } from './ChangelogBadge'

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
  { href: '/spotify', label: 'Music Library', tooltip: 'Music Library - Spotify 数据仪表盘', external: false },
]

const mobileDrawerItems: DrawerToggleItem[] = [
  { key: 'author', label: '作者', Icon: User },
  { key: 'categories', label: '分类', Icon: LayoutList },
  { key: 'tags', label: '标签', Icon: Tag },
  { key: 'recent', label: '最新', Icon: Clock },
  { key: 'archive', label: '归档', Icon: Archive },
  { key: 'tools', label: '工具', Icon: Wrench },
]

type ViewTransitionStyle = CSSProperties & {
  viewTransitionName: string
}

const NAVBAR_BOTTOM_TRANSITION_STYLE: ViewTransitionStyle = {
  viewTransitionName: 'navbar-bottom',
}

function getDrawerButtonClass(isActive: boolean) {
  // Active background is drawn by the shared sliding pill in NavMobileBar; the
  // button only owns its text color (+ a hover bg for the inactive ones).
  return `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'}`
}

function getNavLinkClass(isActive: boolean) {
  return `px-4 py-2 text-sm font-medium rounded-lg transition duration-200 ${isActive ? 'text-primary bg-primary/10' : 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'}`
}

function isNavLinkActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function AdminRoleBadge() {
  return (
    <span className="text-xs font-semibold px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-md">
      管理员
    </span>
  )
}

// Hydration-safe mount flag: getServerSnapshot returns false so SSR + the first
// client render agree; it flips true only after hydration. The guest display name
// comes from localStorage (getOrCreateGuestId), which is empty on the server and
// populated on the client — rendering it during hydration changes the DOM shape
// (<a> only → <span> + <a>) and triggers React #418, which regenerates the WHOLE
// client tree. That regeneration is what was rebuilding the hero (animation replay)
// and resetting <html data-site-theme> (hue flash). Gate it behind hydration.
const subscribeNoop = () => () => {}
function useHydrated() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false)
}

function GuestIdentity({ guestDisplayName }: { guestDisplayName: string }) {
  const hydrated = useHydrated()
  if (!hydrated || !guestDisplayName) return null

  return (
    <span className="text-xs text-muted-foreground font-mono">
      游客&nbsp;{guestDisplayName}
    </span>
  )
}

function DesktopGuestAuth({ guestDisplayName }: { guestDisplayName: string }) {
  return (
    <>
      <GuestIdentity guestDisplayName={guestDisplayName} />
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
      <LogoutButton className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 rounded-lg transition duration-200" />
    </>
  )
}

function MobileGuestAuth({ guestDisplayName, onClose }: { guestDisplayName: string; onClose: () => void }) {
  const hydrated = useHydrated()
  const suffix = hydrated && guestDisplayName ? `（游客 ${guestDisplayName}）` : ''
  return (
    <Link
      href="/auth/login"
      className="block px-4 py-2.5 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-foreground/5 rounded-lg transition duration-200"
      onClick={onClose}
    >
      登录{suffix}
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
      <LogoutButton
        className="text-sm text-muted-foreground hover:text-foreground"
        onComplete={onClose}
      />
    </div>
  )
}

function LogoutButton({
  className,
  onComplete,
}: {
  className: string
  onComplete?: () => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { refreshAuth, syncAuth } = useAuth()
  const [isPending, startLogoutTransition] = useTransition()

  const handleLogout = () => {
    if (isPending) {
      return
    }

    startLogoutTransition(async () => {
      const result = await logout()

      if (result?.error) {
        console.error('Failed to log out:', result.error)
        return
      }

      syncAuth(GUEST_AUTH_STATE)
      onComplete?.()
      void refreshAuth()

      if (pathname !== '/') {
        router.replace('/')
      }

      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className={className}
      aria-busy={isPending}
    >
      {isPending ? '退出中…' : '退出'}
    </button>
  )
}

function NavDesktopAuthStatus() {
  const { role, displayName, email, loading, guestDisplayName } = useAuth()

  if (loading) return null

  return (
    <div className="hidden sm:flex items-center gap-1.5 ml-1">
      {role === 'guest'
        ? <DesktopGuestAuth guestDisplayName={guestDisplayName} />
        : <DesktopSignedInAuth displayName={displayName} email={email} isAdmin={role === 'admin'} />}
    </div>
  )
}

function NavMobileAuthSection({ onClose }: { onClose: () => void }) {
  const { role, displayName, email, loading, guestDisplayName } = useAuth()

  if (loading) return null

  return (
    <>
      {role === 'guest'
        ? <MobileGuestAuth guestDisplayName={guestDisplayName} onClose={onClose} />
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
  const rowRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)

  // Slide a shared pill to the active tab (desktop already has an active
  // indicator; this brings the mobile dock to parity). Position is measured
  // from layout (getBoundingClientRect relative to the row) so dividers/nesting
  // don't throw it off; text-primary on the active button is the fallback if the
  // pill is ever mid-flight. No active drawer → fade out. reduced-motion → snap.
  useEffect(() => {
    const row = rowRef.current
    const pill = pillRef.current
    if (!row || !pill) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const active = row.querySelector<HTMLElement>('[data-dock-active="true"]')

    if (!active) {
      gsap.to(pill, { autoAlpha: 0, duration: reduce ? 0 : 0.18, ease: 'power2.out' })
      return
    }

    const rowBox = row.getBoundingClientRect()
    const box = active.getBoundingClientRect()
    gsap.to(pill, {
      x: box.left - rowBox.left,
      y: box.top - rowBox.top,
      width: box.width,
      height: box.height,
      autoAlpha: 1,
      duration: reduce ? 0 : 0.34,
      ease: 'power3.out',
    })
  }, [activeDrawer])

  return (
    <div
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[var(--z-header)] md:hidden"
      style={NAVBAR_BOTTOM_TRANSITION_STYLE}
    >
      <div
        ref={rowRef}
        className={
        "relative flex items-center gap-0.5 px-2 py-1.5 " +
        "bg-card/94 border border-border backdrop-blur-none " +
        "rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.32)]"
      }>
        <span
          ref={pillRef}
          aria-hidden
          style={{ opacity: 0 }}
          className="pointer-events-none absolute left-0 top-0 z-0 rounded-full bg-primary/10"
        />
        {mobileDrawerItems.map(({ key, label, Icon }, index) => (
          <div key={key} className="relative z-10 flex items-center">
            {index > 0 && <div className="w-px h-5 bg-border/60 mx-0.5" />}
            <button
              onClick={() => toggleDrawer(key)}
              data-dock-active={activeDrawer === key ? 'true' : undefined}
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
  const { resolvedTheme, setTheme } = useTheme()
  const pathname = usePathname()
  const {
    activeDrawer,
    closeDrawer,
    closeMobileMenu,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    toggleDrawer: toggleDrawerInternal,
    isSearching,
  } = useNavbarUiState()

  const mobileMenuRef = useRef<HTMLElement>(null)

  const isPWA = useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia('(display-mode: standalone)')
      mq.addEventListener('change', notify)
      return () => mq.removeEventListener('change', notify)
    },
    () => window.matchMedia('(display-mode: standalone)').matches,
    () => false,
  )

  const isNowWatchingPage = pathname === '/now-watching'
  const isMemoStandalone = isPWA && pathname === '/memo'

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
  const desktopChromeClass = isSearching
    ? 'opacity-0 pointer-events-none translate-y-1'
    : 'opacity-100 translate-y-0'

  const handleHomeClick = useCallback(() => {
    if (!isOnArticle) return

    const currentPostSlug = sessionStorage.getItem(BLOG_RETURN_CURRENT_POST_SLUG_KEY)
    if (currentPostSlug) {
      sessionStorage.setItem(BLOG_RETURN_PATHNAME_KEY, '/')
      sessionStorage.setItem(BLOG_RETURN_POST_SLUG_KEY, currentPostSlug)
    }
  }, [isOnArticle])

  const handleBrandClick = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    if (isMemoStandalone) {
      event.preventDefault()
      // In memo standalone mode, force a real page reload so the click has
      // immediate, visible feedback while staying on /memo.
      window.location.reload()
      return
    }

    handleHomeClick()
  }, [handleHomeClick, isMemoStandalone])

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

  // Mobile menu entrance: stagger the rows down on open instead of the old
  // hard mount. Opacity/transform only (no height measurement), scoped via
  // gsap.context so it self-reverts on close/unmount; reduced-motion skips it.
  // Close stays an instant unmount — the reveal is where the delight lives.
  useEffect(() => {
    if (!isMobileMenuOpen) return
    const el = mobileMenuRef.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ctx = gsap.context(() => {
      gsap.from(el, { autoAlpha: 0, y: -6, duration: 0.2, ease: 'power2.out' })
      gsap.from('[data-mobile-nav-item]', {
        autoAlpha: 0,
        y: -8,
        duration: 0.28,
        ease: 'power2.out',
        stagger: 0.035,
        delay: 0.04,
        // Hand opacity/visibility/transform back to CSS on finish so nothing
        // lingers half-applied. (The rows must NOT carry a Tailwind `transition`
        // on opacity/transform, or that CSS transition fights these per-frame
        // writes and the later-staggered rows never settle — they strand near
        // opacity:0. They use `transition-colors` for exactly this reason.)
        clearProps: 'opacity,visibility,transform',
      })
    }, el)
    return () => ctx.revert()
  }, [isMobileMenuOpen])

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
          "sticky top-0 z-[var(--z-header)] border-b border-border transition-colors duration-300 " +
        // 用主题驱动的卡面色 + 高不透明度，去除 backdrop-blur（sticky header 上的实时模糊
        // 是滚动卡顿的最大单点来源）。bg-card 在亮/暗与 8 套色相下自动跟随，比硬编码白/黑更一致
        "bg-card/95 backdrop-blur-none"
      }
    >
      <div className="site-shell">
        <div className="h-16 flex items-center justify-between gap-4">

          {/* ── Left: Logo / Title ─────────────────────────────────── */}
          <div className="flex items-center gap-2 flex-shrink-0">
          <Link 
            href={isMemoStandalone ? '/memo' : homeHref}
            onClick={handleBrandClick}
            className={`flex items-center gap-2.5 flex-shrink-0 group`}
          >
            <div className="w-8 h-8 relative flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              {/* Elegant Blur Glow */}
              <div className="absolute inset-0 rounded-xl bg-gradient-primary opacity-0 group-hover:opacity-40 blur-md group-hover:blur-lg transition-all duration-500 scale-50 group-hover:scale-125" />
              
              <div className="w-full h-full relative rounded-xl bg-card border border-border flex items-center justify-center shadow-sm overflow-hidden z-10">
                {(isMemoStandalone || logoUrl) ? (
                  <Image
                    src={isMemoStandalone ? '/icons/notes.png' : logoUrl!}
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
              {isMemoStandalone ? 'Memo' : 'Arthur & Grace'}
            </span>
          </Link>
          <ChangelogBadge />
          </div>

          {/* ── Center: Navigation Links ───────────────────────────── */}
          <nav
            aria-hidden={isSearching || isMemoStandalone}
            className={`hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2 transition-[opacity,transform] duration-200 ${desktopChromeClass} ${isMemoStandalone ? 'invisible pointer-events-none' : ''}`}
          >
            {navLinks.map((link) =>
              link.external ? (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={getNavLinkClass(isNavLinkActive(pathname, link.href))}
                  title={link.tooltip}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href === '/' ? homeHref : link.href}
                  onClick={link.href === '/' ? handleHomeClick : undefined}
                  className={getNavLinkClass(isNavLinkActive(pathname, link.href))}
                  aria-current={isNavLinkActive(pathname, link.href) ? 'page' : undefined}
                  title={link.tooltip}
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>

          {/* ── Right: Icons ───────────────────────────────────────── */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <div
              aria-hidden={isSearching}
              className={`hidden md:flex items-center gap-1 transition-[opacity,transform] duration-200 ${desktopChromeClass}`}
            >
              {!isMemoStandalone && <NavbarSearch />}
              <ThemeToggle />
              <NavDesktopAuthStatus />
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={toggleMobileMenu}
              className={`md:hidden p-2 text-foreground/60 hover:text-foreground hover:bg-foreground/5 rounded-lg transition duration-200 ${isSearching ? 'animate-apple-fade-out delay-out-8' : 'animate-apple-fade-in delay-in-8'}`}
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
          <nav ref={mobileMenuRef} className="md:hidden pb-4 pt-2 border-t border-border bg-card">
            <div className="space-y-0.5">
              {navLinks.map((link) =>
                link.external ? (
                  <a
                    key={link.href}
                    data-mobile-nav-item
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${isNavLinkActive(pathname, link.href) ? 'text-primary bg-primary/10' : 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'}`}
                    onClick={closeMobileNavigation}
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    data-mobile-nav-item
                    href={link.href === '/' ? homeHref : link.href}
                    onClick={() => {
                      if (link.href === '/') handleHomeClick()
                      closeMobileNavigation()
                    }}
                    className={`block px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${isNavLinkActive(pathname, link.href) ? 'text-primary bg-primary/10' : 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'}`}
                  >
                    {link.label}
                  </Link>
                )
              )}
              <div data-mobile-nav-item className="px-4 py-2.5 space-y-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">外观</div>
                <div className="flex gap-1 p-1 rounded-lg bg-muted">
                  <button
                    onClick={() => setTheme('light')}
                    aria-pressed={resolvedTheme !== 'dark'}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                      resolvedTheme !== 'dark'
                        ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" strokeWidth={2} />
                    浅色
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    aria-pressed={resolvedTheme === 'dark'}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                      resolvedTheme === 'dark'
                        ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" strokeWidth={2} />
                    深色
                  </button>
                </div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">全站主题</div>
                <SiteThemePicker />
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">文字主题</div>
                <MarkdownThemePicker />
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">首页样式</div>
                <HeroVariantPicker />
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
