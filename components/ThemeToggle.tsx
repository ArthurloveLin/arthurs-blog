'use client'

import { useState, useRef, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import dynamic from 'next/dynamic'

const MarkdownThemePicker = dynamic(() => import('@/components/MarkdownThemePicker'), { ssr: false })
const SiteThemePicker = dynamic(() => import('@/components/SiteThemePicker'), { ssr: false })
const HeroVariantPicker = dynamic(() => import('@/components/HeroVariantPicker'), { ssr: false })

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const isDark = resolvedTheme === 'dark'

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-muted-foreground hover:text-foreground hover:bg-foreground/5 rounded-lg transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="切换主题"
        title="切换主题"
      >
        {isDark ? (
          <Moon className="w-[18px] h-[18px]" strokeWidth={1.75} />
        ) : (
          <Sun className="w-[18px] h-[18px]" strokeWidth={1.75} />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-xl bg-card shadow-lg ring-1 ring-border focus:outline-none z-50 overflow-hidden p-1.5">
          {/* Light / dark mode — independent of hue */}
          <div className="flex gap-1 p-1 rounded-lg bg-muted/50">
            <button
              onClick={() => setTheme('light')}
              aria-pressed={!isDark}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                !isDark
                  ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sun className="w-3.5 h-3.5" strokeWidth={2} />
              浅色
            </button>
            <button
              onClick={() => setTheme('dark')}
              aria-pressed={isDark}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                isDark
                  ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Moon className="w-3.5 h-3.5" strokeWidth={2} />
              深色
            </button>
          </div>

          {/* Site-wide hue */}
          <div className="mt-1.5 pt-1.5 border-t border-border/60">
            <p className="px-3 pt-0.5 pb-0.5 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-widest">
              全站主题
            </p>
            <SiteThemePicker />
          </div>

          {/* Prose hue */}
          <div className="mt-1 pt-1 border-t border-border/60">
            <p className="px-3 pt-0.5 pb-0.5 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-widest">
              文字主题
            </p>
            <MarkdownThemePicker />
          </div>

          {/* Homepage hero layout */}
          <div className="mt-1 pt-1 border-t border-border/60">
            <p className="px-3 pt-0.5 pb-0.5 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-widest">
              首页样式
            </p>
            <HeroVariantPicker />
          </div>
        </div>
      )}
    </div>
  )
}
