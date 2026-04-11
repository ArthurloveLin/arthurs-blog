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

const SiteConfigContext = createContext<SiteConfig | null>(null)
const SiteStatsContext = createContext<SiteStats | null>(null)
const SiteCategoriesContext = createContext<SiteCategory[] | null>(null)
const SiteTagsContext = createContext<SiteTag[] | null>(null)
const SiteArchiveContext = createContext<SiteArchiveYear[] | null>(null)
const RecentPostsContext = createContext<Post[] | null>(null)

function useRequiredContext<T>(contextValue: T | null, hookName: string) {
  if (!contextValue) {
    throw new Error(`${hookName} must be used within a SiteDataProvider`)
  }
  return contextValue
}

function useSiteConfigContext() {
  const context = use(SiteConfigContext)
  return useRequiredContext(context, 'useSiteConfig')
}

function useSiteStatsContext() {
  const context = use(SiteStatsContext)
  return useRequiredContext(context, 'useSiteStats')
}

function useSiteCategoriesContext() {
  const context = use(SiteCategoriesContext)
  return useRequiredContext(context, 'useSiteCategories')
}

function useSiteTagsContext() {
  const context = use(SiteTagsContext)
  return useRequiredContext(context, 'useSiteTags')
}

function useSiteArchiveContext() {
  const context = use(SiteArchiveContext)
  return useRequiredContext(context, 'useSiteArchive')
}

function useRecentPostsContext() {
  const context = use(RecentPostsContext)
  return useRequiredContext(context, 'useRecentPosts')
}

export function SiteDataProvider({
  children,
  initialState,
}: {
  children: ReactNode
  initialState: SiteState
}) {
  return (
    <SiteConfigContext.Provider value={initialState.config}>
      <SiteStatsContext.Provider value={initialState.stats}>
        <SiteCategoriesContext.Provider value={initialState.sidebarData.categories}>
          <SiteTagsContext.Provider value={initialState.sidebarData.tags}>
            <SiteArchiveContext.Provider value={initialState.sidebarData.yearArchive}>
              <RecentPostsContext.Provider value={initialState.sidebarData.recentPosts}>
                {children}
              </RecentPostsContext.Provider>
            </SiteArchiveContext.Provider>
          </SiteTagsContext.Provider>
        </SiteCategoriesContext.Provider>
      </SiteStatsContext.Provider>
    </SiteConfigContext.Provider>
  )
}

export function useSiteData() {
  return {
    config: useSiteConfigContext(),
    stats: useSiteStatsContext(),
    sidebarData: {
      categories: useSiteCategoriesContext(),
      tags: useSiteTagsContext(),
      yearArchive: useSiteArchiveContext(),
      recentPosts: useRecentPostsContext(),
    },
  }
}

export function useSiteConfig() {
  return useSiteConfigContext()
}

export function useSiteStats() {
  return useSiteStatsContext()
}

export function useSiteCategories() {
  return useSiteCategoriesContext()
}

export function useSiteTags() {
  return useSiteTagsContext()
}

export function useSiteArchive() {
  return useSiteArchiveContext()
}

export function useRecentPosts() {
  return useRecentPostsContext()
}
