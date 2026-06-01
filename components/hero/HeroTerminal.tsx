'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import { NoteColorThemeProvider } from '@/components/note-board/contexts/NoteColorThemeContext'
import { useSiteConfig, useSiteStats } from '@/components/SiteDataProvider'
import type { HeroVariantProps } from '@/components/hero/hero-props'
import { Caret, OutMark, Prompt, row, TerminalCard, Typed } from '@/components/hero/TerminalWindow'

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

// Cumulative reveal delays (seconds). On page load when data-hero-variant="terminal"
// is set by the layout script, globals.css overrides these to 0.
const D = {
  cmd1: 0.05,
  out1: 0.5,
  cmd2: 0.8,
  title: 1.25,
  desc: 1.45,
  status: 1.75,
  caret: 2.0,
} as const

export default function HeroTerminal({ guestbookBoard, initialGuestbookMessages }: HeroVariantProps) {
  const config = useSiteConfig()
  const stats = useSiteStats()

  const subtitle = config.site_subtitle || 'Arthur & Grace · Journal'
  const titleHighlight = config.site_title_highlight || '技术、生活与创意'
  const titleHighlight2 = config.site_title_highlight_2 || ''
  const titleRest = config.site_title_rest || '的记录与分享'
  const description =
    config.site_description || '探索编程、设计、Life Lens 真实评价等领域的见解与思考。记录成长，分享知识，连接彼此。'

  const previewMessages = useMemo(
    () => initialGuestbookMessages.slice(0, guestbookBoard.previewLimit),
    [initialGuestbookMessages, guestbookBoard.previewLimit],
  )

  return (
    <div className="hero-term-root relative overflow-hidden border-b border-border bg-background">
      {/* Scanline texture */}
      <div className="hero-term-grid pointer-events-none absolute inset-0 z-0" aria-hidden />

      {/* Decoration layer: fills full section height so Live2D and sticky notes
          can hug bottom: 0 of the hero, independent of the terminal card height.
          Uses the same grid template + gap as the terminal card layer below. */}
      <div className="absolute inset-0 z-10 hidden lg:block">
        <div className="site-shell-triad h-full grid gap-6 grid-cols-[minmax(15rem,16rem)_minmax(0,48rem)_minmax(15rem,16rem)] justify-center">
          {/* Left: Live2D — absolute within this column, bottom:0% → section bottom */}
          <div className="relative">
            <Live2D />
          </div>
          {/* Center: spacer — terminal card sits above this in z-20 */}
          <div />
          {/* Right: sticky note preview */}
          <div className="pointer-events-none">
            <NoteColorThemeProvider>
              <StickyStackPreview board={guestbookBoard} messages={previewMessages} />
            </NoteColorThemeProvider>
          </div>
        </div>
      </div>

      {/* Terminal card: centered column with top/bottom padding, above decoration layer */}
      <div className="site-shell-triad relative z-20 pt-14 pb-12 lg:pt-20 lg:pb-16">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(15rem,16rem)_minmax(0,48rem)_minmax(15rem,16rem)] lg:justify-center">
          <div className="pointer-events-none hidden lg:block" />
          <TerminalCard>
            <p className="hero-term-line flex items-center gap-2" style={row(D.cmd1)}>
              <Prompt />
              <Typed text="whoami" delay={D.cmd1} />
            </p>
            <p className="hero-term-line flex items-start gap-2 text-muted-foreground" style={row(D.out1)}>
              <OutMark />
              <span>{subtitle}</span>
            </p>

            <p className="hero-term-line mt-3 flex items-center gap-2" style={row(D.cmd2)}>
              <Prompt />
              <Typed text="cat mission.txt" delay={D.cmd2} />
            </p>
            <h1
              className="hero-term-line mt-1 flex items-start gap-2 text-xl font-bold leading-snug tracking-tight sm:text-2xl"
              style={row(D.title)}
            >
              <OutMark />
              <span>
                <span className="text-primary">{titleHighlight}</span>
                {titleHighlight2 && <span className="text-primary">{titleHighlight2}</span>}
                <span className="text-foreground">{titleRest}</span>
              </span>
            </h1>
            <p
              className="hero-term-line mt-2 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground sm:text-[13px]"
              style={row(D.desc)}
            >
              <OutMark />
              <span className="max-w-xl">{description}</span>
            </p>

            {/* Status bar */}
            <div
              className="hero-term-line mt-5 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4 text-[11px] sm:text-xs"
              style={row(D.status)}
            >
              <StatChip value={stats.postsCount} label="posts" />
              <StatChip value={stats.tagsCount} label="tags" />
              <StatChip value={stats.categoriesCount} label="categories" />
              <span className="ml-auto min-w-0 max-w-full overflow-hidden text-ellipsis">
                <TerminalNowPlaying />
              </span>
            </div>

            {/* Live prompt */}
            <p className="hero-term-line mt-4 flex items-center gap-2 text-muted-foreground/80" style={row(D.caret)}>
              <Prompt />
              <Caret />
            </p>
          </TerminalCard>
          <div className="pointer-events-none hidden lg:block" />
        </div>
      </div>
    </div>
  )
}

function StatChip({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-muted-foreground">
      <span className="font-semibold text-foreground">{value}</span>
      {label}
    </span>
  )
}
