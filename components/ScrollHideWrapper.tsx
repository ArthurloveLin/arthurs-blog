'use client'

import { useState, useEffect, ReactNode, startTransition } from 'react'

interface ScrollHideWrapperProps {
  children: ReactNode | ((isTriggered: boolean) => ReactNode)
  threshold?: number
  className?: string
  vanish?: boolean
}

/**
 * ScrollHideWrapper
 * Hides its content by collapsing height and fading out when scrolled beyond a threshold.
 * Or provides the scroll state to its children if vanish is false.
 */
export default function ScrollHideWrapper({
  children,
  threshold = 300,
  className = "",
  vanish = true,
}: ScrollHideWrapperProps) {
  const [isTriggered, setIsTriggered] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      startTransition(() => {
        setIsTriggered(currentScrollY > threshold)
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [threshold])

  const content = typeof children === 'function' ? children(isTriggered) : children

  return (
    <div
      className={`transition-all duration-500 ease-in-out origin-top overflow-hidden ${
        vanish
          ? isTriggered
            ? "opacity-0 max-h-0 -translate-y-4 scale-95 pointer-events-none"
            : "opacity-100 max-h-[1000px] transform-none pointer-events-auto"
          : "opacity-100 max-h-none transform-none pointer-events-auto"
      } ${className}`}
    >
      {content}
    </div>
  )
}
