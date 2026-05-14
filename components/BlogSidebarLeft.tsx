'use client'
import { useRef, useEffect, ViewTransition } from 'react'
import { SidebarAuthorProfileCard } from '@/components/AuthorProfileCard'
import CategoriesCard from '@/components/CategoriesCard'
import TagsCloudCard from '@/components/TagsCloudCard'
import { useScrollTriggered } from '@/components/ScrollHideWrapper'

interface BlogSidebarLeftProps {
  activeCategory?: string | null
  activeTags?: string[]
}

function SidebarAuthorCard() {
  const isTriggered = useScrollTriggered(300)
  return (
    <ViewTransition name="sidebar-author-card">
      <SidebarAuthorProfileCard id="sidebar" collapsed={isTriggered} />
    </ViewTransition>
  )
}

export default function BlogSidebarLeft({ activeCategory = null, activeTags = [] }: BlogSidebarLeftProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!window.matchMedia('(min-width: 768px)').matches) return
    const handleScroll = () => {
      if (window.scrollY === 0) {
        ref.current?.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <aside className="hidden md:block md:col-span-4 lg:col-span-1">
      <div
        ref={ref}
        className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-none overscroll-contain pb-12 space-y-4"
      >
        <SidebarAuthorCard />
        <CategoriesCard activeCategory={activeCategory} />
        <TagsCloudCard activeTags={activeTags} />
      </div>
    </aside>
  )
}
