'use client'

import { useState, useEffect, ReactNode } from 'react'

interface ScrollHideWrapperProps {
  children: ReactNode
  threshold?: number
  className?: string
}

/**
 * ScrollHideWrapper
 * Hides its content by collapsing height and fading out when scrolled beyond a threshold.
 * Used for the author profile card to "reveal" content below it.
 */
export default function ScrollHideWrapper({
  children,
  threshold = 200,
  className = "",
}: ScrollHideWrapperProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const handleScroll = () => {
      // Determine if it should be visible based on scroll position
      const currentScrollY = window.scrollY
      if (currentScrollY > threshold) {
        setIsVisible(false)
      } else {
        setIsVisible(true)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    // Initial check
    handleScroll()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [threshold])

  return (
    <div
      className={`transition-all duration-500 ease-in-out origin-top overflow-hidden ${
        isVisible 
          ? "opacity-100 max-h-[1000px] transform-none pointer-events-auto" 
          : "opacity-0 max-h-0 -translate-y-4 scale-95 pointer-events-none"
      } ${className}`}
    >
      {children}
    </div>
  )
}
