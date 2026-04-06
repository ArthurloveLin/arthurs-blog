'use client'

import { useTransitionRouter } from 'next-view-transitions'
import { ReactNode } from 'react'

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
  const router = useTransitionRouter()

  return (
    <button
      onClick={(e) => {
        // Prevent default just in case it's used inside an anchor tag by mistake
        e.preventDefault()
        
        // If history length > 2 (usually means we navigated within the site), go back to restore scroll position.
        // Otherwise, fallback to the provided URL (default '/').
        if (window.history.length > 2) {
          router.back()
        } else {
          router.push(fallback)
        }
      }}
      className={className}
    >
      {children}
    </button>
  )
}
