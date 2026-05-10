'use client'

import { createContext, useContext } from 'react'

interface BookShellOverlayContextValue {
  currentSlide: number
  setRightOverlay: (overlay: React.ReactNode | null) => void
}

const BookShellOverlayContext = createContext<BookShellOverlayContextValue | null>(null)
const BookShellSlideIndexContext = createContext<number | null>(null)
const BookShellRenderModeContext = createContext<'pixel' | 'page-turn'>('pixel')

export function BookShellOverlayProvider({
  value,
  children,
}: {
  value: BookShellOverlayContextValue
  children: React.ReactNode
}) {
  return <BookShellOverlayContext.Provider value={value}>{children}</BookShellOverlayContext.Provider>
}

export function BookShellSlideIndexProvider({
  index,
  children,
}: {
  index: number
  children: React.ReactNode
}) {
  return <BookShellSlideIndexContext.Provider value={index}>{children}</BookShellSlideIndexContext.Provider>
}

export function BookShellRenderModeProvider({
  mode,
  children,
}: {
  mode: 'pixel' | 'page-turn'
  children: React.ReactNode
}) {
  return <BookShellRenderModeContext.Provider value={mode}>{children}</BookShellRenderModeContext.Provider>
}

export function useBookShellOverlay() {
  const value = useContext(BookShellOverlayContext)

  if (!value) {
    throw new Error('useBookShellOverlay must be used within BookShellOverlayProvider')
  }

  return value
}

export function useBookShellSlideIndex() {
  const value = useContext(BookShellSlideIndexContext)

  if (value == null) {
    throw new Error('useBookShellSlideIndex must be used within BookShellSlideIndexProvider')
  }

  return value
}

export function useOptionalBookShellSlideIndex() {
  return useContext(BookShellSlideIndexContext)
}

export function useBookShellRenderMode() {
  return useContext(BookShellRenderModeContext)
}