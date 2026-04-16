import { useCallback, useRef, useState, useEffect } from 'react'
import type { ToastNotice } from '@/components/note-board/types'

export function useNotifications() {
  const [toastNotice, setToastNotice] = useState<ToastNotice | null>(null)
  const [freshMessageIds, setFreshMessageIds] = useState<Record<string, boolean>>({})
  const toastTimerRef = useRef<number | null>(null)
  const freshTimerRefs = useRef<Record<string, number>>({})

  const showToast = useCallback((message: string) => {
    const nextNotice = { id: Date.now(), message }
    setToastNotice(nextNotice)

    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current)
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToastNotice((current) => current?.id === nextNotice.id ? null : current)
      toastTimerRef.current = null
    }, 2800)
  }, [])

  const markMessageFresh = useCallback((id: string) => {
    setFreshMessageIds((current) => ({ ...current, [id]: true }))

    if (freshTimerRefs.current[id]) {
      window.clearTimeout(freshTimerRefs.current[id])
    }

    freshTimerRefs.current[id] = window.setTimeout(() => {
      setFreshMessageIds((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
      delete freshTimerRefs.current[id]
    }, 900)
  }, [])

  useEffect(() => () => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current)
    }

    Object.values(freshTimerRefs.current).forEach((timer) => window.clearTimeout(timer))
  }, [])

  return {
    toastNotice,
    freshMessageIds,
    showToast,
    markMessageFresh,
  }
}
