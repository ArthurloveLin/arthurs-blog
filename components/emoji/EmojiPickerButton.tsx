'use client'

import { SmilePlus } from 'lucide-react'
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ALL_EMOJI_SECTIONS, searchEmojiSections } from '@/lib/emoji'

interface EmojiPickerButtonProps {
  onSelect: (emoji: string) => void
  label?: string
  title?: string
  triggerClassName?: string
  panelAlign?: 'start' | 'end'
  size?: 'sm' | 'md'
}

export default function EmojiPickerButton({
  onSelect,
  label = '插入 emoji',
  title = '选择 emoji',
  triggerClassName = '',
  panelAlign = 'end',
  size = 'md',
}: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [panelStyle, setPanelStyle] = useState<{ bottom: number; left: number; width: number; maxHeight: number } | null>(null)
  const deferredQuery = useDeferredValue(query)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchId = useId()
  const sections = useMemo(() => deferredQuery ? searchEmojiSections(deferredQuery) : ALL_EMOJI_SECTIONS, [deferredQuery])
  const canUsePortal = typeof document !== 'undefined'

  useEffect(() => {
    if (!open) {
      return
    }

    function updatePanelPosition() {
      const trigger = triggerRef.current
      if (!trigger) {
        return
      }

      const rect = trigger.getBoundingClientRect()
      const viewportPadding = 16
      const desiredWidth = Math.min(384, window.innerWidth - viewportPadding * 2)
      const left = panelAlign === 'start'
        ? rect.left
        : rect.right - desiredWidth
      const clampedLeft = Math.min(
        Math.max(left, viewportPadding),
        window.innerWidth - desiredWidth - viewportPadding,
      )
      const bottom = Math.max(window.innerHeight - rect.top + 10, viewportPadding)
      const maxHeight = Math.max(180, rect.top - viewportPadding - 10)

      setPanelStyle({ bottom, left: clampedLeft, width: desiredWidth, maxHeight })
    }

    updatePanelPosition()

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (!containerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, panelAlign])

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        title={title}
        onClick={() => setOpen((current) => !current)}
        className={[
          'inline-flex items-center justify-center rounded-full border border-black/10 bg-white/70 text-slate-700 transition hover:bg-white hover:text-slate-950',
          size === 'sm' ? 'h-6 w-6' : 'h-8 w-8',
          triggerClassName,
        ].filter(Boolean).join(' ')}
      >
        <SmilePlus size={size === 'sm' ? 12 : 14} strokeWidth={1.8} />
      </button>

      {open && canUsePortal && panelStyle ? createPortal(
        <div
          ref={panelRef}
          className="fixed z-[260] overflow-hidden rounded-[24px] border border-black/10 bg-white/92 shadow-[0_22px_60px_-24px_rgba(15,23,42,0.45)] backdrop-blur-xl"
          style={{
            bottom: panelStyle.bottom,
            left: panelStyle.left,
            width: panelStyle.width,
          }}
        >
          <div className="border-b border-black/6 px-3 py-3">
            <label htmlFor={searchId} className="sr-only">搜索 emoji</label>
            <input
              id={searchId}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索表情、关键词或分类…"
              className="w-full rounded-full border border-black/10 bg-white/70 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary/30 focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="overflow-y-auto px-3 py-3" style={{ maxHeight: panelStyle.maxHeight }}>
            <div className="space-y-4">
              {sections.map((section) => (
                <section key={section.id}>
                  <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{section.label}</p>
                  <div className="grid grid-cols-8 gap-1">
                    {section.items.map((item) => (
                      <button
                        key={`${section.id}-${item.id}`}
                        type="button"
                        title={`${item.emoji} ${item.name}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-xl transition hover:bg-slate-100 focus:bg-slate-100 focus:outline-none"
                        onClick={() => {
                          onSelect(item.emoji)
                          setOpen(false)
                          setQuery('')
                        }}
                      >
                        <span aria-hidden="true">{item.emoji}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}

              {sections.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-black/10 bg-slate-50/70 px-4 py-6 text-center text-sm text-slate-500">
                  没找到匹配的 emoji。
                </div>
              ) : null}
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  )
}