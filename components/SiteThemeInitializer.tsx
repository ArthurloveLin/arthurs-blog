'use client'

import { useEffect } from 'react'

// Ensures data-site-theme is always re-applied after React hydration.
// The inline <head> script sets it before first paint; this component restores it
// if React's hydration clears the attribute (which the inline script cannot prevent).
// Must be always-mounted — SiteThemePicker only lives inside the theme menus.
export function SiteThemeInitializer() {
  useEffect(() => {
    try {
      const stored = localStorage.getItem('site-theme') || 'mono'
      document.documentElement.setAttribute('data-site-theme', stored)
    } catch {}
  }, [])
  return null
}
