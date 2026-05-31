'use client'

import dynamic from 'next/dynamic'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import type { StickyStackPreviewMessage } from '@/components/note-board/views/StickyStackPreview'
import { NoteColorThemeProvider } from '@/components/note-board/contexts/NoteColorThemeContext'
import { useSiteConfig } from '@/components/SiteDataProvider'
import { createCommentRecord, type Comment } from '@/lib/comments'
import { fetchEngagementPublicApi } from '@/lib/engagement-public-api'
import { createGuestbookMessagesFromComments } from '@/lib/guestbook-comments'
import type { NoteBoardViewConfig } from '@/lib/note-board-config'
import { EYEBROW } from '@/components/cardSurface'
import type { HeroVariantProps } from '@/components/hero/hero-props'

const StickyStackPreview = dynamic(
  () => import('@/components/note-board/views/StickyStackPreview').then((m) => ({ default: m.StickyStackPreview })),
  { ssr: false },
)

const Live2D = dynamic(() => import('@/components/Live2D'), {
  ssr: false,
  loading: () => <div className="absolute z-10 hidden h-40 w-40 min-h-40 lg:block pointer-events-none" />,
})

const WelcomeAnimation = dynamic(() => import('@/components/WelcomeAnimation'), {
  ssr: false,
})

const HandwrittenSloganClient = dynamic(() => import('@/components/HandwrittenSloganClient'), {
  ssr: false,
})

function getGuestbookPreviewKey(board: NoteBoardViewConfig) {
  if (board.slug !== 'guestbook') {
    return null
  }

  return `guestbook-preview:${board.targetType}:${board.targetId}:${board.previewLimit}`
}

function trimPreviewMessage(message: StickyStackPreviewMessage): StickyStackPreviewMessage {
  return {
    id: message.id,
    visual_seed: message.visual_seed,
    author: message.author,
    content: message.content,
    created_at: message.created_at,
    updated_at: message.updated_at,
  }
}

export default function HeroAurora({ guestbookBoard, initialGuestbookMessages, slogan }: HeroVariantProps) {
  const siteConfig = useSiteConfig()
  const [isWelcomeActive, setIsWelcomeActive] = useState(true)
  // The two blob ornaments run an infinite 7s transform loop on desktop. Pause
  // them while the hero is off-screen so they stop burning GPU on long pages —
  // purely an optimization, so if IntersectionObserver is unavailable they just
  // keep animating (the prior behavior). Mobile/reduced-motion already opt out
  // via the `animate-blob` media query.
  const heroRef = useRef<HTMLDivElement>(null)
  const [blobsPaused, setBlobsPaused] = useState(false)
  useEffect(() => {
    const el = heroRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => setBlobsPaused(!entry.isIntersecting),
      { rootMargin: '0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const blobPauseClass = blobsPaused ? '[animation-play-state:paused]' : ''
  const guestbookPreviewFallback = useMemo(
    () => initialGuestbookMessages.slice(0, guestbookBoard.previewLimit).map(trimPreviewMessage),
    [guestbookBoard.previewLimit, initialGuestbookMessages],
  )
  const { data: guestbookPreviewMessages = guestbookPreviewFallback } = useSWR<StickyStackPreviewMessage[]>(
    getGuestbookPreviewKey(guestbookBoard),
    async () => {
      const searchParams = new URLSearchParams({
        target_type: guestbookBoard.targetType,
        target_id: guestbookBoard.targetId,
        archived: '0',
        limit: String(guestbookBoard.previewLimit),
        sort: 'time',
        direction: 'desc',
      })

      const response = await fetchEngagementPublicApi(`/api/comments?${searchParams.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to refresh guestbook preview')
      }

      const payload = await response.json().catch(() => null)
      if (!Array.isArray(payload)) {
        throw new Error('Invalid guestbook preview payload')
      }

      return createGuestbookMessagesFromComments(
        payload.map((entry) => createCommentRecord(entry as Comment)),
      ).map((message) => ({
        id: message.id,
        visual_seed: message.visual_seed,
        author: message.author,
        content: message.content,
        created_at: message.created_at,
        updated_at: message.updated_at,
      }))
    },
    {
      fallbackData: guestbookPreviewFallback,
      revalidateOnMount: false,
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
      focusThrottleInterval: 60_000,
    },
  )

  return (
    <div ref={heroRef} className="relative border-b border-border bg-background overflow-hidden">
      {/* Blob Ornaments */}
      <div className={`absolute top-0 left-1/4 w-72 h-72 bg-blob-1 rounded-full filter blur-2xl opacity-40 animate-blob pointer-events-none ${blobPauseClass}`}></div>
      <div className={`absolute -top-10 right-1/4 w-72 h-72 bg-blob-2 rounded-full filter blur-2xl opacity-40 animate-blob animation-delay-2000 pointer-events-none ${blobPauseClass}`}></div>

      <div className="site-shell-triad relative z-10 pt-14 pb-12 lg:pt-20 lg:pb-16">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[100px] md:inset-0 md:h-full flex items-center justify-center">
          {slogan ? (
            <HandwrittenSloganClient
              text1={slogan.text1}
              text2={slogan.text2}
              onComplete={() => setIsWelcomeActive(false)}
              className="mt-8 md:mt-0"
              size1="max(32px, min(6vw, 68px))"
              size2="max(20px, min(4vw, 46px))"
            />
          ) : (

            <WelcomeAnimation onFinish={() => setIsWelcomeActive(false)} />
          )}
        </div>


        <div className="pointer-events-none absolute inset-0 z-20 hidden lg:block">
          <NoteColorThemeProvider>
            <StickyStackPreview board={guestbookBoard} messages={guestbookPreviewMessages} />
          </NoteColorThemeProvider>
        </div>

        <div className="relative z-10">
          <p className={`mb-5 ${EYEBROW} text-[11px] transition-opacity duration-700 ${isWelcomeActive ? 'max-md:opacity-0' : 'max-md:opacity-100'}`}>
            {siteConfig.site_subtitle || 'Arthur & Grace · Journal'}
          </p>
          <h1 className="max-w-lg text-[2.25rem] font-bold leading-[1.2] tracking-tight text-foreground lg:text-[2.75rem]">
            <span className="block sm:inline text-gradient-primary">{siteConfig.site_title_highlight || '技术、生活与创意'}</span>
            {siteConfig.site_title_highlight_2 && (
              <>
                <br className="hidden sm:block" />
                <span className="block sm:inline text-gradient-primary">{siteConfig.site_title_highlight_2}</span>
              </>
            )}
            <br className="hidden sm:block" />
            <span className="block sm:inline">{siteConfig.site_title_rest || '的记录与分享'}</span>
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {siteConfig.site_description || '探索编程、设计、Life Lens 真实评价等领域的见解与思考。记录成长，分享知识，连接彼此。'}
          </p>
        </div>
        <Live2D />
      </div>
    </div>
  )
}
