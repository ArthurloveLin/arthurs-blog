'use client'

import { useState, useEffect, ReactNode } from 'react'

function useScrollTriggered(threshold: number) {
  const [isTriggered, setIsTriggered] = useState(() =>
    typeof window !== 'undefined' && window.scrollY > threshold
  )

  useEffect(() => {
    // 不使用 startTransition：compact 切换不应触发 React ViewTransition，
    // 否则会引发全页视觉冻结，导致中间列出现跳动
    const handleScroll = () => setIsTriggered(window.scrollY > threshold)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [threshold])

  return isTriggered
}

/**
 * ScrollCollapseWrapper
 * Collapses (height + fade) its children when scrolled beyond a threshold.
 */
export default function ScrollCollapseWrapper({
  children,
  threshold = 300,
  className = '',
}: {
  children: ReactNode
  threshold?: number
  className?: string
}) {
  const isTriggered = useScrollTriggered(threshold)

  return (
    <div
      className={`transition-all duration-500 ease-in-out origin-top overflow-hidden ${
        isTriggered
          ? 'opacity-0 max-h-0 -translate-y-4 scale-95 pointer-events-none'
          : 'opacity-100 max-h-[1000px] transform-none pointer-events-auto'
      } ${className}`}
    >
      {children}
    </div>
  )
}

/**
 * ScrollStateWrapper
 * Exposes the scroll-triggered boolean to children via render prop.
 * Does not apply any visual changes itself.
 */
export function ScrollStateWrapper({
  children,
  threshold = 300,
}: {
  children: (isTriggered: boolean) => ReactNode
  threshold?: number
}) {
  const isTriggered = useScrollTriggered(threshold)
  return <>{children(isTriggered)}</>
}
