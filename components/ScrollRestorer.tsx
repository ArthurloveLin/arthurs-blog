'use client'

import { useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * 挂载时从 sessionStorage 读取当前页面的滚动位置并恢复。
 * 配合 PrefetchOnHover 的 onClick 保存逻辑使用。
 */
export default function ScrollRestorer() {
  const pathname = usePathname()

  useLayoutEffect(() => {
    const key = `scroll-restore:${pathname}`
    const saved = sessionStorage.getItem(key)
    if (saved === null) return

    sessionStorage.removeItem(key)
    const y = Number(saved)
    if (!y) return

    // useLayoutEffect 在浏览器绘制前同步执行，避免先渲染顶部再跳位的闪烁
    window.scrollTo({ top: y, behavior: 'instant' })
  }, [pathname])

  return null
}
