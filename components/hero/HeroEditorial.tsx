'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import { NoteColorThemeProvider } from '@/components/note-board/contexts/NoteColorThemeContext'
import { useSiteConfig, useSiteStats } from '@/components/SiteDataProvider'
import { EYEBROW } from '@/components/cardSurface'
import type { HeroVariantProps } from '@/components/hero/hero-props'

const Live2D = dynamic(() => import('@/components/Live2D'), {
  ssr: false,
  loading: () => <div className="absolute z-10 hidden h-40 w-40 min-h-40 lg:block pointer-events-none" />,
})

const TerminalNowPlaying = dynamic(() => import('@/components/hero/TerminalNowPlaying'), {
  ssr: false,
  loading: () => <span className="text-muted-foreground/40">♫ …</span>,
})

const StickyStackPreview = dynamic(
  () => import('@/components/note-board/views/StickyStackPreview').then((m) => ({ default: m.StickyStackPreview })),
  { ssr: false },
)

// Cumulative entrance delays (seconds): masthead rule → headline → lede → footer.
// `slogan` is intentionally ignored — the handwriting/welcome ornament belongs to
// the aurora skin; the Swiss editorial layout stays type-only (mirrors terminal).
const D = {
  masthead: 0.05,
  headline: 0.18,
  lede: 0.34,
  footer: 0.5,
} as const

const rise = (delay: number) => ({ animationDelay: `${delay}s` })

export default function HeroEditorial({ guestbookBoard, initialGuestbookMessages }: HeroVariantProps) {
  const config = useSiteConfig()
  const stats = useSiteStats()

  const subtitle = config.site_subtitle || "Arthur's Blog · Journal"
  const titleHighlight = config.site_title_highlight || '技术、生活与创意'
  const titleHighlight2 = config.site_title_highlight_2 || ''
  const titleRest = config.site_title_rest || '的记录与分享'
  const description =
    config.site_description || '探索编程、设计、Life Lens 真实评价等领域的见解与思考。记录成长，分享知识，连接彼此。'

  // Issue number derived from the post count — stable across SSR/CSR (no Date()),
  // and reads like a magazine masthead that grows as the archive does.
  const issue = String(stats.postsCount).padStart(3, '0')

  const previewMessages = useMemo(
    () => initialGuestbookMessages.slice(0, guestbookBoard.previewLimit),
    [initialGuestbookMessages, guestbookBoard.previewLimit],
  )

  return (
    <div className="hero-editorial-root relative overflow-hidden border-b border-border bg-background">
      <div className="site-shell-triad relative z-20 pt-14 pb-12 lg:pt-20 lg:pb-16">
        {/* Sticky-note overlay reads as letters-to-the-editor marginalia (lg only) */}
        <div className="pointer-events-none absolute inset-0 z-30 hidden lg:block">
          <NoteColorThemeProvider>
            <StickyStackPreview board={guestbookBoard} messages={previewMessages} />
          </NoteColorThemeProvider>
        </div>
        {/* Live2D: internal absolute z-10; parentElement = site-shell-triad for drag bounds */}
        <Live2D />

        <div className="relative z-10 max-w-4xl">
          {/* Masthead: running head + issue number, over a hairline rule */}
          <div className="hero-editorial-line" style={rise(D.masthead)}>
            <div className="flex items-baseline justify-between gap-4">
              <span className={`${EYEBROW} text-[11px]`}>{subtitle}</span>
              <span className={`${EYEBROW} shrink-0 text-[11px] text-foreground/70`} aria-hidden>
                № {issue}
              </span>
            </div>
            <div className="mt-3 h-px w-full bg-border" />
          </div>

          {/* Headline: Swiss grotesque — oversized, tight, left-aligned */}
          <h1
            className="hero-editorial-line mt-7 max-w-3xl text-[2.5rem] font-bold leading-[1.08] tracking-tight text-foreground sm:text-[3.25rem] lg:text-[4rem] lg:leading-[1.04]"
            style={rise(D.headline)}
          >
            <span className="text-primary">{titleHighlight}</span>
            {titleHighlight2 && <span className="text-primary">{titleHighlight2}</span>}
            <span className="text-foreground">{titleRest}</span>
          </h1>

          {/* Lede: the standfirst paragraph */}
          <p
            className="hero-editorial-line mt-6 max-w-xl text-base leading-relaxed text-muted-foreground"
            style={rise(D.lede)}
          >
            {description}
          </p>

          {/* Running foot: archive figures + now-playing, over a hairline rule */}
          <div className="hero-editorial-line mt-9" style={rise(D.footer)}>
            <div className="h-px w-full bg-border" />
            <div className={`${EYEBROW} mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]`}>
              <Figure value={stats.postsCount} label="Posts" />
              <span className="text-border" aria-hidden>/</span>
              <Figure value={stats.tagsCount} label="Tags" />
              <span className="text-border" aria-hidden>/</span>
              <Figure value={stats.categoriesCount} label="Categories" />
              <span className="ml-auto min-w-0 max-w-full overflow-hidden text-ellipsis normal-case tracking-normal">
                <TerminalNowPlaying />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-base font-semibold leading-none text-foreground">{value}</span>
      <span>{label}</span>
    </span>
  )
}
