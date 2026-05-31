'use client'

import { ChevronLeft, ChevronRight, SmilePlus } from 'lucide-react'
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { loadEmojiSections, searchEmojiSections, type EmojiCategorySection } from '@/lib/emoji'

const BROWSE_PAGE_SIZE = 28
const SEARCH_PAGE_SIZE = 24

interface EmojiPickerButtonProps {
  onSelect: (emoji: string) => void
  label?: string
  title?: string
  triggerClassName?: string
  panelAlign?: 'start' | 'end'
  size?: 'sm' | 'md'
  triggerVariant?: 'filled' | 'bare'
}

export default function EmojiPickerButton({
  onSelect,
  label = '插入 emoji',
  title = '选择 emoji',
  triggerClassName = '',
  panelAlign = 'end',
  size = 'md',
  triggerVariant = 'filled',
}: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeCategoryId, setActiveCategoryId] = useState('')
  const [emojiSections, setEmojiSections] = useState<EmojiCategorySection[] | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [panelStyle, setPanelStyle] = useState<{ bottom: number; left: number; width: number; maxHeight: number } | null>(null)
  const deferredQuery = useDeferredValue(query)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchId = useId()

  useEffect(() => {
    if (open && !emojiSections) {
      loadEmojiSections().then(setEmojiSections)
    }
  }, [open, emojiSections])

  const effectiveCategoryId = activeCategoryId || emojiSections?.[0]?.id || ''
  const sections = useMemo(() => {
    if (!emojiSections) return []
    return deferredQuery ? searchEmojiSections(emojiSections, deferredQuery) : emojiSections
  }, [emojiSections, deferredQuery])
  const isSearching = deferredQuery.trim().length > 0
  const activeSection = useMemo(
    () => sections.find((section) => section.id === effectiveCategoryId) ?? sections[0] ?? null,
    [effectiveCategoryId, sections],
  )
  const searchItems = useMemo(
    () => sections.flatMap((section) => section.items.map((item) => ({ ...item, categoryLabel: section.label }))),
    [sections],
  )
  const pageSize = isSearching ? SEARCH_PAGE_SIZE : BROWSE_PAGE_SIZE
  const totalPages = Math.max(
    1,
    Math.ceil((isSearching ? searchItems.length : activeSection?.items.length ?? 0) / pageSize),
  )
  const visiblePage = Math.min(currentPage, totalPages - 1)
  const visibleItems = useMemo(() => {
    const start = visiblePage * pageSize
    if (isSearching) {
      return searchItems.slice(start, start + pageSize)
    }
    return activeSection?.items.slice(start, start + pageSize) ?? []
  }, [activeSection, isSearching, pageSize, searchItems, visiblePage])
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
      const desiredWidth = Math.min(352, window.innerWidth - viewportPadding * 2)
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
    <div ref={containerRef} className="relative inline-flex shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        title={title}
        onClick={() => setOpen((current) => !current)}
        className={[
          'inline-flex items-center justify-center rounded-full border text-muted-foreground transition hover:text-foreground',
          triggerVariant === 'bare'
            ? 'border-transparent bg-transparent hover:bg-foreground/5'
            : 'border-border bg-card hover:bg-muted',
          size === 'sm' ? 'h-6 w-6' : 'h-8 w-8',
          triggerClassName,
        ].filter(Boolean).join(' ')}
      >
        <SmilePlus size={size === 'sm' ? 12 : 14} strokeWidth={1.8} />
      </button>

      {open && canUsePortal && panelStyle ? createPortal(
        <div
          ref={panelRef}
          className="fixed z-[260] overflow-hidden rounded-[24px] border border-border bg-card shadow-[0_22px_60px_-24px_rgba(15,23,42,0.45)]"
          style={{
            bottom: panelStyle.bottom,
            left: panelStyle.left,
            width: panelStyle.width,
          }}
        >
          <div className="border-b border-border px-3 py-3">
            <label htmlFor={searchId} className="sr-only">搜索 emoji</label>
            <input
              id={searchId}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setCurrentPage(0)
              }}
              placeholder="搜索表情、关键词或分类…"
              className="w-full rounded-full border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/30 focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {!emojiSections ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              加载中…
            </div>
          ) : (
            <>
              {!isSearching && sections.length > 0 ? (
                <div className="border-b border-border px-3 py-2">
                  <div className="flex flex-wrap gap-1 pb-1">
                    {sections.map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => {
                          setActiveCategoryId(section.id)
                          setCurrentPage(0)
                        }}
                        className={[
                          'rounded-full px-3 py-1.5 text-[11px] font-medium transition',
                          activeSection?.id === section.id
                            ? 'bg-primary text-primary-foreground shadow-[0_10px_24px_-18px_rgba(15,23,42,0.9)]'
                            : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground',
                        ].join(' ')}
                      >
                        {section.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="overflow-y-auto px-3 py-3" style={{ maxHeight: panelStyle.maxHeight }}>
                <div className="space-y-3">
                  {visibleItems.length > 0 ? (
                    <section>
                      <div className="mb-2 flex items-center justify-between px-1">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                          {isSearching ? '搜索结果' : activeSection?.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {visiblePage + 1} / {totalPages}
                        </p>
                      </div>
                      <div className="grid grid-cols-7 gap-1.5">
                        {visibleItems.map((item) => (
                          <button
                            key={`${item.categoryId}-${item.id}`}
                            type="button"
                            title={`${item.emoji} ${item.name}`}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-transparent text-[22px] transition hover:border-border hover:bg-muted focus:border-primary/20 focus:bg-muted focus:outline-none"
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
                      {isSearching ? (
                        <div className="mt-3 rounded-[18px] bg-muted px-3 py-2 text-[11px] text-muted-foreground">
                          当前结果覆盖 {sections.length} 个分类。
                        </div>
                      ) : null}
                    </section>
                  ) : null}

                  {visibleItems.length === 0 ? (
                    <div className="rounded-[20px] border border-dashed border-border bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
                      没找到匹配的 emoji。
                    </div>
                  ) : null}

                  {visibleItems.length > 0 && totalPages > 1 ? (
                    <div className="flex items-center justify-between gap-3 rounded-[18px] border border-border bg-muted px-2 py-2">
                      <button
                        type="button"
                        onClick={() => setCurrentPage(Math.max(0, visiblePage - 1))}
                        disabled={visiblePage === 0}
                        className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-border bg-card px-2 text-muted-foreground transition disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <ChevronLeft size={14} strokeWidth={1.9} />
                      </button>
                      <p className="text-[11px] text-muted-foreground">
                        {isSearching ? `第 ${visiblePage + 1} 页，共 ${searchItems.length} 个结果` : `本类第 ${visiblePage + 1} 页`}
                      </p>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(Math.min(totalPages - 1, visiblePage + 1))}
                        disabled={visiblePage >= totalPages - 1}
                        className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-border bg-card px-2 text-muted-foreground transition disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <ChevronRight size={14} strokeWidth={1.9} />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </div>,
        document.body,
      ) : null}
    </div>
  )
}
