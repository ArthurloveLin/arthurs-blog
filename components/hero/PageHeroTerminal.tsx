'use client'

import { Caret, OutMark, Prompt, row, TerminalWindow, Typed } from '@/components/hero/TerminalWindow'
import type { PageHeroProps } from '@/components/hero/page-hero-props'

// Terminal skin for the generic page header. Driven by PageHero's props rather
// than site config — no stats/now-playing/Live2D (those are homepage signatures).
// `slogan` and `blobColors` are intentionally ignored: the handwriting/blob
// ornaments don't belong in a terminal.

// All secondary pages that use the terminal hero variant, shown in ls output.
const LS_FILES = 'GUESTBOOK.md  MEMO.md  RECIPE.md  SPOTIFY.md  TREND_RADAR.md'

const D = {
  ls:     0.0,   // $ ls *.md        (Typed 0.5s → finishes at 0.5)
  lsOut:  0.5,   // ls output line
  cat:    0.7,   // $ cat FILE.md    (Typed 0.5s → finishes at 1.2)
  title:  1.2,   // › h1 title
  desc:   1.4,   // › description
  status: 1.6,   // status bar
  caret:  1.85,  // $ █
} as const

export default function PageHeroTerminal({
  title,
  description,
  filename = 'README.md',
  containerClass = 'site-shell',
}: PageHeroProps) {
  const branch = filename.replace(/\.md$/i, '').toLowerCase()

  const statusBar = (
    <div className="hero-term-line flex w-full items-center gap-3" style={row(D.status)}>
      <span className="flex items-center gap-1">
        <span className="text-primary" aria-hidden>●</span>
        <span>branch:{branch}</span>
      </span>
      <span aria-hidden>·</span>
      <span>utf-8</span>
      <span aria-hidden>·</span>
      <span>markdown</span>
      <span className="ml-auto">zsh</span>
    </div>
  )

  return (
    <TerminalWindow containerClass={containerClass} statusBar={statusBar}>
      {/* ls *.md */}
      <p className="hero-term-line flex items-center gap-2" style={row(D.ls)}>
        <Prompt />
        <Typed text="ls *.md" delay={D.ls} />
      </p>
      {/* ls output: all secondary pages using this hero */}
      <p className="hero-term-line text-muted-foreground/55" style={row(D.lsOut)}>
        {LS_FILES}
      </p>
      {/* cat command */}
      <p className="hero-term-line mt-2 flex items-center gap-2" style={row(D.cat)}>
        <Prompt />
        <Typed text={`cat ${filename}`} delay={D.cat} />
      </p>
      {/* title */}
      <h1
        className="hero-term-line mt-1 flex items-start gap-2 text-2xl font-bold leading-snug tracking-tight sm:text-3xl"
        style={row(D.title)}
      >
        <OutMark />
        <span>{title}</span>
      </h1>
      {/* description */}
      {description && (
        <p
          className="hero-term-line mt-2 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground sm:text-[13px]"
          style={row(D.desc)}
        >
          <OutMark />
          <span className="max-w-2xl">{description}</span>
        </p>
      )}
      {/* live caret */}
      <p className="hero-term-line mt-4 flex items-center gap-2 text-muted-foreground/80" style={row(D.caret)}>
        <Prompt />
        <Caret />
      </p>
    </TerminalWindow>
  )
}
