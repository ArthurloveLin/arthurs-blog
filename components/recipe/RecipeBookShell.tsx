'use client'

import { useSyncExternalStore } from 'react'
import BookShell from './BookShell'
import type { BookmarkItem } from './BookShell'
import PageTurnBookShell from './PageTurnBookShell'
import { RecipeBookThemeProvider, type RecipeBookTheme } from './recipe-book-theme-context'

interface RecipeBookShellProps {
  children: React.ReactNode
  bookmarks?: BookmarkItem[]
  className?: string
}

const STORAGE_KEY = 'recipe-book-shell-theme'
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

export default function RecipeBookShell({ children, bookmarks, className }: RecipeBookShellProps) {
  const isClientReady = useSyncExternalStore(subscribeClientReady, () => true, () => false)
  const theme = useSyncExternalStore<RecipeBookTheme>(subscribeTheme, getThemeSnapshot, () => 'pixel')
  const isMobile = useSyncExternalStore(subscribeViewport, getViewportSnapshot, () => false)

  function setTheme(nextTheme: RecipeBookTheme) {
    window.localStorage.setItem(STORAGE_KEY, nextTheme)
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  }

  const activeTheme: RecipeBookTheme = isClientReady ? theme : 'pixel'
  const value = { isMobile, setTheme, theme: activeTheme }
  const shell = !isClientReady || isMobile || activeTheme === 'pixel'
    ? <BookShell bookmarks={bookmarks} className={className}>{children}</BookShell>
    : <PageTurnBookShell bookmarks={bookmarks} className={className}>{children}</PageTurnBookShell>

  return <RecipeBookThemeProvider value={value}>{shell}</RecipeBookThemeProvider>
}