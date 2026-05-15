'use client'

import { useMarkdownTheme } from '@/hooks/useMarkdownTheme'
import { MARKDOWN_THEMES } from '@/lib/markdown-themes'
import { useTheme } from 'next-themes'

export default function MarkdownThemePicker() {
  const { theme: mdTheme, setTheme } = useMarkdownTheme()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <div className="flex items-center gap-0.5 px-1 py-0.5">
      {MARKDOWN_THEMES.map((t) => {
        const colors = isDark ? t.preview.dark : t.preview.light
        const isActive = mdTheme === t.id
        return (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            title={`${t.name} — ${t.label}`}
            className={`relative w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150 ${
              isActive
                ? 'bg-muted ring-1 ring-border'
                : 'hover:bg-muted/60'
            }`}
          >
            <div className="flex flex-col gap-[3px]">
              <div className="flex gap-[3px]">
                <span className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: colors[0] }} />
                <span className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: colors[1] }} />
              </div>
              <div className="flex gap-[3px]">
                <span className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: colors[2] }} />
                <span className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: colors[3] }} />
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
