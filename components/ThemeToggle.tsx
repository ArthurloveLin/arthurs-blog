'use client'

import { useState, useRef, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon, Check } from 'lucide-react'

const themes = [
  { id: 'light', name: '默认 (紫)', color: 'bg-violet-500' },
  { id: 'ocean', name: '海洋 (蓝)', color: 'bg-sky-500' },
  { id: 'sunset', name: '日落 (橙)', color: 'bg-orange-500' },
  { id: 'forest', name: '森林 (绿)', color: 'bg-emerald-500' },
  { id: 'dark', name: '深色模式', color: 'bg-zinc-800' }
]

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
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
        {theme === 'dark' ? (
          <Moon className="w-[18px] h-[18px]" strokeWidth={1.75} />
        ) : (
          <Sun className="w-[18px] h-[18px]" strokeWidth={1.75} />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 origin-top-right rounded-xl bg-card shadow-lg ring-1 ring-border focus:outline-none z-50 overflow-hidden transform transition duration-200 p-1.5">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTheme(t.id)
                setIsOpen(false)
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                theme === t.id
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full shadow-sm ${t.color}`} />
                {t.name}
              </span>
              {theme === t.id && (
                <Check className="w-4 h-4 text-foreground" strokeWidth={2} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
