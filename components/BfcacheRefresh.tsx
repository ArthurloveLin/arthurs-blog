'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * 当页面从浏览器 bfcache（前进/后退缓存）恢复时，
 * 调用 router.refresh() 强制重新从服务器拉取最新数据。
 * 
 * bfcache 完全在浏览器内存中，服务端 CDN-Cache-Control 对其无效，
 * 只有监听 pageshow 事件的 event.persisted 才能可靠检测。
 */
export default function BfcacheRefresh() {
  const router = useRouter()

  useEffect(() => {
    const handler = (e: PageTransitionEvent) => {
      if (e.persisted) router.refresh()
    }
    window.addEventListener('pageshow', handler)
    return () => window.removeEventListener('pageshow', handler)
  }, [router])

  return null
}
