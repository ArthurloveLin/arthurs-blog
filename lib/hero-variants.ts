/**
 * Homepage hero presentations. Orthogonal to both the light/dark mode and the
 * `data-site-theme` hue — a variant only changes the *layout* of the hero, and
 * every variant is built from theme tokens so it works under all 8 hues × 2 modes.
 *
 * Persisted in localStorage under `hero-variant` and read by useHeroVariant().
 * Unlike site-theme (a CSS attribute applied pre-paint), the variant swaps
 * React-rendered structure, so it is gated behind a mount in BlogHero rather
 * than an inline <head> script — see hooks/useHeroVariant.ts.
 */
export type HeroVariantId = 'aurora' | 'terminal'

export interface HeroVariant {
  id: HeroVariantId
  name: string
  icon: string
}

// 'aurora' is the original blob + gradient + guestbook hero (the default).
export const HERO_VARIANTS: readonly HeroVariant[] = [
  { id: 'aurora', name: '光斑', icon: '🌈' },
  { id: 'terminal', name: '终端', icon: '▮' },
] as const

export const DEFAULT_HERO_VARIANT: HeroVariantId = 'aurora'

export const HERO_VARIANT_IDS = HERO_VARIANTS.map((v) => v.id) as readonly HeroVariantId[]
