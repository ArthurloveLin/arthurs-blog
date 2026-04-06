'use client'

import { createContext, useContext, ReactNode } from 'react'
import type { Post } from '@/lib/blog'

interface SiteState {
  config: Record<string, string>
  stats: {
    postsCount: number
    categoriesCount: number
    tagsCount: number
  }
  sidebarData: {
    categories: { name: string; count: number; slug: string }[]
    tags: { tag: string; count: number }[]
    yearArchive: { year: number; count: number }[]
    recentPosts: Post[]
  }
}

const SiteDataContext = createContext<SiteState | null>(null)

export function SiteDataProvider({
  children,
  initialState,
}: {
  children: ReactNode
  initialState: SiteState
}) {
  return (
    <SiteDataContext.Provider value={initialState}>
      {children}
    </SiteDataContext.Provider>
  )
}

export function useSiteData() {
  const context = useContext(SiteDataContext)
  if (!context) {
    throw new Error('useSiteData must be used within a SiteDataProvider')
  }
  return context
}
