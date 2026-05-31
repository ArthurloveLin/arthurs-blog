'use client'

import dynamic from 'next/dynamic'
import { useSiteConfig, useSiteStats } from '@/components/SiteDataProvider'
import { Caret, OutMark, Prompt, row, TerminalWindow, Typed } from '@/components/hero/TerminalWindow'

const Live2D = dynamic(() => import('@/components/Live2D'), {
  ssr: false,
  loading: () => <div className="absolute z-10 hidden h-40 w-40 min-h-40 lg:block pointer-events-none" />,
})

// Lazy + ssr:false so a missing Spotify worker URL degrades to nothing instead
// of breaking the hero. Renders the now-playing status line.
const TerminalNowPlaying = dynamic(() => import('@/components/hero/TerminalNowPlaying'), {
  ssr: false,
  loading: () => <span className="text-muted-foreground/40">♫ …</span>,
})

// Cumulative reveal delays (seconds). Each row fades up; command rows also type
// their ASCII text with a steps() animation. prefers-reduced-motion disables it.
const D = {
  cmd1: 0.05,
  out1: 0.5,
  cmd2: 0.8,
  title: 1.25,
  desc: 1.45,
  status: 1.75,
  caret: 2.0,
} as const

export default function HeroTerminal() {
  const config = useSiteConfig()
  const stats = useSiteStats()

  const subtitle = config.site_subtitle || 'Arthur & Grace · Journal'
  const titleHighlight = config.site_title_highlight || '技术、生活与创意'
  const titleHighlight2 = config.site_title_highlight_2 || ''
  const titleRest = config.site_title_rest || '的记录与分享'
  const description =
    config.site_description || '探索编程、设计、Life Lens 真实评价等领域的见解与思考。记录成长，分享知识，连接彼此。'

  return (
    <TerminalWindow containerClass="site-shell-triad" corner={<Live2D />}>
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

      {/* Status bar — stats + live now-playing */}
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

      {/* Live prompt with blinking caret */}
      <p className="hero-term-line mt-4 flex items-center gap-2 text-muted-foreground/80" style={row(D.caret)}>
        <Prompt />
        <Caret />
      </p>
    </TerminalWindow>
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
