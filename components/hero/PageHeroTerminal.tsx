'use client'

import { Caret, OutMark, Prompt, row, TerminalWindow, Typed } from '@/components/hero/TerminalWindow'
import type { PageHeroProps } from '@/components/hero/page-hero-props'

// Terminal skin for the generic page header. Driven by PageHero's props rather
// than site config — no stats/now-playing/Live2D (those are homepage signatures).
// `slogan` and `blobColors` are intentionally ignored: the handwriting/blob
// ornaments don't belong in a terminal.
const D = {
  comment: 0.05,
  cmd: 0.35,
  title: 0.85,
  desc: 1.05,
  caret: 1.3,
} as const

export default function PageHeroTerminal({
  title,
  subtitle,
  description,
  containerClass = 'site-shell',
}: PageHeroProps) {
  return (
    <TerminalWindow containerClass={containerClass}>
      {subtitle && (
        <p className="hero-term-line text-muted-foreground/60" style={row(D.comment)}>
          <span className="select-none">#</span> {subtitle}
        </p>
      )}
      <p className="hero-term-line mt-1 flex items-center gap-2" style={row(D.cmd)}>
        <Prompt />
        <Typed text="cat README.md" delay={D.cmd} />
      </p>
      <h1
        className="hero-term-line mt-1 flex items-start gap-2 text-2xl font-bold leading-snug tracking-tight sm:text-3xl"
        style={row(D.title)}
      >
        <OutMark />
        <span>{title}</span>
      </h1>
      {description && (
        <p
          className="hero-term-line mt-2 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground sm:text-[13px]"
          style={row(D.desc)}
        >
          <OutMark />
          <span className="max-w-2xl">{description}</span>
        </p>
      )}
      <p className="hero-term-line mt-4 flex items-center gap-2 text-muted-foreground/80" style={row(D.caret)}>
        <Prompt />
        <Caret />
      </p>
    </TerminalWindow>
  )
}
