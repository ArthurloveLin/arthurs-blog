'use client'

import { useRouter } from 'next/navigation'
import { ReactNode, useEffect } from 'react'

interface BackButtonProps {
  fallback?: string
  className?: string
  children?: ReactNode
}

export default function BackButton({
  fallback = '/',
  className = "inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8",
  children = "← 返回"
}: BackButtonProps) {
  const router = useRouter()

  useEffect(() => {
    router.prefetch(fallback)
  }, [fallback, router])

  return (
    <button
      onClick={() => router.push(fallback)}
      className={className}
    >
      {children}
    </button>
  )
}
