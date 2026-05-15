'use client'

import { useEffect } from 'react'

export default function MarkdownThemeProvider() {
  useEffect(() => {
    // Sync state → DOM on mount (inline script already set the attribute before
    // first paint; this keeps it in sync if the user's storage changes mid-session)
    try {
      const saved = localStorage.getItem('md-theme')
      document.documentElement.setAttribute('data-md-theme', saved || 'mono')
    } catch {
      document.documentElement.setAttribute('data-md-theme', 'mono')
    }
  }, [])

  return null
}
