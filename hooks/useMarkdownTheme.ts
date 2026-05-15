'use client'

import { useState, useCallback } from 'react'
import type { MarkdownThemeId } from '@/lib/markdown-themes'
import { DEFAULT_MARKDOWN_THEME } from '@/lib/markdown-themes'

const STORAGE_KEY = 'md-theme'

function readStoredTheme(): MarkdownThemeId {
  if (typeof window === 'undefined') return DEFAULT_MARKDOWN_THEME
  try {
    return (localStorage.getItem(STORAGE_KEY) as MarkdownThemeId | null) ?? DEFAULT_MARKDOWN_THEME
  } catch {
    return DEFAULT_MARKDOWN_THEME
  }
}

export function useMarkdownTheme() {
  const [theme, setThemeState] = useState<MarkdownThemeId>(readStoredTheme)

  const setTheme = useCallback((id: MarkdownThemeId) => {
    setThemeState(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // ignore storage errors
    }
    document.documentElement.setAttribute('data-md-theme', id)
  }, [])

  return { theme, setTheme }
}
