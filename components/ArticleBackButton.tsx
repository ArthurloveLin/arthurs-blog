'use client'

import Link from 'next/link'
import { startTransition, unstable_addTransitionType as addTransitionType, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

interface ArticleBackButtonProps {
  returnHref?: string
}

export default function ArticleBackButton({ returnHref = '/' }: ArticleBackButtonProps) {
  const router = useRouter()
  const prefetchHref = returnHref.split('#')[0] || '/'

  useEffect(() => {
    router.prefetch(prefetchHref)
  }, [prefetchHref, router])

  return (
    <Link
      href={returnHref}
      onClick={() => {
        startTransition(() => {
          addTransitionType('nav-back')
        })
      }}
      aria-label="返回上一页"
      className={[
        // Position: top-left of cover image
        'absolute top-4 left-4 z-10',
        // Layout
        'flex items-center gap-1.5',
        'px-3.5 py-2',
        // Shape
        'rounded-full',
        // Material — Matched with Navbar
        'bg-white/80 dark:bg-black/90',
        'backdrop-blur-md dark:backdrop-blur-none',
        'border border-black/5 dark:border-white/10',
        // Shadow: for elevation
        'shadow-sm hover:shadow-md',
        // Typography
        'text-[13px] font-medium tracking-tight',
        'text-foreground/80 hover:text-foreground',
        // Animation: Slower, more elegant entrance
        'animate-in fade-in slide-in-from-top-2 duration-700 delay-300 fill-mode-both',
        // Hover state
        'hover:bg-white dark:hover:bg-zinc-900',
        'hover:-translate-y-0.5',
        // Transition for interactions
        'transition-all duration-300 ease-out',
        // Group for icon animation
        'group',
      ].join(' ')}
    >
      {/* Arrow icon — moves left 2px on hover */}
      <ArrowLeft
        className="w-3.5 h-3.5 transition-transform duration-200 group-hover:-translate-x-0.5 flex-shrink-0 text-zinc-500 dark:text-zinc-400"
        strokeWidth={2.5}
      />
      返回
    </Link>
  )
}
