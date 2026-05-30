'use client'

import { useLayoutEffect } from 'react'

// Ensures data-site-theme is always re-applied after React hydration.
// The inline <head> script sets it before first paint; this component restores it
// if React's hydration clears the attribute (which the inline script cannot prevent).
// useLayoutEffect (not useEffect) is critical: React 18/19 concurrent mode defers
// useEffect when a Suspense boundary is pending, which would delay the fix until
// after the Suspense resolves — causing the "wrong theme during loading" bug.
// Must be always-mounted — SiteThemePicker only lives inside the theme menus.
export function SiteThemeInitializer() {
  useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem('site-theme') || 'mono'
      document.documentElement.setAttribute('data-site-theme', stored)
    } catch {}
  }, [])
  return null
}
