'use client'

import { ComponentType } from 'react'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { X } from 'lucide-react'

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

const AuthorProfileCard = dynamic(drawerModuleLoaders.author, { ssr: false })
const CategoriesCard = dynamic(drawerModuleLoaders.categories, { ssr: false })
const TagsCloudCard = dynamic(drawerModuleLoaders.tags, { ssr: false })
const RecentPostsCard = dynamic(drawerModuleLoaders.recent, { ssr: false })
const ArchiveCard = dynamic(drawerModuleLoaders.archive, { ssr: false })
const ToolsCard = dynamic(drawerModuleLoaders.tools, { ssr: false })

export type DrawerType = 'author' | 'categories' | 'tags' | 'recent' | 'archive' | 'tools' | null

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

function AuthorDrawerPanel() {
  return <AuthorProfileCard id="mobile" />
}

function CategoriesDrawerPanel({ routeContext }: DrawerComponentProps) {
  return <CategoriesCard activeCategory={routeContext.activeCategory} />
}

function TagsDrawerPanel({ routeContext }: DrawerComponentProps) {
  return <TagsCloudCard activeTags={routeContext.activeTags} />
}

function RecentDrawerPanel() {
  return <RecentPostsCard />
}

function ArchiveDrawerPanel({ routeContext }: DrawerComponentProps) {
  return <ArchiveCard activeYear={routeContext.activeYear} />
}

function ToolsDrawerPanel() {
  return <ToolsCard id="mobile" />
}

const DRAWERS: Record<DrawerKey, DrawerDefinition> = {
  author: { title: '关于作者', Component: AuthorDrawerPanel },
  categories: { title: '文章分类', Component: CategoriesDrawerPanel },
  tags: { title: '标签云', Component: TagsDrawerPanel },
  recent: { title: '最新推文', Component: RecentDrawerPanel },
  archive: { title: '归档文章', Component: ArchiveDrawerPanel },
  tools: { title: '实用工具', Component: ToolsDrawerPanel },
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

export default function MobileDrawers({
  activeDrawer,
  setActiveDrawer,
}: {
  activeDrawer: DrawerType
  setActiveDrawer: (drawer: DrawerType) => void
}) {
  const pathname = usePathname()
  const isOpen = activeDrawer !== null
  const routeContext = getDrawerRouteContext(pathname)
  const activeDefinition = activeDrawer ? DRAWERS[activeDrawer] : null
  const ActiveDrawerPanel = activeDefinition?.Component

  return (
    <div className={`fixed inset-0 z-[999] md:hidden flex flex-col justify-end transition-[visibility] duration-200 ${isOpen ? 'visible' : 'invisible pointer-events-none'}`}>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={() => setActiveDrawer(null)}
      />
      {/* Drawer Content */}
      <div className={`relative w-full bg-background rounded-t-[2rem] shadow-[0_-8px_24px_rgba(0,0,0,0.22)] border-t border-border/40 p-5 pt-2 max-h-[85vh] overflow-y-auto transform-gpu will-change-transform [contain:layout_paint] transition-transform transition-opacity duration-200 ease-out ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
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
            onClick={() => setActiveDrawer(null)}
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
  )
}
