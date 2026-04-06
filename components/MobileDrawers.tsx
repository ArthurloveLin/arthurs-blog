'use client'

import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'

const AuthorProfileCard = dynamic(() => import('./AuthorProfileCard'), { ssr: false })
const CategoriesCard = dynamic(() => import('./CategoriesCard'), { ssr: false })
const TagsCloudCard = dynamic(() => import('./TagsCloudCard'), { ssr: false })
const RecentPostsCard = dynamic(() => import('./RecentPostsCard'), { ssr: false })
const ArchiveCard = dynamic(() => import('./ArchiveCard'), { ssr: false })
const ToolsCard = dynamic(() => import('./ToolsCard'), { ssr: false })

export type DrawerType = 'author' | 'categories' | 'tags' | 'recent' | 'archive' | 'tools' | null

export default function MobileDrawers({
  activeDrawer,
  setActiveDrawer,
}: {
  activeDrawer: DrawerType
  setActiveDrawer: (drawer: DrawerType) => void
}) {
  const pathname = usePathname()
  let activeCategory = null
  let activeYear: number | null = null
  let activeTags: string[] = []

  if (pathname.startsWith('/category/')) {
    activeCategory = decodeURIComponent(pathname.replace('/category/', ''))
  } else if (pathname.startsWith('/tag/')) {
    activeTags = [decodeURIComponent(pathname.replace('/tag/', ''))]
  } else if (pathname.startsWith('/archive/')) {
    activeYear = parseInt(pathname.replace('/archive/', ''), 10)
  }

  if (!activeDrawer) return null

  return (
    <div className="fixed inset-0 z-[999] md:hidden flex flex-col justify-end">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-md animate-fade-in transition-opacity" 
        onClick={() => setActiveDrawer(null)}
      />
      {/* Drawer Content */}
      <div className="relative w-full bg-background rounded-t-[2.5rem] shadow-[0_-8px_40px_rgba(0,0,0,0.5)] border-t border-border/50 p-6 pt-2 max-h-[88vh] overflow-y-auto animate-drawer-up">
        {/* Handle */}
        <div className="flex justify-center mb-6">
          <div className="w-12 h-1.5 bg-muted/50 rounded-full" />
        </div>
        
        {/* Header with Title and close button */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            {activeDrawer === 'author' && '关于作者'}
            {activeDrawer === 'categories' && '文章分类'}
            {activeDrawer === 'tags' && '标签云'}
            {activeDrawer === 'recent' && '最新推文'}
            {activeDrawer === 'archive' && '归档文章'}
            {activeDrawer === 'tools' && '实用工具'}
          </h3>
          <button 
            onClick={() => setActiveDrawer(null)}
            className="p-2 text-muted-foreground hover:text-foreground"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="pb-8 text-foreground" onClick={() => setActiveDrawer(null)}>
          {activeDrawer === 'author' && <AuthorProfileCard />}
          {activeDrawer === 'categories' && <CategoriesCard activeCategory={activeCategory} />}
          {activeDrawer === 'tags' && <TagsCloudCard activeTags={activeTags} />}
          {activeDrawer === 'recent' && <RecentPostsCard />}
          {activeDrawer === 'archive' && <ArchiveCard activeYear={activeYear} />}
          {activeDrawer === 'tools' && <ToolsCard />}
        </div>
      </div>
    </div>
  )
}
