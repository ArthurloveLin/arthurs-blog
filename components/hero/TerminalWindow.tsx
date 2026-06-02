'use client'

import type { CSSProperties, ReactNode } from 'react'

// Shared chrome + primitives for the terminal hero skin, used by both the
// homepage hero (HeroTerminal) and the generic page header (PageHeroTerminal).
// All colors come from theme tokens so it works under every site-theme hue ×
// light/dark; the traffic-light dots are fixed iconography (like the Spotify
// green elsewhere). Reveal/typing/caret animations live in globals.css and are
// disabled under prefers-reduced-motion.

/** Just the rounded card: traffic-light title bar + monospace body. */
export function TerminalCard({
  windowTitle = '~/arthur-grace — zsh',
  className = '',
  statusBar,
  children,
}: {
  windowTitle?: string
  /** Extra classes applied to the outer rounded card div (e.g. centering, max-width). */
  className?: string
  /** Optional bottom bar rendered below the body, flush with card edges (IDE status bar style). */
  statusBar?: ReactNode
  children: ReactNode
}) {
  return (
    <div className={`${className} overflow-hidden rounded-xl border border-border bg-card shadow-xl shadow-foreground/5`}>
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
        <span className="flex shrink-0 items-center gap-1.5" aria-hidden>
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: '#ff5f56' }} />
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: '#ffbd2e' }} />
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: '#27c93f' }} />
        </span>
        <span className="flex-1 truncate text-center font-mono text-xs text-muted-foreground">
          {windowTitle}
        </span>
        <span className="w-[52px] shrink-0" aria-hidden />
      </div>

      {/* Body */}
      <div className="px-5 py-6 font-mono text-[13px] leading-7 text-foreground sm:px-7 sm:py-7 sm:text-sm">
        {children}
      </div>

      {/* Status bar — flush with card edges, below body padding */}
      {statusBar && (
        <div className="border-t border-border/50 bg-muted/30 px-5 sm:px-7 py-1.5 font-mono text-[11px] text-muted-foreground/55 flex items-center">
          {statusBar}
        </div>
      )}
    </div>
  )
}

/** Full-page section wrapper used by PageHeroTerminal. */
export function TerminalWindow({
  windowTitle = '~/arthur-grace — zsh',
  containerClass = 'site-shell',
  windowClassName = 'mx-auto w-full max-w-3xl',
  corner,
  statusBar,
  children,
}: {
  windowTitle?: string
  containerClass?: string
  /** Width/alignment of the window card within the shell. */
  windowClassName?: string
  /** Absolutely-positioned decoration inside the section (e.g. Live2D). */
  corner?: ReactNode
  /** Passed through to TerminalCard's bottom status bar slot. */
  statusBar?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="relative overflow-hidden border-b border-border bg-background">
      {/* Faint dotted-grid texture, drawn from the theme's border color */}
      <div className="hero-term-grid pointer-events-none absolute inset-0 z-0" aria-hidden />

      <div className={`${containerClass} relative z-10 pt-14 pb-12 lg:pt-20 lg:pb-16`}>
        <TerminalCard windowTitle={windowTitle} className={windowClassName} statusBar={statusBar}>
          {children}
        </TerminalCard>
      </div>

      {corner}
    </div>
  )
}

/** Row reveal delay → inline style. */
export function row(delay: number): CSSProperties {
  return { animationDelay: `${delay}s` }
}

export function Prompt() {
  return <span className="select-none text-primary">$</span>
}

export function OutMark() {
  return <span className="select-none text-muted-foreground/40">›</span>
}

// A typed ASCII command. width:Nch + steps(N) gives the per-character reveal;
// backwards fill (in CSS) holds it at width:0 through the delay so it doesn't
// flash full before typing. Only use for ASCII — CJK glyphs aren't 1ch wide.
// The inner flex wrapper keeps the post-typing cursor flush against the text
// regardless of the parent container's gap setting.
export function Typed({ text, delay }: { text: string; delay: number }) {
  return (
    <span className="inline-flex items-center">
      <span
        className="hero-term-typed"
        style={{ width: `${text.length}ch`, animationTimingFunction: `steps(${text.length})`, animationDelay: `${delay}s` }}
      >
        {text}
      </span>
      <span className="hero-term-type-cursor" style={{ animationDelay: `${delay + 0.5}s` }} aria-hidden />
    </span>
  )
}

/** Persistent blinking block caret. */
export function Caret() {
  return <span className="hero-term-caret inline-block h-4 w-[8px] translate-y-[1px] bg-foreground/70" aria-hidden />
}
