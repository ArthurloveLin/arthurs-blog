'use client'

import { useHeroVariant } from '@/hooks/useHeroVariant'
import { HERO_VARIANTS } from '@/lib/hero-variants'

// Homepage hero layout picker. Lives alongside the hue/prose pickers in the
// theme menu; switching takes effect instantly on the home/listing pages and is
// remembered for next time (localStorage, synced across tabs).
export default function HeroVariantPicker() {
  const { variant, setVariant } = useHeroVariant()

  return (
    <div className="grid grid-cols-2 gap-1 p-1">
      {HERO_VARIANTS.map((v) => {
        const isActive = variant === v.id
        return (
          <button
            key={v.id}
            onClick={() => setVariant(v.id)}
            aria-label={v.name}
            aria-pressed={isActive}
            title={v.name}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all duration-150 ${
              isActive ? 'bg-muted text-foreground ring-1 ring-border' : 'text-muted-foreground hover:bg-muted/60'
            }`}
          >
            <span className="text-sm leading-none" aria-hidden="true">{v.icon}</span>
            {v.name}
          </button>
        )
      })}
    </div>
  )
}
