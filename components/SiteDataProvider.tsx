'use client'

import { createContext, use, type ReactNode } from 'react'
import type { Post } from '@/lib/blog'

type SiteConfig = Record<string, string>
type SiteStats = {
  postsCount: number
  categoriesCount: number
  tagsCount: number
}
type SiteCategory = { name: string; count: number; slug: string }
type SiteTag = { tag: string; count: number }
type SiteArchiveYear = { year: number; count: number }

export interface SiteState {
  config: SiteConfig
  stats: SiteStats
  sidebarData: {
    categories: SiteCategory[]
    tags: SiteTag[]
    yearArchive: SiteArchiveYear[]
    recentPosts: Post[]
  }
}

const SiteDataContext = createContext<SiteState | null>(null)

function useRequiredContext<T>(contextValue: T | null, hookName: string) {
  if (!contextValue) {
    throw new Error(`${hookName} must be used within a SiteDataProvider`)
  }
  return contextValue
}

function useSiteState(hookName: string) {
  const context = use(SiteDataContext)
  return useRequiredContext(context, hookName)
}

export function SiteDataProvider({
  children,
  initialState,
}: {
  children: ReactNode
  initialState: SiteState
}) {
  return <SiteDataContext value={initialState}>{children}</SiteDataContext>
}

export function useSiteData() {
  return useSiteState('useSiteData')
}

export function useSiteConfig() {
  return useSiteState('useSiteConfig').config
}

export function useSiteStats() {
  return useSiteState('useSiteStats').stats
}

export function useSiteCategories() {
  return useSiteState('useSiteCategories').sidebarData.categories
}

export function useSiteTags() {
  return useSiteState('useSiteTags').sidebarData.tags
}

export function useSiteArchive() {
  return useSiteState('useSiteArchive').sidebarData.yearArchive
}

export function useRecentPosts() {
  return useSiteState('useRecentPosts').sidebarData.recentPosts
}
