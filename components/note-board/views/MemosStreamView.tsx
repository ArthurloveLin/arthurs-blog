'use client'

import { useEffect, useMemo, useRef } from 'react'
import {
  useNoteBoardActions,
  useNoteBoardBoardState,
  useNoteBoardMeta,
} from '@/components/note-board/NoteBoardProvider'
import { MemoBoardShell, type MemoBoardFilters } from '@/components/note-board/views/MemoBoardShell'
import type { MemoHabitOverview } from '@/lib/memo-habits'
import type { MemoAgendaItem } from '@/lib/note-boards'
import { MemoStreamCard } from '@/components/note-board/views/MemoStreamCard'
import { getShanghaDateParts, toDateKey } from '@/components/note-board/views/MemoSidebar'
import type { NoteCardViewModel } from '@/components/note-board/types'
import { formatStableDate } from '@/lib/date-format'
import { NOTE_PRIORITY_META } from '@/lib/note-priority'

interface MemosStreamViewProps {
  onToggleViewMode: () => void
  filters: MemoBoardFilters
  agendaItems?: MemoAgendaItem[] | null
  habitOverview?: MemoHabitOverview | null
  onOpenHabitDetail?: (noteId: string, itemKey: string, source?: 'sidebar' | 'note') => void
  onCompleteHabitItem?: (noteId: string, itemKey: string) => void
  showSidebar?: boolean
}

type FeedGroup = {
  id: string
  kind: 'priority' | 'date'
  label: string
  dateHeader?: {
    dayLabel: string
    weekdayLabel: string
    monthYearLabel: string
  }
  items: NoteCardViewModel[]
}

const DATE_META_BLOCK_HEIGHT_CLASS = 'h-[2.15rem] sm:h-[2.6rem]'

