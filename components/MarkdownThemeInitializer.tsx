'use client'

import { useEffect } from 'react'

// Ensures data-md-theme is always re-applied after React hydration.
// The inline <head> script sets it before first paint; this component restores it
// if React's hydration clears the attribute (which the inline script cannot prevent).
// Must be always-mounted — MarkdownThemePicker is only in the mobile menu.
export function MarkdownThemeInitializer() {
  useEffect(() => {
    try {
      const stored = localStorage.getItem('md-theme') || 'mono'
      document.documentElement.setAttribute('data-md-theme', stored)
    } catch {}
  }, [])
  return null
}
