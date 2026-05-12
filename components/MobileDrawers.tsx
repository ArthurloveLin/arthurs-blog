'use client'

import { ComponentType } from 'react'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { X } from 'lucide-react'
import { useNavbarUiState, type DrawerType } from './NavbarUiState'

const drawerModuleLoaders = {
  author: () => import('./AuthorProfileCard'),
  categories: () => import('./CategoriesCard'),
  tags: () => import('./TagsCloudCard'),
  recent: () => import('./RecentPostsCard'),
  archive: () => import('./ArchiveCard'),
  tools: () => import('./ToolsCard'),
} as const

let drawerModulesPreloaded = false

export function preloadMobileDrawerModules() {
  if (drawerModulesPreloaded) return
  drawerModulesPreloaded = true

  Object.values(drawerModuleLoaders).forEach((loadModule) => {
    void loadModule()
  })
}

function DrawerSkeleton() {
  return (
    <div className="space-y-1 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2 px-1">
          <div className="w-8 h-8 rounded-lg bg-muted shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 bg-muted rounded w-3/4" />
            <div className="h-2 bg-muted rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

const AuthorProfileCard = dynamic(drawerModuleLoaders.author, { ssr: false, loading: DrawerSkeleton })
const CategoriesCard = dynamic(drawerModuleLoaders.categories, { ssr: false, loading: DrawerSkeleton })
const TagsCloudCard = dynamic(drawerModuleLoaders.tags, { ssr: false, loading: DrawerSkeleton })
const RecentPostsCard = dynamic(drawerModuleLoaders.recent, { ssr: false, loading: DrawerSkeleton })
const ArchiveCard = dynamic(drawerModuleLoaders.archive, { ssr: false, loading: DrawerSkeleton })
const ToolsCard = dynamic(drawerModuleLoaders.tools, { ssr: false, loading: DrawerSkeleton })

type DrawerKey = Exclude<DrawerType, null>

interface DrawerRouteContext {
  activeCategory: string | null
  activeTags: string[]
  activeYear: number | null
}

interface DrawerComponentProps {
  routeContext: DrawerRouteContext
}

interface DrawerDefinition {
  title: string
  Component: ComponentType<DrawerComponentProps>
}

const DRAWERS: Record<DrawerKey, DrawerDefinition> = {
  author: { title: '关于作者', Component: () => <AuthorProfileCard id="mobile" /> },
  categories: { title: '文章分类', Component: ({ routeContext }) => <CategoriesCard activeCategory={routeContext.activeCategory} /> },
  tags: { title: '标签云', Component: ({ routeContext }) => <TagsCloudCard activeTags={routeContext.activeTags} /> },
  recent: { title: '最新推文', Component: () => <RecentPostsCard /> },
  archive: { title: '归档文章', Component: ({ routeContext }) => <ArchiveCard activeYear={routeContext.activeYear} /> },
  tools: { title: '实用工具', Component: () => <ToolsCard id="mobile" /> },
}

function getDrawerRouteContext(pathname: string): DrawerRouteContext {
  let activeCategory: string | null = null
  let activeYear: number | null = null
  let activeTags: string[] = []

  if (pathname.startsWith('/category/')) {
    activeCategory = decodeURIComponent(pathname.replace('/category/', ''))
  } else if (pathname.startsWith('/tag/')) {
    activeTags = [decodeURIComponent(pathname.replace('/tag/', ''))]
  } else if (pathname.startsWith('/archive/')) {
    activeYear = parseInt(pathname.replace('/archive/', ''), 10)
  }

  return { activeCategory, activeTags, activeYear }
}

export default function MobileDrawers() {
  const pathname = usePathname()
  const { activeDrawer, closeDrawer } = useNavbarUiState()
  const isOpen = activeDrawer !== null
  const routeContext = getDrawerRouteContext(pathname)
  const activeDefinition = activeDrawer ? DRAWERS[activeDrawer] : null
  const ActiveDrawerPanel = activeDefinition?.Component

  useEffect(() => {
    if (!isOpen) return

    const { body, documentElement } = document
    const scrollY = window.scrollY
    const previousBodyOverflow = body.style.overflow
    const previousBodyPosition = body.style.position
    const previousBodyTop = body.style.top
    const previousBodyWidth = body.style.width
    const previousHtmlOverflow = documentElement.style.overflow

    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'
    documentElement.style.overflow = 'hidden'

    return () => {
      body.style.overflow = previousBodyOverflow
      body.style.position = previousBodyPosition
      body.style.top = previousBodyTop
      body.style.width = previousBodyWidth
      documentElement.style.overflow = previousHtmlOverflow
      window.scrollTo({ top: scrollY, behavior: 'auto' })
    }
  }, [isOpen])

  return (
    <div className={`fixed inset-0 z-[999] md:hidden flex flex-col justify-end transition-[visibility] duration-200 ${isOpen ? 'visible' : 'invisible pointer-events-none'}`}>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={closeDrawer}
      />
      {/* Drawer Content */}
      <div 
        className={`relative w-full bg-background rounded-t-[2rem] shadow-[0_-8px_24px_rgba(0,0,0,0.1)] border-t border-border/40 max-h-[85vh] transition-transform transition-opacity duration-200 ease-out flex flex-col overflow-hidden isolate ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
        style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}
      >
        <div className="flex-1 overflow-y-auto p-5 pt-2 select-none overscroll-behavior-contain">
          {/* Handle */}
          <div className="flex justify-center mb-5">
            <div className="w-12 h-1.5 bg-muted/50 rounded-full" />
          </div>
          
          {/* Header with Title and close button */}
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              {activeDefinition?.title ?? ''}
            </h3>
            <button
              onClick={closeDrawer}
              className="p-2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" strokeWidth={2} />
            </button>
          </div>

          <div className="pb-8 text-foreground">
            {ActiveDrawerPanel ? <ActiveDrawerPanel routeContext={routeContext} /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
