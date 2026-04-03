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
        className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-40 transition-colors"
      >
        {state === 'loading' ? '同步中…' : '同步文章'}
      </button>
      {message && (
        <span className={`text-xs ${state === 'error' ? 'text-red-400' : 'text-gray-400'}`}>
          {message}
        </span>
      )}
    </div>
  )
}
