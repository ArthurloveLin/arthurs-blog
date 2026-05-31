'use client'

import dynamic from 'next/dynamic'
import HeroAurora from '@/components/hero/HeroAurora'
import type { HeroVariantProps } from '@/components/hero/hero-props'
import { useHeroVariant } from '@/hooks/useHeroVariant'

// Aurora is the SSR/LCP default (statically imported so it renders server-side).
// Terminal is the opt-in variant — ssr:false, so its code only ships once a
// visitor has actually selected it.
const HeroTerminal = dynamic(() => import('@/components/hero/HeroTerminal'), { ssr: false })

export type BlogHeroProps = HeroVariantProps

/**
 * Hero dispatcher. Renders the visitor's chosen hero variant, hot-swapping with
 * no page reload when they pick another in the theme menu.
 *
 * Server (and the first client paint) render DEFAULT_HERO_VARIANT to match the
 * ISR-prerendered HTML; useHeroVariant adopts the stored choice only after mount.
 * The `key` remounts on switch so the incoming variant plays its fade-in — which
 * also covers the one-frame default→stored swap for non-default visitors.
 */
export default function BlogHero(props: BlogHeroProps) {
  // Server + hydration resolve to DEFAULT_HERO_VARIANT (see useHeroVariant), so
  // the prerendered HTML always matches; the stored choice arrives post-hydration.
  const { variant } = useHeroVariant()

  return (
    <div key={variant} className="animate-[fade-in_0.35s_ease-out]">
      {variant === 'terminal' ? <HeroTerminal /> : <HeroAurora {...props} />}
    </div>
  )
}