export function MemosStreamView({ onToggleViewMode, filters, agendaItems, habitOverview, onOpenHabitDetail, onCompleteHabitItem, showSidebar }: MemosStreamViewProps) {
  const state = useNoteBoardBoardState()
  const actions = useNoteBoardActions()
  const meta = useNoteBoardMeta()
  const sentinelRef = useRef<HTMLDivElement>(null)
  const filteredItems = useMemo(() => {
    const byDate = filters.filterItemsByDate(state.allNoteItems)
    if (!state.activeDueDate || !agendaItems?.length) return byDate
    const matchingIds = new Set(
      agendaItems
        .filter((a) => {
          const { year, month, day } = getShanghaDateParts(a.dueAt)
          return toDateKey(year, month, day) === state.activeDueDate
        })
        .map((a) => a.memoId),
    )
    return byDate.filter((item) => matchingIds.has(item.message.id))
  }, [filters, state.allNoteItems, state.activeDueDate, agendaItems])

  const feedGroups = useMemo<FeedGroup[]>(() => {
    if (meta.board.slug === 'memo' && state.sortMode === 'priority') {
      const priorityOrder = state.sortDirection === 'asc'
        ? ([0, 1, 2] as const)
        : ([2, 1, 0] as const)

      return priorityOrder
        .map((priority) => ({
          priority,
          items: filteredItems.filter((item) => (item.message.priority ?? 1) === priority),
        }))
        .filter((group) => group.items.length > 0)
        .map((group) => ({
          id: `priority:${group.priority}`,
          kind: 'priority' as const,
          label: NOTE_PRIORITY_META[group.priority].label,
          items: group.items,
        }))
    }

    const groups: FeedGroup[] = []
    let currentKey = ''

    for (const item of filteredItems) {
      const ts = item.message.updated_at ?? item.message.created_at
      const { year, month, day } = getShanghaDateParts(ts)
      const dateKey = toDateKey(year, month, day)
      if (dateKey !== currentKey) {
        currentKey = dateKey
        const label = formatStableDate(ts, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'short',
        })
        groups.push({
          id: `date:${dateKey}:${item.message.id}`,
          kind: 'date',
          label,
          dateHeader: {
            dayLabel: String(day),
            weekdayLabel: formatStableDate(ts, { weekday: 'short' }),
            monthYearLabel: `${year} · ${String(month).padStart(2, '0')}月`,
          },
          items: [],
        })
      }
      groups[groups.length - 1]?.items.push(item)
    }

    return groups
  }, [filteredItems, meta.board.slug, state.sortDirection, state.sortMode])

  // Scroll to top whenever the active due-date filter changes to a new date.
  const prevDueDateRef = useRef<string | null>(null)
  useEffect(() => {
    if (state.activeDueDate && state.activeDueDate !== prevDueDateRef.current) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    prevDueDateRef.current = state.activeDueDate
  }, [state.activeDueDate])

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

  const isEmpty = filteredItems.length === 0
  const isLoading = state.isRefreshingBoard && state.allNoteItems.length === 0

  return (
    <MemoBoardShell
      title={meta.board.title}
      summary={`当前已加载 ${state.totalLoaded} 条`}
      itemUnit="条"
      filteredCount={filteredItems.length}
      toggleTarget="sticky"
      onToggleViewMode={onToggleViewMode}
      filters={filters}
      searchPlaceholder={meta.board.slug === 'guestbook' ? '搜索留言内容…' : '搜索 Memo…'}
      allowPrioritySort={meta.board.slug === 'memo'}
      showSidebar={showSidebar}
      agendaItems={agendaItems}
      habitOverview={habitOverview}
      onOpenHabitDetail={onOpenHabitDetail}
    >
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
          {state.showArchived ? '还没有已归档便签。' : filters.isFilterMode ? '没有匹配的内容。' : meta.board.emptyLabel}
        </div>
      ) : (
        <div className="space-y-7">
          {feedGroups.map((group) => (
            <section key={group.id} className="space-y-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {group.kind === 'date' && group.dateHeader ? (
                  <div className="flex shrink-0 items-stretch gap-3">
                    <span className="flex items-end text-[38px] font-semibold leading-[0.82] tracking-[-0.06em] text-foreground/95 sm:text-[46px]">
                      {group.dateHeader.dayLabel}
                    </span>
                    <div className={`flex ${DATE_META_BLOCK_HEIGHT_CLASS} flex-col justify-between py-[1px]`}>
                      <p className="text-[15px] font-medium leading-none text-foreground/80 sm:text-[17px]">
                        {group.dateHeader.weekdayLabel}
                      </p>
                      <p className="text-[11px] leading-none tracking-[0.16em] text-muted-foreground/70 sm:text-[12px]">
                        {group.dateHeader.monthYearLabel}
                      </p>
                    </div>
                  </div>
                ) : (
                  <span className="shrink-0 text-[12px] font-medium tracking-[0.18em] text-muted-foreground">
                    {group.label}
                  </span>
                )}
                <div className="h-px min-w-[96px] flex-1 bg-border/40" />
                <span className="inline-flex h-8 items-center rounded-full border border-border/50 bg-background/80 px-3 text-[12px] font-medium text-muted-foreground shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
                  {group.items.length}条
                </span>
              </div>
              <div className="space-y-3">
                {group.items.map((item) => (
                  <div
                    key={item.message.id}
                    style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 120px' }}
                  >
                    <MemoStreamCard
                      item={item}
                      habitStates={habitOverview?.currentStates[item.message.id]}
                      onOpenHabitDetail={onOpenHabitDetail}
                      onCompleteHabitItem={onCompleteHabitItem}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}

          {state.hasMore && !filters.effectiveSelectedDate ? (
            <div ref={sentinelRef} className="flex justify-center py-6">
              {state.isPending ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
              ) : null}
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground/50">
              · 已加载全部内容 ·
            </p>
          )}
        </div>
      )}
    </MemoBoardShell>
  )
}
