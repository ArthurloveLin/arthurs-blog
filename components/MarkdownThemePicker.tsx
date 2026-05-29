'use client'

import { useMarkdownTheme } from '@/hooks/useMarkdownTheme'
import { MARKDOWN_THEMES } from '@/lib/markdown-themes'
import { useTheme } from 'next-themes'

export default function MarkdownThemePicker() {
  const { theme: mdTheme, setTheme } = useMarkdownTheme()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <div className="grid grid-cols-4 gap-1 p-1">
      {MARKDOWN_THEMES.map((t) => {
        const colors = isDark ? t.preview.dark : t.preview.light
        const isActive = mdTheme === t.id
        return (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            aria-label={`${t.name} — ${t.label}`}
            aria-pressed={isActive}
            title={t.label}
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
