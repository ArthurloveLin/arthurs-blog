'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw } from 'lucide-react'

type SyncState = 'idle' | 'success' | 'error'

export default function SpotifySyncButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [state, setState] = useState<SyncState>('idle')
  const [message, setMessage] = useState('')

  async function handleSync() {
    setMessage('')
    setState('idle')

    try {
      const response = await fetch('/api/spotify/sync', { method: 'POST' })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error ?? 'Spotify 同步失败')
      }

      setState('success')
      setMessage(`已写入 R2：最近播放 ${payload.summary.recentlyPlayed} 条，歌单 ${payload.summary.playlists} 个`)
      startTransition(() => {
        router.refresh()
      })
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Spotify 同步失败')
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={handleSync}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:border-emerald-500/45 hover:bg-emerald-500/14 disabled:opacity-60 dark:text-emerald-300"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            同步 Spotify 存档
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4" strokeWidth={2} />
            手动刷新归档
          </>
        )}
      </button>

      {message ? (
        <span className={`text-xs ${state === 'error' ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'}`}>
          {message}
        </span>
      ) : null}
    </div>
  )
}