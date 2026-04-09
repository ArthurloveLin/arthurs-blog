'use client'

import { useEffect, useState } from 'react'
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

const DRAWER_TITLES: Record<DrawerKey, string> = {
  author: '关于作者',
  categories: '文章分类',
  tags: '标签云',
  recent: '最新推文',
  archive: '归档文章',
  tools: '实用工具',
}

export default function MobileDrawers({
  activeDrawer,
  setActiveDrawer,
}: {
  activeDrawer: DrawerType
  setActiveDrawer: (drawer: DrawerType) => void
}) {
  const pathname = usePathname()
  const [mountedDrawers, setMountedDrawers] = useState<Partial<Record<DrawerKey, boolean>>>({})
  let activeCategory = null
  let activeYear: number | null = null
  let activeTags: string[] = []

  useEffect(() => {
    if (!activeDrawer) return

    setMountedDrawers((current) => {
      if (current[activeDrawer]) return current
      return { ...current, [activeDrawer]: true }
    })
  }, [activeDrawer])

  if (pathname.startsWith('/category/')) {
    activeCategory = decodeURIComponent(pathname.replace('/category/', ''))
  } else if (pathname.startsWith('/tag/')) {
    activeTags = [decodeURIComponent(pathname.replace('/tag/', ''))]
  } else if (pathname.startsWith('/archive/')) {
    activeYear = parseInt(pathname.replace('/archive/', ''), 10)
  }

  const isOpen = activeDrawer !== null

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
            {activeDrawer ? DRAWER_TITLES[activeDrawer] : ''}
          </h3>
          <button
            onClick={() => setActiveDrawer(null)}
            className="p-2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        <div className="pb-8 text-foreground">
          {mountedDrawers.author ? (
            <div className={activeDrawer === 'author' ? 'block' : 'hidden'} aria-hidden={activeDrawer !== 'author'}>
              <AuthorProfileCard id="mobile" />
            </div>
          ) : null}
          {mountedDrawers.categories ? (
            <div className={activeDrawer === 'categories' ? 'block' : 'hidden'} aria-hidden={activeDrawer !== 'categories'}>
              <CategoriesCard activeCategory={activeCategory} />
            </div>
          ) : null}
          {mountedDrawers.tags ? (
            <div className={activeDrawer === 'tags' ? 'block' : 'hidden'} aria-hidden={activeDrawer !== 'tags'}>
              <TagsCloudCard activeTags={activeTags} />
            </div>
          ) : null}
          {mountedDrawers.recent ? (
            <div className={activeDrawer === 'recent' ? 'block' : 'hidden'} aria-hidden={activeDrawer !== 'recent'}>
              <RecentPostsCard />
            </div>
          ) : null}
          {mountedDrawers.archive ? (
            <div className={activeDrawer === 'archive' ? 'block' : 'hidden'} aria-hidden={activeDrawer !== 'archive'}>
              <ArchiveCard activeYear={activeYear} />
            </div>
          ) : null}
          {mountedDrawers.tools ? (
            <div className={activeDrawer === 'tools' ? 'block' : 'hidden'} aria-hidden={activeDrawer !== 'tools'}>
              <ToolsCard id="mobile" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
