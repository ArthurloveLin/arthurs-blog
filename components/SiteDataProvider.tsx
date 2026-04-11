'use client'

import { createContext, use, ReactNode } from 'react'
import type { Post } from '@/lib/blog'

export interface SiteState {
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

function useSiteDataContext() {
  const context = use(SiteDataContext)
  if (!context) {
    throw new Error('useSiteData must be used within a SiteDataProvider')
  }
  return context
}

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
  return useSiteDataContext()
}

export function useSiteConfig() {
  return useSiteDataContext().config
}

export function useSiteStats() {
  return useSiteDataContext().stats
}

export function useSiteCategories() {
  return useSiteDataContext().sidebarData.categories
}

export function useSiteTags() {
  return useSiteDataContext().sidebarData.tags
}

export function useSiteArchive() {
  return useSiteDataContext().sidebarData.yearArchive
}

export function useRecentPosts() {
  return useSiteDataContext().sidebarData.recentPosts
}
