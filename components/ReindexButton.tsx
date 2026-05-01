'use client'

import { useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'

type SyncState = 'idle' | 'loading' | 'success' | 'error'

export default function ReindexButton() {
  const [state, setState] = useState<SyncState>('idle')
  const [message, setMessage] = useState('')

  async function handleSync() {
    setState('loading')
    setMessage('')
    try {
      const res = await fetch('/api/blog/reindex', { method: 'POST' })
      const data = await res.json() as { error?: string; summary?: { indexed: number; skipped: number } }
      if (!res.ok) throw new Error(data.error ?? '同步失败')
      const { summary } = data
      setMessage(`已同步 ${summary?.indexed} 篇，跳过 ${summary?.skipped} 篇`)
      setState('success')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '同步失败')
      setState('error')
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={state === 'loading'}
        className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 rounded-lg transition duration-200 disabled:opacity-50"
        title="从 R2 同步博客文章到数据库"
      >
        {state === 'loading' ? (
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
        <span className={`text-xs animate-in fade-in relative top-0 slide-in-from-left-2 duration-300 ${state === 'error' ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'} transition-colors`}>
          {message}
        </span>
      )}
    </div>
  )
}
