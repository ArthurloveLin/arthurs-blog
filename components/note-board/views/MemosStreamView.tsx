'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronDown, Layers, Search, X } from 'lucide-react'
import {
  useNoteBoardActions,
  useNoteBoardBoardState,
} from '@/components/note-board/NoteBoardProvider'
import { MemoStreamCard } from '@/components/note-board/views/MemoStreamCard'
import { SidebarCalendar, SidebarTagCloud, getShanghaDateParts, toDateKey } from '@/components/note-board/views/MemoSidebar'
import type { NoteCardViewModel } from '@/components/note-board/types'
import { formatStableDate } from '@/lib/date-format'

// ─── Sub-components ────────────────────────────────────────────────────────────

function StreamSearchBar() {
  const state = useNoteBoardBoardState()
  const actions = useNoteBoardActions()
  const [localQuery, setLocalQuery] = useState(() => state.searchQuery)
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const isExpanded = isFocused || !!localQuery

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    actions.handleSearch(localQuery.trim())
  }

  function handleClear() {
    setLocalQuery('')
    actions.handleSearch('')
    inputRef.current?.focus()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative flex h-8 items-center overflow-hidden rounded-full border border-border/70 bg-background/70 shadow-sm"
      style={{
        width: isExpanded ? '200px' : '32px',
        transition: 'width 600ms cubic-bezier(0,1.22,0.66,1.39)',
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={localQuery}
        onChange={(e) => setLocalQuery(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="搜索 Memo…"
        className="absolute left-0 h-full w-full bg-transparent pl-3 pr-8 text-[12px] text-foreground outline-none placeholder:text-muted-foreground/60"
        style={{
          opacity: isExpanded ? 1 : 0,
          transition: 'opacity 150ms ease',
          pointerEvents: isExpanded ? 'auto' : 'none',
        }}
        autoComplete="off"
        tabIndex={isExpanded ? 0 : -1}
      />
      <button
        type="button"
        onClick={localQuery ? handleClear : () => inputRef.current?.focus()}
        className="absolute right-0 flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground transition hover:text-foreground"
        aria-label={localQuery ? '清除搜索' : '搜索'}
      >
        {localQuery ? <X size={12} /> : <Search size={13} />}
      </button>
    </form>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

interface MemosStreamViewProps {
  onToggleViewMode: () => void
}

type FeedGroup = {
  dateKey: string
  dateLabel: string
  items: NoteCardViewModel[]
}

export function MemosStreamView({ onToggleViewMode }: MemosStreamViewProps) {
  const state = useNoteBoardBoardState()
  const actions = useNoteBoardActions()
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [mobileCalendarOpen, setMobileCalendarOpen] = useState(false)

  // When a search/tag filter is active, the date selection is suspended
  const effectiveSelectedDate = (state.searchQuery || state.activeTag) ? null : selectedDate

  // Build memo-date → count map for the calendar
  const memoDateCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of state.allNoteItems) {
      const ts = item.message.updated_at ?? item.message.created_at
      const { year, month, day } = getShanghaDateParts(ts)
      const key = toDateKey(year, month, day)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [state.allNoteItems])

  // Items filtered by selected calendar date (client-side)
  const filteredItems = useMemo(() => {
    if (!effectiveSelectedDate) return state.allNoteItems
    return state.allNoteItems.filter((item) => {
      const ts = item.message.updated_at ?? item.message.created_at
      const { year, month, day } = getShanghaDateParts(ts)
      return toDateKey(year, month, day) === effectiveSelectedDate
    })
  }, [state.allNoteItems, effectiveSelectedDate])

  // Group filtered items by date for the feed
  const feedGroups = useMemo<FeedGroup[]>(() => {
    const groups: FeedGroup[] = []
    let currentKey = ''

    for (const item of filteredItems) {
      const ts = item.message.updated_at ?? item.message.created_at
      const { year, month, day } = getShanghaDateParts(ts)
      const dateKey = toDateKey(year, month, day)
      if (dateKey !== currentKey) {
        currentKey = dateKey
        const dateLabel = formatStableDate(ts, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'short',
        })
        groups.push({ dateKey, dateLabel, items: [] })
      }
      groups[groups.length - 1]?.items.push(item)
    }

    return groups
  }, [filteredItems])

  // Infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !state.hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          !state.isPending &&
          !state.isRefreshingBoard
        ) {
          void actions.handleLoadMore()
        }
      },
      { rootMargin: '200px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [state.hasMore, state.isPending, state.isRefreshingBoard, actions])

  const isFilterMode = Boolean(state.searchQuery || state.activeTag || effectiveSelectedDate)
  const isEmpty = filteredItems.length === 0
  const isLoading = state.isRefreshingBoard && state.allNoteItems.length === 0

  return (
    <section className="rounded-[32px] border border-border/60 bg-card/95 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Memos
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground/60">
            当前已加载 {state.totalLoaded} 条
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StreamSearchBar />
          <button
            type="button"
            onClick={onToggleViewMode}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <Layers size={13} />
            <span className="hidden sm:inline">便签视图</span>
          </button>
        </div>
      </div>

      {/* Active filter banner */}
      {isFilterMode ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[16px] border border-border/60 bg-background/60 px-4 py-2 text-xs text-muted-foreground">
          <span className="flex-1">
            {state.searchQuery
              ? `搜索："${state.searchQuery}"，共 ${filteredItems.length} 条`
              : state.activeTag
                ? `标签：#${state.activeTag}，共 ${filteredItems.length} 条`
                : effectiveSelectedDate
                  ? `日期：${effectiveSelectedDate}，共 ${filteredItems.length} 条`
                  : null}
          </span>
          <button
            type="button"
            onClick={() => {
              if (state.searchQuery) actions.handleSearch('')
              else if (state.activeTag) actions.handleTagFilter(state.activeTag)
              else setSelectedDate(null)
            }}
            className="flex items-center gap-0.5 hover:text-foreground"
          >
            <X size={12} />
            清除
          </button>
        </div>
      ) : null}

      <div className="flex gap-6">
        {/* ── Sidebar (desktop only) ── */}
        <aside className="hidden shrink-0 sm:block sm:w-[180px] lg:w-[220px]">
          <div className="sticky top-6 space-y-6">
            <SidebarCalendar
              memoDateCounts={memoDateCounts}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
            <SidebarTagCloud />
          </div>
        </aside>

        {/* ── Main feed ── */}
        <div className="min-w-0 flex-1">
          {/* Mobile calendar toggle */}
          <div className="mb-3 sm:hidden">
            <button
              type="button"
              onClick={() => setMobileCalendarOpen((v) => !v)}
              className="flex w-full items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent"
            >
              <CalendarDays size={13} className="shrink-0" />
              <span className="flex-1 text-left">
                {effectiveSelectedDate ?? '按日期筛选'}
              </span>
              {effectiveSelectedDate ? (
                <X
                  size={12}
                  onClick={(e) => { e.stopPropagation(); setSelectedDate(null) }}
                />
              ) : (
                <ChevronDown size={12} className={mobileCalendarOpen ? 'rotate-180 transition' : 'transition'} />
              )}
            </button>
            {mobileCalendarOpen ? (
              <div className="mt-2 rounded-2xl border border-border/60 bg-background/80 p-3">
                <SidebarCalendar
                  memoDateCounts={memoDateCounts}
                  selectedDate={selectedDate}
                  onSelectDate={(key) => { setSelectedDate(key); if (key) setMobileCalendarOpen(false) }}
                />
              </div>
            ) : null}
          </div>

          {/* Mobile tag strip */}
          {state.allTags.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-1.5 sm:hidden">
              {state.allTags.slice(0, 12).map(({ name }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => actions.handleTagFilter(name)}
                  className={[
                    'rounded-full px-2 py-0.5 text-[11px] transition',
                    state.activeTag === name
                      ? 'bg-foreground text-background'
                      : 'border border-border/70 text-muted-foreground hover:bg-accent',
                  ].join(' ')}
                >
                  #{name}
                </button>
              ))}
              {state.activeTag ? (
                <button
                  type="button"
                  onClick={() => actions.handleTagFilter(state.activeTag)}
                  className="flex items-center gap-0.5 rounded-full border border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  <X size={10} />
                  清除
                </button>
              ) : null}
            </div>
          ) : null}

          {/* Loading skeleton */}
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-[20px] border border-border/40 bg-muted/30"
                />
              ))}
            </div>
          ) : isEmpty ? (
            <div className="flex min-h-[240px] items-center justify-center rounded-[20px] border border-dashed border-border/60 text-sm text-muted-foreground">
              {state.showArchived ? '还没有已归档便签。' : isFilterMode ? '没有匹配的 Memo。' : '暂时没有 Memo。'}
            </div>
          ) : (
            <div>
              {feedGroups.map((group) => (
                <div key={group.dateKey}>
                  <div className="relative my-5 flex items-center gap-3">
                    <div className="h-px flex-1 bg-border/40" />
                    <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                      {group.dateLabel}
                    </span>
                    <div className="h-px flex-1 bg-border/40" />
                  </div>
                  <div className="space-y-3">
                    {group.items.map((item) => (
                      <MemoStreamCard key={item.message.id} item={item} />
                    ))}
                  </div>
                </div>
              ))}

              {/* Infinite scroll sentinel / end label */}
              {state.hasMore && !effectiveSelectedDate ? (
                <div ref={sentinelRef} className="flex justify-center py-6">
                  {state.isPending ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
                  ) : null}
                </div>
              ) : (
                <p className="py-8 text-center text-xs text-muted-foreground/50">
                  · 已加载全部 Memo ·
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
