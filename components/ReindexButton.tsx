'use client'

import { useState } from 'react'
import { Loader2, RefreshCw, Eraser } from 'lucide-react'

type ActionState = 'idle' | 'loading' | 'success' | 'error'

export default function ReindexButton() {
  const [syncState, setSyncState] = useState<ActionState>('idle')
  const [purgeState, setPurgeState] = useState<ActionState>('idle')
  const [message, setMessage] = useState('')
  const [msgType, setMsgType] = useState<'ok' | 'error'>('ok')

  const busy = syncState === 'loading' || purgeState === 'loading'

  async function handleSync() {
    setSyncState('loading')
    setMessage('')
    try {
      const res = await fetch('/api/blog/reindex', { method: 'POST' })
      const data = await res.json() as { error?: string; summary?: { indexed: number; skipped: number } }
      if (!res.ok) throw new Error(data.error ?? '同步失败')
      const { summary } = data
      setMessage(`已同步 ${summary?.indexed} 篇，跳过 ${summary?.skipped} 篇`)
      setMsgType('ok')
      setSyncState('success')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '同步失败')
      setMsgType('error')
      setSyncState('error')
    }
  }

  async function handlePurge() {
    if (!window.confirm('清空 Cloudflare 全量缓存？\n此操作将清除所有页面的 CDN 缓存，首批请求会回源。')) return
    setPurgeState('loading')
    setMessage('')
    try {
      const res = await fetch('/api/blog/reindex?purge=everything', { method: 'POST' })
      const data = await res.json() as { error?: string; cloudflare?: { success: boolean; errors?: string[] } }
      if (!res.ok) throw new Error(data.error ?? '清空失败')
      if (data.cloudflare && !data.cloudflare.success) {
        throw new Error(data.cloudflare.errors?.join('、') ?? '清空失败')
      }
      setMessage('CF 全量缓存已清空')
      setMsgType('ok')
      setPurgeState('success')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '清空失败')
      setMsgType('error')
      setPurgeState('error')
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handlePurge}
        disabled={busy}
        className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg transition duration-200 disabled:opacity-50"
        title="清空 Cloudflare 全量缓存（兜底备用）"
      >
        {purgeState === 'loading' ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
            清空中…
          </>
        ) : (
          <>
            <Eraser className="w-3.5 h-3.5" strokeWidth={2} />
            清空缓存
          </>
        )}
      </button>
      <button
        onClick={handleSync}
        disabled={busy}
        className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-muted-foreground hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 rounded-lg transition duration-200 disabled:opacity-50"
        title="从 R2 同步博客文章到数据库"
      >
        {syncState === 'loading' ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
            同步中…
          </>
        ) : (
          <>
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />
            同步文章
          </>
        )}
      </button>
      {message && (
        <span className={`text-xs animate-in fade-in relative top-0 slide-in-from-left-2 duration-300 ${msgType === 'error' ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'} transition-colors`}>
          {message}
        </span>
      )}
    </div>
  )
}
