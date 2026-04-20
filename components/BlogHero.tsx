'use client'

import dynamic from 'next/dynamic'
import React, { useState } from 'react'
import { StickyStackPreview } from '@/components/note-board/NoteBoardExperience'
import { useSiteConfig } from '@/components/SiteDataProvider'
import type { NoteBoardViewConfig } from '@/lib/note-board-config'
import type { NoteMessage } from '@/lib/note-boards'

const Live2D = dynamic(() => import('@/components/Live2D'), {
  ssr: false,
  loading: () => <div className="absolute z-10 hidden h-40 w-40 lg:block pointer-events-none" />,
})

const WelcomeAnimation = dynamic(() => import('@/components/WelcomeAnimation'), {
  ssr: false,
})

interface BlogHeroProps {
  guestbookBoard: NoteBoardViewConfig
  initialGuestbookMessages: NoteMessage[]
}

export default function BlogHero({ guestbookBoard, initialGuestbookMessages }: BlogHeroProps) {
  const siteConfig = useSiteConfig()
  const [isWelcomeActive, setIsWelcomeActive] = useState(true)

  return (
    <div className="relative border-b border-border bg-background overflow-hidden">
      {/* Blob Ornaments */}
      <div className="absolute top-0 left-1/4 w-72 h-72 bg-blob-1 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob dark:mix-blend-screen pointer-events-none"></div>
      <div className="absolute -top-10 right-1/4 w-72 h-72 bg-blob-2 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000 dark:mix-blend-screen pointer-events-none"></div>

      <div className="site-shell-triad relative z-10 pt-14 pb-12 lg:pt-20 lg:pb-16">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[100px] md:inset-0 md:h-full flex items-center justify-center">
          <WelcomeAnimation onFinish={() => setIsWelcomeActive(false)} />
        </div>

        <div className="pointer-events-none absolute inset-0 z-20 hidden lg:block">
          <StickyStackPreview board={guestbookBoard} messages={initialGuestbookMessages} />
        </div>

        <div className="relative z-10">
          <p className={`mb-5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-opacity duration-700 ${isWelcomeActive ? 'max-md:opacity-0' : 'max-md:opacity-100'}`}>
            {siteConfig.site_subtitle || 'Arthur & Grace · Journal'}
          </p>
          <h1 className="max-w-lg text-[2rem] font-bold leading-[1.2] tracking-tight text-foreground lg:text-[2.5rem]">
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
