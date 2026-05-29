'use client'

import { useSiteTheme } from '@/hooks/useSiteTheme'
import { SITE_THEMES } from '@/lib/site-themes'
import { useTheme } from 'next-themes'

// Site-wide chrome hue picker. Same grid layout/identity as MarkdownThemePicker,
// but the swatch dots preview the chrome palette (primary · accent · surface).
export default function SiteThemePicker() {
  const { theme: siteTheme, setTheme } = useSiteTheme()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <div className="grid grid-cols-4 gap-1 p-1">
      {SITE_THEMES.map((t) => {
        const colors = isDark ? t.preview.dark : t.preview.light
        const isActive = siteTheme === t.id
        return (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            aria-label={t.name}
            aria-pressed={isActive}
            title={t.name}
            className={`flex flex-col items-center gap-[3px] py-2 rounded-lg transition-all duration-150 ${
              isActive
                ? 'bg-muted ring-1 ring-border'
                : 'hover:bg-muted/60'
            }`}
          >
            <span className="text-sm leading-none" aria-hidden="true">{t.icon}</span>
            <div className="flex gap-[3px] mt-0.5">
              {colors.map((c, i) => (
                <span
                  key={i}
                  className="w-[5px] h-[5px] rounded-full"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <span className="text-[9px] font-medium text-foreground/70 leading-none mt-0.5">
              {t.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
