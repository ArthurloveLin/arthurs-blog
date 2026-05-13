'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, Check, ChevronDown, Layers, LayoutList, Search, X } from 'lucide-react'
import {
  useNoteBoardActions,
  useNoteBoardBoardState,
} from '@/components/note-board/NoteBoardProvider'
import type { NoteCardViewModel } from '@/components/note-board/types'
import { SidebarCalendar, SidebarTagCloud, getShanghaDateParts, toDateKey } from '@/components/note-board/views/MemoSidebar'
import type { NoteSortMode } from '@/lib/note-priority'

function getItemDateKey(item: NoteCardViewModel) {
  const ts = item.message.updated_at ?? item.message.created_at
  const { year, month, day } = getShanghaDateParts(ts)
  return toDateKey(year, month, day)
}

function MemoSearchField({ placeholder }: { placeholder: string }) {
  const state = useNoteBoardBoardState()
  const actions = useNoteBoardActions()
  const [localQuery, setLocalQuery] = useState(state.searchQuery)
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const displayedQuery = isFocused ? localQuery : state.searchQuery
  const hasQuery = displayedQuery.length > 0
  const isExpanded = isFocused || state.searchQuery.length > 0

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const nextQuery = localQuery.trim()
    setLocalQuery(nextQuery)
    actions.handleSearch(nextQuery)
  }

  function handleClear() {
    setLocalQuery('')
    actions.handleSearch('')
    inputRef.current?.focus()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={[
        'group relative shrink-0 overflow-hidden border h-[30px] rounded-full transition-[width,background,box-shadow,border-color] duration-[600ms]',
        isExpanded
          ? 'border-primary/25 bg-background/95 ring-2 ring-primary/20'
          : 'border-border/70 bg-background/70 hover:bg-accent/35 hover:ring-2 hover:ring-primary/20',
      ].join(' ')}
      style={{
        width: isExpanded ? '198px' : '30px',
        transitionTimingFunction: isExpanded ? 'cubic-bezier(0,1.22,.66,1.39)' : 'cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={displayedQuery}
        onChange={(event) => setLocalQuery(event.target.value)}
        onFocus={() => {
          setLocalQuery(state.searchQuery)
          setIsFocused(true)
        }}
        onBlur={() => {
          setIsFocused(false)
          setLocalQuery(state.searchQuery)
        }}
        placeholder={placeholder}
        className={[
          'h-full w-full border-0 bg-transparent pr-[34px] text-[12px] outline-none transition-[padding,color,text-indent] duration-[600ms]',
          isExpanded
            ? 'cursor-text pl-3 text-foreground placeholder:text-muted-foreground/60'
            : 'cursor-pointer pl-0 text-transparent placeholder:text-transparent [text-indent:-9999px]',
        ].join(' ')}
        style={{
          transitionTimingFunction: 'cubic-bezier(0,1.22,.66,1.39)',
        }}
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={hasQuery ? handleClear : () => inputRef.current?.focus()}
        className="absolute inset-y-0 right-0 flex h-[30px] w-[30px] items-center justify-center text-muted-foreground transition hover:text-foreground"
        aria-label={hasQuery ? '清除搜索' : '搜索'}
      >
        <Search size={13} className={`absolute transition-all duration-200 ${hasQuery ? 'scale-75 opacity-0' : 'scale-100 opacity-100'}`} />
        <X size={12} className={`absolute transition-all duration-200 ${hasQuery ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`} />
      </button>
    </form>
  )
}

function MemoSortDropdown({ allowPrioritySort }: { allowPrioritySort: boolean }) {
  const state = useNoteBoardBoardState()
  const actions = useNoteBoardActions()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const SortDirectionIcon = state.sortDirection === 'asc' ? ArrowUp : ArrowDown
  const directionLabel = state.sortDirection === 'asc' ? '正序' : '倒序'

  useEffect(() => {
    if (!open) return

    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const currentLabel = state.showArchived
    ? '归档'
    : allowPrioritySort && state.sortMode === 'priority'
      ? '优先级'
      : '日期'

  function handleSelectSort(nextSortMode: NoteSortMode) {
    if (!state.showArchived && state.sortMode === nextSortMode) {
      actions.handleToggleSortDirection()
      setOpen(false)
      return
    }

    if (state.showArchived) {
      actions.handleSwitchArchiveView(false)
    }

    actions.handleSortModeChange(nextSortMode)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
      >
        <ArrowUpDown size={12} />
        {currentLabel}
        {!state.showArchived ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-foreground/5 px-1.5 py-0.5 text-[10px] text-foreground/65">
            <SortDirectionIcon size={10} />
            {directionLabel}
          </span>
        ) : null}
        <ChevronDown size={11} className={`transition-transform${open ? ' rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-1.5 min-w-[156px] overflow-hidden rounded-2xl border border-border/70 bg-card shadow-lg">
          <button
            type="button"
            onClick={() => handleSelectSort('time')}
            className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition ${!state.showArchived && state.sortMode === 'time' ? 'bg-foreground/5 font-medium text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
          >
            {!state.showArchived && state.sortMode === 'time' ? <Check size={11} className="shrink-0" /> : <span className="w-[11px] shrink-0" />}
            <span className="flex-1 text-left">按日期</span>
            {!state.showArchived && state.sortMode === 'time' ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <SortDirectionIcon size={10} />
                {directionLabel}
              </span>
            ) : null}
          </button>
          {allowPrioritySort ? (
            <button
              type="button"
              onClick={() => handleSelectSort('priority')}
              className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition ${!state.showArchived && state.sortMode === 'priority' ? 'bg-foreground/5 font-medium text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
            >
              {!state.showArchived && state.sortMode === 'priority' ? <Check size={11} className="shrink-0" /> : <span className="w-[11px] shrink-0" />}
              <span className="flex-1 text-left">按优先级</span>
              {!state.showArchived && state.sortMode === 'priority' ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <SortDirectionIcon size={10} />
                  {directionLabel}
                </span>
              ) : null}
            </button>
          ) : null}
          <div className="mx-3 border-t border-border/40" />
          <button
            type="button"
            onClick={() => {
              actions.handleSwitchArchiveView(!state.showArchived)
              setOpen(false)
            }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition ${state.showArchived ? 'bg-foreground/5 font-medium text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
          >
            {state.showArchived ? <Check size={11} className="shrink-0" /> : <span className="w-[11px] shrink-0" />}
            已归档
          </button>
        </div>
      ) : null}
    </div>
  )
}

export interface MemoBoardFilters {
  memoDateCounts: Map<string, number>
  selectedDate: string | null
  effectiveSelectedDate: string | null
  isFilterMode: boolean
  setSelectedDate: (key: string | null) => void
  clearDateFilter: () => void
  filterItemsByDate: (items: NoteCardViewModel[]) => NoteCardViewModel[]
}

export function useMemoBoardFilters(
  allItems: NoteCardViewModel[],
  selectedDate: string | null,
  setSelectedDate: (key: string | null) => void,
): MemoBoardFilters {
  const state = useNoteBoardBoardState()
  const effectiveSelectedDate = state.searchQuery || state.activeTag ? null : selectedDate

  const memoDateCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of allItems) {
      const key = getItemDateKey(item)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [allItems])

  const filterItemsByDate = useCallback((items: NoteCardViewModel[]) => {
    if (!effectiveSelectedDate) {
      return items
    }

    return items.filter((item) => getItemDateKey(item) === effectiveSelectedDate)
  }, [effectiveSelectedDate])

  return {
    memoDateCounts,
    selectedDate,
    effectiveSelectedDate,
    isFilterMode: Boolean(state.searchQuery || state.activeTag || effectiveSelectedDate),
    setSelectedDate,
    clearDateFilter: () => setSelectedDate(null),
    filterItemsByDate,
  }
}

interface MemoBoardShellProps {
  title: string
  summary: string
  itemUnit: string
  filteredCount: number
  toggleTarget: 'sticky' | 'stream'
  onToggleViewMode: () => void
  filters: MemoBoardFilters
  searchPlaceholder: string
  allowPrioritySort: boolean
  extraControls?: ReactNode
  children: ReactNode
}

export function MemoBoardShell({
  title,
  summary,
  itemUnit,
  filteredCount,
  toggleTarget,
  onToggleViewMode,
  filters,
  searchPlaceholder,
  allowPrioritySort,
  extraControls,
  children,
}: MemoBoardShellProps) {
  const state = useNoteBoardBoardState()
  const actions = useNoteBoardActions()
  const [mobileCalendarOpen, setMobileCalendarOpen] = useState(false)
  const isMobileCalendarOpen = state.isMobileViewport && mobileCalendarOpen

  const filterLabel = state.searchQuery
    ? `搜索：“${state.searchQuery}”，共 ${filteredCount} ${itemUnit}`
    : state.activeTag
      ? `标签：#${state.activeTag}，共 ${filteredCount} ${itemUnit}`
      : filters.effectiveSelectedDate
        ? `日期：${filters.effectiveSelectedDate}，共 ${filteredCount} ${itemUnit}`
        : null

  const handleClearFilter = useCallback(() => {
    if (state.searchQuery) {
      actions.handleSearch('')
      return
    }

    if (state.activeTag) {
      actions.handleTagFilter(state.activeTag)
      return
    }

    filters.clearDateFilter()
  }, [actions, filters, state.activeTag, state.searchQuery])

  const ToggleIcon = toggleTarget === 'stream' ? LayoutList : Layers
  const toggleLabel = toggleTarget === 'stream' ? '流式视图' : '便签视图'

  return (
    <section className="rounded-[32px] border border-border/60 bg-card/95 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground/60">{summary}</p>
        </div>
        <div className="flex items-center gap-2">
          <MemoSearchField placeholder={searchPlaceholder} />
          <MemoSortDropdown allowPrioritySort={allowPrioritySort} />
          {extraControls}
          <button
            type="button"
            onClick={onToggleViewMode}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <ToggleIcon size={13} />
            <span className="hidden sm:inline">{toggleLabel}</span>
            <span className="sm:hidden">切换视图</span>
          </button>
        </div>
      </div>

      {filters.isFilterMode && filterLabel ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[16px] border border-border/60 bg-background/60 px-4 py-2 text-xs text-muted-foreground">
          <span className="flex-1">{filterLabel}</span>
          <button
            type="button"
            onClick={handleClearFilter}
            className="flex items-center gap-0.5 hover:text-foreground"
          >
            <X size={12} />
            清除筛选
          </button>
        </div>
      ) : null}

      <div className="flex gap-6">
        <aside className="hidden shrink-0 sm:block sm:w-[180px] lg:w-[200px]">
          <div className="sticky top-6 space-y-6">
            <SidebarCalendar
              memoDateCounts={filters.memoDateCounts}
              selectedDate={filters.selectedDate}
              onSelectDate={filters.setSelectedDate}
            />
            <SidebarTagCloud />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-3 sm:hidden">
            <button
              type="button"
              onClick={() => setMobileCalendarOpen((value) => !value)}
              className="flex w-full items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent"
            >
              <CalendarDays size={13} className="shrink-0" />
              <span className="flex-1 text-left">{filters.effectiveSelectedDate ?? '按日期筛选'}</span>
              {filters.effectiveSelectedDate ? (
                <X size={12} onClick={(event) => {
                  event.stopPropagation()
                  filters.clearDateFilter()
                }} />
              ) : (
                <ChevronDown size={12} className={`transition-transform${isMobileCalendarOpen ? ' rotate-180' : ''}`} />
              )}
            </button>
            {isMobileCalendarOpen ? (
              <div className="mt-2 rounded-2xl border border-border/60 bg-background/80 p-3">
                <SidebarCalendar
                  memoDateCounts={filters.memoDateCounts}
                  selectedDate={filters.selectedDate}
                  onSelectDate={(key) => {
                    filters.setSelectedDate(key)
                    if (key) {
                      setMobileCalendarOpen(false)
                    }
                  }}
                />
              </div>
            ) : null}
          </div>

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

          {children}
        </div>
      </div>
    </section>
  )
}