'use client'

import { useSyncExternalStore } from 'react'
import dynamic from 'next/dynamic'
import type { BookmarkItem } from './BookShell'
import { RecipeBookThemeProvider, type RecipeBookTheme } from './recipe-book-theme-context'

const BookShell = dynamic(() => import('./BookShell'))
const PageTurnBookShell = dynamic(() => import('./PageTurnBookShell'))

interface RecipeBookShellProps {
  children: React.ReactNode
  bookmarks?: BookmarkItem[]
  className?: string
  initialTheme: RecipeBookTheme
  initialIsMobile: boolean
}

const STORAGE_KEY = 'recipe-book-shell-theme'
const COOKIE_KEY = 'recipe-book-shell-theme'
const MEDIA_QUERY = '(width < 768px)'
const THEME_CHANGE_EVENT = 'recipe-book-shell-theme-change'

function subscribeClientReady(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const frameId = window.requestAnimationFrame(() => {
    onStoreChange()
  })

  return () => {
    window.cancelAnimationFrame(frameId)
  }
}

function getThemeSnapshot(): RecipeBookTheme {
  if (typeof window === 'undefined') {
    return 'pixel'
  }

  const savedTheme = window.localStorage.getItem(STORAGE_KEY)
  return savedTheme === 'page-turn' || savedTheme === 'pixel' ? savedTheme : 'pixel'
}

function subscribeTheme(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handleChange = () => {
    onStoreChange()
  }

  window.addEventListener('storage', handleChange)
  window.addEventListener(THEME_CHANGE_EVENT, handleChange)

  return () => {
    window.removeEventListener('storage', handleChange)
    window.removeEventListener(THEME_CHANGE_EVENT, handleChange)
  }
}

function getViewportSnapshot() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.matchMedia(MEDIA_QUERY).matches
}

function subscribeViewport(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const mediaQuery = window.matchMedia(MEDIA_QUERY)
  const handleChange = () => {
    onStoreChange()
  }

  mediaQuery.addEventListener('change', handleChange)

  return () => {
    mediaQuery.removeEventListener('change', handleChange)
  }
}

export default function RecipeBookShell({ children, bookmarks, className, initialTheme, initialIsMobile }: RecipeBookShellProps) {
  const isClientReady = useSyncExternalStore(subscribeClientReady, () => true, () => false)
  const theme = useSyncExternalStore<RecipeBookTheme>(subscribeTheme, getThemeSnapshot, () => initialTheme)
  const isMobile = useSyncExternalStore(subscribeViewport, getViewportSnapshot, () => initialIsMobile)

  function setTheme(nextTheme: RecipeBookTheme) {
    window.localStorage.setItem(STORAGE_KEY, nextTheme)
    document.cookie = `${COOKIE_KEY}=${nextTheme}; path=/; max-age=31536000; SameSite=Lax`
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  }

  const activeTheme: RecipeBookTheme = isClientReady ? theme : initialTheme
  const value = { isMobile, setTheme, theme: activeTheme }
  
  const shell = isMobile || activeTheme === 'pixel'
    ? <BookShell bookmarks={bookmarks} className={className}>{children}</BookShell>
    : <PageTurnBookShell bookmarks={bookmarks} className={className}>{children}</PageTurnBookShell>

  return <RecipeBookThemeProvider value={value}>{shell}</RecipeBookThemeProvider>
}