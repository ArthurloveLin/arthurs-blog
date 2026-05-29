'use client'

import { useState, useCallback, useEffect } from 'react'
import type { SiteThemeId } from '@/lib/site-themes'
import { DEFAULT_SITE_THEME, SITE_THEME_IDS } from '@/lib/site-themes'

const STORAGE_KEY = 'site-theme'

function isSiteThemeId(value: string | null): value is SiteThemeId {
  return value != null && (SITE_THEME_IDS as readonly string[]).includes(value)
}

function readStoredTheme(): SiteThemeId {
  if (typeof window === 'undefined') return DEFAULT_SITE_THEME
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isSiteThemeId(stored) ? stored : DEFAULT_SITE_THEME
  } catch {
    return DEFAULT_SITE_THEME
  }
}

/**
 * Site-wide chrome hue, applied via the `data-site-theme` attribute on <html>.
 * Orthogonal to next-themes' light/dark `.dark` class — pick a hue here, a mode there.
 */
export function useSiteTheme() {
  const [theme, setThemeState] = useState<SiteThemeId>(readStoredTheme)

  // Re-apply after hydration in case React cleared the attribute set by the inline script
  useEffect(() => {
    document.documentElement.setAttribute('data-site-theme', theme)
  }, [theme])

  const setTheme = useCallback((id: SiteThemeId) => {
    setThemeState(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // ignore storage errors
    }
    document.documentElement.setAttribute('data-site-theme', id)
  }, [])

  return { theme, setTheme }
}
