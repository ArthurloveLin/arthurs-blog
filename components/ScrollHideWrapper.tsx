'use client'

import { useState, useEffect, type ReactNode } from 'react'

export function useScrollTriggered(threshold: number) {
  // 初始值始终为 false，与 SSR 保持一致，避免 hydration mismatch
  const [isTriggered, setIsTriggered] = useState(false)

  useEffect(() => {
    // 不使用 startTransition：compact 切换不应触发 React ViewTransition，
    // 否则会引发全页视觉冻结，导致中间列出现跳动
    const handleScroll = () => setIsTriggered(window.scrollY > threshold)
    window.addEventListener('scroll', handleScroll, { passive: true })
    // 通过 rAF 回调初始化滚动状态，避免在 effect 内直接同步调用 setState
    const raf = requestAnimationFrame(handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      cancelAnimationFrame(raf)
    }
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


