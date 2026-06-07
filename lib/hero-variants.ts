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
export type HeroVariantId = 'aurora' | 'terminal' | 'editorial'

export interface HeroVariant {
  id: HeroVariantId
  name: string
  icon: string
}

export const HERO_VARIANTS: readonly HeroVariant[] = [
  { id: 'aurora', name: '光斑', icon: '🌈' },
  { id: 'terminal', name: '终端', icon: '▮' },
  { id: 'editorial', name: '刊头', icon: '¶' },
] as const

// Terminal is the ISR-prerendered default. Visitors without a stored preference see
// terminal; aurora users get a gate-then-swap (mirror of the old terminal behaviour).
export const DEFAULT_HERO_VARIANT: HeroVariantId = 'terminal'

export const HERO_VARIANT_IDS = HERO_VARIANTS.map((v) => v.id) as readonly HeroVariantId[]
