'use client'

import { useLayoutEffect } from 'react'

/**
 * ScrollToTop
 * Forces the browser to the top of the page immediately on mount.
 * This is used to resolve issues where View Transitions or Next.js navigation
 * might fail to reset the scroll position, leading to layout shifts.
 */
export default function ScrollToTop() {
  useLayoutEffect(() => {
    // Force immediate scroll to top
    window.scrollTo(0, 0)
    
    // Some browsers or transitions might need a tiny delay or secondary check
    const timeout = setTimeout(() => window.scrollTo(0, 0), 0)
    return () => clearTimeout(timeout)
  }, [])

  return null
}
