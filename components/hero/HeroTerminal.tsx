'use client'

import dynamic from 'next/dynamic'
import type { CSSProperties } from 'react'
import { useSiteConfig, useSiteStats } from '@/components/SiteDataProvider'

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

// Cumulative reveal delays (seconds). Each row fades up; command rows also
// type their ASCII text with a steps() animation. Tuned to read as a live
// shell streaming output. prefers-reduced-motion disables all of it in CSS.
const D = {
  cmd1: 0.05,
  out1: 0.5,
  cmd2: 0.8,
  title: 1.25,
  desc: 1.45,
  status: 1.75,
  caret: 2.0,
} as const

function row(delay: number): CSSProperties {
  return { animationDelay: `${delay}s` }
}

// A typed ASCII command. width:Nch + steps(N) gives the per-character reveal;
// backwards fill holds it at width:0 through the delay so it doesn't flash full.
function Typed({ text, delay }: { text: string; delay: number }) {
  return (
    <span
      className="hero-term-typed"
      style={{ width: `${text.length}ch`, animationTimingFunction: `steps(${text.length})`, animationDelay: `${delay}s` }}
    >
      {text}
    </span>
  )
}

function Prompt() {
  return <span className="select-none text-primary">$</span>
}

function OutMark() {
  return <span className="select-none text-muted-foreground/40">›</span>
}

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
    <div className="relative overflow-hidden border-b border-border bg-background">
      {/* Faint dotted-grid texture, drawn from the theme's border color */}
      <div className="hero-term-grid pointer-events-none absolute inset-0 z-0" aria-hidden />

      <div className="site-shell-triad relative z-10 pt-14 pb-12 lg:pt-20 lg:pb-16">
        <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-xl shadow-foreground/5">
          {/* Title bar */}
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
            <span className="flex items-center gap-1.5" aria-hidden>
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: '#ff5f56' }} />
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: '#ffbd2e' }} />
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: '#27c93f' }} />
            </span>
            <span className="flex-1 text-center font-mono text-xs text-muted-foreground">
              ~/arthur-grace — zsh
            </span>
            <span className="w-[52px]" aria-hidden />
          </div>

          {/* Body */}
          <div className="px-5 py-6 font-mono text-[13px] leading-7 text-foreground sm:px-7 sm:py-7 sm:text-sm">
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
              <span className="hero-term-caret inline-block h-4 w-[8px] translate-y-[1px] bg-foreground/70" aria-hidden />
            </p>
          </div>
        </div>
      </div>

      <Live2D />
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
