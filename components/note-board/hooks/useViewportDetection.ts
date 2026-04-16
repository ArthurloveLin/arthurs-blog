import { useState, useEffect } from 'react'
import { MOBILE_VIEWPORT_MAX_WIDTH } from '@/components/note-board/utils/board'

export function useViewportDetection() {
  const [isMobileViewport, setIsMobileViewport] = useState<boolean | null>(null)
  const viewportReady = isMobileViewport !== null
  const isDesktopViewport = isMobileViewport === false

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_VIEWPORT_MAX_WIDTH}px)`)
    const syncViewport = () => setIsMobileViewport(mediaQuery.matches)

    syncViewport()
    mediaQuery.addEventListener('change', syncViewport)

    return () => {
      mediaQuery.removeEventListener('change', syncViewport)
    }
  }, [])

  return {
    isMobileViewport,
    isDesktopViewport,
    viewportReady,
  }
}
