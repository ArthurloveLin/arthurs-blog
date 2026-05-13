'use client'

import { useEffect, useMemo, useRef } from 'react'
import {
  useNoteBoardActions,
  useNoteBoardBoardState,
  useNoteBoardMeta,
} from '@/components/note-board/NoteBoardProvider'
import { MemoBoardShell, type MemoBoardFilters } from '@/components/note-board/views/MemoBoardShell'
import { MemoStreamCard } from '@/components/note-board/views/MemoStreamCard'
import { getShanghaDateParts, toDateKey } from '@/components/note-board/views/MemoSidebar'
import type { NoteCardViewModel } from '@/components/note-board/types'
import { formatStableDate } from '@/lib/date-format'
import { NOTE_PRIORITY_META } from '@/lib/note-priority'

interface MemosStreamViewProps {
  onToggleViewMode: () => void
  filters: MemoBoardFilters
}

type FeedGroup = {
  id: string
  label: string
  items: NoteCardViewModel[]
}

export function MemosStreamView({ onToggleViewMode, filters }: MemosStreamViewProps) {
  const state = useNoteBoardBoardState()
  const actions = useNoteBoardActions()
  const meta = useNoteBoardMeta()
  const sentinelRef = useRef<HTMLDivElement>(null)
  const filteredItems = filters.filterItemsByDate(state.allNoteItems)

  const feedGroups = useMemo<FeedGroup[]>(() => {
    if (meta.board.slug === 'memo' && state.sortMode === 'priority') {
      return ([2, 1, 0] as const)
        .map((priority) => ({
          priority,
          items: filteredItems.filter((item) => (item.message.priority ?? 1) === priority),
        }))
        .filter((group) => group.items.length > 0)
        .map((group) => ({
          id: `priority:${group.priority}`,
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
        groups.push({ id: `date:${dateKey}:${item.message.id}`, label, items: [] })
      }
      groups[groups.length - 1]?.items.push(item)
    }

    return groups
  }, [filteredItems, meta.board.slug, state.sortMode])

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
        <div>
          {feedGroups.map((group) => (
            <div key={group.id}>
              <div className="relative my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-border/40" />
                <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                  {group.label}
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
