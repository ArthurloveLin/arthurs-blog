'use client'
import { useRef, useEffect } from 'react'
import RecentPostsCard from '@/components/RecentPostsCard'
import ToolsCard from '@/components/ToolsCard'
import ArchiveCard from '@/components/ArchiveCard'

interface BlogSidebarRightProps {
  activeYear?: number | null
}

export default function BlogSidebarRight({ activeYear = null }: BlogSidebarRightProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!window.matchMedia('(min-width: 1024px)').matches) return
    const handleScroll = () => {
      if (window.scrollY === 0) {
        ref.current?.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <aside className="hidden lg:block lg:col-span-1">
      <div
        ref={ref}
        className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-none overscroll-contain pb-12 space-y-4"
      >
        <RecentPostsCard />
        <ToolsCard />
        <ArchiveCard activeYear={activeYear} />
      </div>
    </aside>
  )
}
