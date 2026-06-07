'use client'

import { EYEBROW } from '@/components/cardSurface'
import type { PageHeroProps } from '@/components/hero/page-hero-props'

// Editorial (Swiss) skin for the generic page header. Driven by PageHero's props.
// Like the terminal skin it stays type-only: `slogan`/`blobColors` are ignored
// (those ornaments belong to the aurora skin), and there is no stats/now-playing
// running foot — those are homepage signatures.

const rise = (delay: number) => ({ animationDelay: `${delay}s` })

export default function PageHeroEditorial({
  title,
  subtitle,
  description,
  filename = 'README.md',
  containerClass = 'site-shell',
}: PageHeroProps) {
  // Section kicker derived from the page's filename, e.g. MEMO.md → MEMO.
  const section = filename.replace(/\.md$/i, '').toUpperCase()

  return (
    <div className="hero-editorial-root relative overflow-hidden border-b border-border bg-background">
      <div className={`${containerClass} relative z-10 pt-14 pb-12 lg:pt-20 lg:pb-16`}>
        <div className="max-w-4xl">
          {/* Masthead: running head + section kicker, over a hairline rule */}
          <div className="hero-editorial-line" style={rise(0.05)}>
            <div className="flex items-baseline justify-between gap-4">
              <span className={`${EYEBROW} text-[11px]`}>{subtitle || "Arthur's Blog"}</span>
              <span className={`${EYEBROW} shrink-0 text-[11px] text-foreground/70`} aria-hidden>
                § {section}
              </span>
            </div>
            <div className="mt-3 h-px w-full bg-border" />
          </div>

          {/* Headline */}
          <h1
            className="hero-editorial-line mt-7 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-[2.75rem]"
            style={rise(0.18)}
          >
            {title}
          </h1>

          {/* Lede */}
          {description && (
            <p
              className="hero-editorial-line mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground"
              style={rise(0.34)}
            >
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
