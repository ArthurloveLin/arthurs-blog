'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Layers, Search, Tag, X } from 'lucide-react'
import {
  useNoteBoardActions,
  useNoteBoardBoardState,
} from '@/components/note-board/NoteBoardProvider'
import { MemoStreamCard } from '@/components/note-board/views/MemoStreamCard'
import type { NoteCardViewModel } from '@/components/note-board/types'
import { formatStableDate } from '@/lib/date-format'

// ─── Date utilities ────────────────────────────────────────────────────────────

function getShanghaDateParts(ts: string | Date): { year: number; month: number; day: number } {
  const date = typeof ts === 'string' ? new Date(ts) : ts
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date)
  return {
    year: Number(parts.find((p) => p.type === 'year')?.value ?? 0),
    month: Number(parts.find((p) => p.type === 'month')?.value ?? 0),
    day: Number(parts.find((p) => p.type === 'day')?.value ?? 0),
  }
}

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function buildCalendarCells(year: number, month: number) {
  // Monday-first grid
  const firstDow = new Date(year, month - 1, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate()
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate()
  const startPad = (firstDow + 6) % 7

  const cells: Array<{ day: number; kind: 'prev' | 'current' | 'next' }> = []

  for (let i = startPad - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, kind: 'prev' })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, kind: 'current' })
  }
  const remaining = (7 - (cells.length % 7)) % 7
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, kind: 'next' })
  }

  return cells
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

// ─── Sub-components ────────────────────────────────────────────────────────────

interface SidebarCalendarProps {
  memoDateCounts: Map<string, number>
  selectedDate: string | null
  onSelectDate: (key: string | null) => void
}

function SidebarCalendar({ memoDateCounts, selectedDate, onSelectDate }: SidebarCalendarProps) {
  const today = useMemo(() => {
    const { year, month, day } = getShanghaDateParts(new Date())
    return { year, month, day, key: toDateKey(year, month, day) }
  }, [])

  const [displayMonth, setDisplayMonth] = useState(() => {
    // Start on the month of the most recent memo, or today
    const dates = [...memoDateCounts.keys()].sort().reverse()
    if (dates.length > 0) {
      const [y, m] = (dates[0] ?? '').split('-').map(Number)
      if (y && m) return { year: y, month: m }
    }
    return { year: today.year, month: today.month }
  })

  const cells = useMemo(
    () => buildCalendarCells(displayMonth.year, displayMonth.month),
    [displayMonth],
  )

  const monthLabel = formatStableDate(
    new Date(displayMonth.year, displayMonth.month - 1, 1),
    { year: 'numeric', month: 'long' },
  )

  function prevMonth() {
    setDisplayMonth(({ year, month }) => {
      if (month === 1) return { year: year - 1, month: 12 }
      return { year, month: month - 1 }
    })
  }

  function nextMonth() {
    setDisplayMonth(({ year, month }) => {
      if (month === 12) return { year: year + 1, month: 1 }
      return { year, month: month + 1 }
    })
  }

  return (
    <div className="space-y-2">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded-full p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          aria-label="上个月"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-[12px] font-medium text-foreground/80">{monthLabel}</span>
        <button
          type="button"
          onClick={nextMonth}
          className="rounded-full p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          aria-label="下个月"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center">
        {WEEKDAY_LABELS.map((lbl) => (
          <span key={lbl} className="text-[10px] text-muted-foreground/60">
            {lbl}
          </span>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {cells.map((cell, i) => {
          if (cell.kind !== 'current') {
            return <span key={i} className="py-1 text-[11px] text-muted-foreground/25">{cell.day}</span>
          }

          const key = toDateKey(displayMonth.year, displayMonth.month, cell.day)
          const hasMemós = memoDateCounts.has(key)
          const count = memoDateCounts.get(key) ?? 0
          const isSelected = selectedDate === key
          const isToday = key === today.key

          return (
            <button
              key={i}
              type="button"
              disabled={!hasMemós && !isSelected}
              onClick={() => onSelectDate(isSelected ? null : key)}
              className={[
                'relative mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[11px] transition',
                isSelected
                  ? 'bg-foreground font-semibold text-background'
                  : isToday
                    ? 'font-semibold text-foreground ring-1 ring-border'
                    : hasMemós
                      ? 'text-foreground hover:bg-accent'
                      : 'cursor-default text-muted-foreground/40',
              ].join(' ')}
              title={hasMemós ? `${count} 条 Memo` : undefined}
            >
              {cell.day}
              {hasMemós && !isSelected ? (
                <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-foreground/40" />
              ) : null}
            </button>
          )
        })}
      </div>

      {selectedDate ? (
        <button
          type="button"
          onClick={() => onSelectDate(null)}
          className="flex w-full items-center justify-center gap-1 rounded-full border border-border/60 py-1 text-[11px] text-muted-foreground transition hover:text-foreground"
        >
          <X size={10} />
          清除日期筛选
        </button>
      ) : null}
    </div>
  )
}

function StreamSidebarTagCloud() {
  const state = useNoteBoardBoardState()
  const actions = useNoteBoardActions()

  if (state.allTags.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
        <Tag size={9} />
        标签
      </p>
      <div className="flex flex-wrap gap-1.5">
        {state.allTags.slice(0, 30).map(({ name, count }) => (
          <button
            key={name}
            type="button"
            onClick={() => actions.handleTagFilter(name)}
            className={[
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition',
              state.activeTag === name
                ? 'bg-foreground text-background'
                : 'border border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground',
            ].join(' ')}
          >
            <span>#{name}</span>
            <span className="opacity-60">{count}</span>
          </button>
        ))}
        {state.allTags.length > 30 ? (
          <span className="text-[11px] text-muted-foreground/60">
            +{state.allTags.length - 30}
          </span>
        ) : null}
      </div>
      {state.activeTag ? (
        <button
          type="button"
          onClick={() => actions.handleTagFilter(state.activeTag)}
          className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <X size={10} />
          清除筛选
        </button>
      ) : null}
    </div>
  )
}

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
        type="search"
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
          <button
            type="button"
            onClick={onToggleViewMode}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <Layers size={13} />
            <span className="hidden sm:inline">便签视图</span>
          </button>
          <StreamSearchBar />
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
            <StreamSidebarTagCloud />
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
