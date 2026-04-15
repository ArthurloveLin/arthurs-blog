'use client'

import { SmilePlus } from 'lucide-react'
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
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
  const deferredQuery = useDeferredValue(query)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchId = useId()
  const sections = useMemo(() => deferredQuery ? searchEmojiSections(deferredQuery) : ALL_EMOJI_SECTIONS, [deferredQuery])

  useEffect(() => {
    if (!open) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
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

      {open ? (
        <div
          className={[
            'absolute top-[calc(100%+0.65rem)] z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-[24px] border border-black/10 bg-white/92 shadow-[0_22px_60px_-24px_rgba(15,23,42,0.45)] backdrop-blur-xl',
            panelAlign === 'start' ? 'left-0' : 'right-0',
          ].join(' ')}
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

          <div className="max-h-[22rem] overflow-y-auto px-3 py-3">
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
        </div>
      ) : null}
    </div>
  )
}