'use client'

import { useLayoutEffect } from 'react'

// Ensures data-md-theme is always re-applied after React hydration.
// The inline <head> script sets it before first paint; this component restores it
// if React's hydration clears the attribute (which the inline script cannot prevent).
// useLayoutEffect (not useEffect): same reason as SiteThemeInitializer — avoids
// Suspense-induced deferral of effects that would otherwise delay the fix.
// Must be always-mounted — MarkdownThemePicker is only in the mobile menu.
export function MarkdownThemeInitializer() {
  useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem('md-theme') || 'mono'
      document.documentElement.setAttribute('data-md-theme', stored)
    } catch {}
  }, [])
  return null
}
