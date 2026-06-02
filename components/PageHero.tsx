'use client'

import PageHeroAurora from '@/components/hero/PageHeroAurora'
import PageHeroTerminal from '@/components/hero/PageHeroTerminal'
import type { PageHeroProps } from '@/components/hero/page-hero-props'
import { useHeroVariant } from '@/hooks/useHeroVariant'

export type { PageHeroProps }

/**
 * Generic page header used across secondary pages (recipe / guestbook /
 * trend-radar / spotify / memo). Dispatches to the visitor's chosen hero
 * variant so those pages stay in sync with the homepage.
 *
 * Both skins are statically imported (no ssr:false) so the post-hydration swap
 * is instant — no blank header while a chunk downloads. Server + the first
 * client paint render the aurora default (see useHeroVariant), matching the
 * prerendered HTML; the `key` remounts on switch to play the fade.
 */
export default function PageHero(props: PageHeroProps) {
  const { variant } = useHeroVariant()

  return (
    <div key={variant} className="hero-variant-shell animate-[fade-in_0.35s_ease-out]">
      {variant === 'terminal' ? <PageHeroTerminal {...props} /> : <PageHeroAurora {...props} />}
    </div>
  )
}
