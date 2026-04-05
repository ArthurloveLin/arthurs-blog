'use client'

import { useState } from 'react'

type SyncState = 'idle' | 'loading' | 'success' | 'error'

export default function ReindexButton() {
  const [state, setState] = useState<SyncState>('idle')
  const [message, setMessage] = useState('')

  async function handleSync() {
    setState('loading')
    setMessage('')
    try {
      const res = await fetch('/api/blog/reindex', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '同步失败')
      const { summary } = data
      setMessage(`已同步 ${summary.indexed} 篇，跳过 ${summary.skipped} 篇`)
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
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            同步中…
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
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
