'use client'

import HeroAurora from '@/components/hero/HeroAurora'
import HeroTerminal from '@/components/hero/HeroTerminal'
import type { HeroVariantProps } from '@/components/hero/hero-props'
import { useHeroVariant } from '@/hooks/useHeroVariant'

// Both skins are statically imported (no ssr:false): the heavy, optional parts
// (Live2D, the Spotify now-playing chip) are lazy *inside* HeroTerminal, so the
// skin module itself is light. Importing it directly makes the post-hydration
// swap instant — previously ssr:false left the hero blank while its chunk (which
// drags in SpotifyProvider) downloaded, which read as a load hang.

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
      {variant === 'terminal' ? <HeroTerminal {...props} /> : <HeroAurora {...props} />}
    </div>
  )
}
