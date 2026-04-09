'use client'

import { useState, useEffect, useLayoutEffect, ReactNode } from 'react'

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

  // 在首次绘制前同步校正初始状态，避免因页面带有滚动位置（如浏览器后退恢复）
  // 导致卡片先显示再折叠的闪烁与跳动
  useLayoutEffect(() => {
    setIsTriggered(window.scrollY > threshold)
  }, [threshold])

  useEffect(() => {
    // 不使用 startTransition：compact 切换不应触发 React ViewTransition，
    // 否则会引发全页视觉冻结，导致中间列出现跳动
    const handleScroll = () => {
      setIsTriggered(window.scrollY > threshold)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => window.removeEventListener('scroll', handleScroll)
  }, [threshold])

  const content = typeof children === 'function' ? children(isTriggered) : children

  return (
    <div
      className={`${vanish ? 'transition-all duration-500 ease-in-out' : ''} origin-top overflow-hidden ${
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
