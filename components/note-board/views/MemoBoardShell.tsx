'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlarmClock, Archive, ArrowDown, ArrowUp, ArrowUpDown, CalendarCheck, CalendarDays, Check, ChevronDown, Layers, LayoutList, Palette, Plus, Search, X } from 'lucide-react'
import {
  useNoteBoardActions,
  useNoteBoardBoardState,
} from '@/components/note-board/NoteBoardProvider'
import type { NoteCardViewModel } from '@/components/note-board/types'
import { SidebarAgendaCalendar, SidebarCalendar, SidebarTagCloud, getShanghaDateParts, toDateKey } from '@/components/note-board/views/MemoSidebar'
import type { MemoAgendaItem } from '@/lib/note-boards'
import { NOTE_COLOR_THEMES, useNoteColorTheme } from '@/components/note-board/contexts/NoteColorThemeContext'
import type { NoteSortMode } from '@/lib/note-priority'

function getItemDateKey(item: NoteCardViewModel) {
  const ts = item.message.updated_at ?? item.message.created_at
  const { year, month, day } = getShanghaDateParts(ts)
  return toDateKey(year, month, day)
}

// ── 搜索框 ──────────────────────────────────────────────────────────────────
function MemoSearchField({ placeholder }: { placeholder: string }) {
  const state = useNoteBoardBoardState()
  const actions = useNoteBoardActions()
  const [localQuery, setLocalQuery] = useState(state.searchQuery)
  const [isFocused, setIsFocused] = useState(false)
  const [isExpanding, setIsExpanding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const displayedQuery = isFocused ? localQuery : state.searchQuery
  const hasQuery = displayedQuery.length > 0
  const isExpanded = isFocused || isExpanding || state.searchQuery.length > 0

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

  function handleExpandAndFocus() {
    setIsExpanding(true)
    expandTimerRef.current = setTimeout(() => {
      inputRef.current?.focus()
    }, 400)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={[
        'group relative shrink-0 overflow-hidden border h-[34px] rounded-full transition-[width,background,box-shadow,border-color] duration-[600ms]',
        isExpanded
          ? 'border-primary/25 bg-background/95 ring-2 ring-primary/20'
          : 'border-border/70 bg-background/70 hover:bg-accent/35 hover:ring-2 hover:ring-primary/20',
      ].join(' ')}
      style={{
        width: isExpanded ? 'min(210px, 100%)' : '34px',
        transitionTimingFunction: isExpanded ? 'cubic-bezier(0,1.22,.66,1.39)' : 'cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={displayedQuery}
        onChange={(event) => setLocalQuery(event.target.value)}
        onFocus={() => {
          if (expandTimerRef.current) { clearTimeout(expandTimerRef.current); expandTimerRef.current = null }
          setIsExpanding(false)
          setLocalQuery(state.searchQuery)
          setIsFocused(true)
        }}
        onBlur={() => {
          setIsFocused(false)
          setLocalQuery(state.searchQuery)
        }}
        placeholder={placeholder}
        className={[
          'h-full w-full border-0 bg-transparent pr-[36px] text-[13px] outline-none transition-[padding,color,text-indent] duration-[600ms]',
          isExpanded
            ? 'cursor-text pl-3.5 text-foreground placeholder:text-muted-foreground/60'
            : 'cursor-pointer pl-0 text-transparent placeholder:text-transparent [text-indent:-9999px]',
        ].join(' ')}
        style={{ transitionTimingFunction: 'cubic-bezier(0,1.22,.66,1.39)' }}
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={hasQuery ? handleClear : handleExpandAndFocus}
        className="absolute inset-y-0 right-0 flex h-[34px] w-[34px] items-center justify-center text-muted-foreground transition hover:text-foreground"
        aria-label={hasQuery ? '清除搜索' : '搜索'}
      >
        <Search size={14} className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${hasQuery ? 'scale-75 opacity-0' : 'scale-100 opacity-100'}`} />
        <X size={13} className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${hasQuery ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`} />
      </button>
    </form>
  )
}

// ── 排序下拉 ────────────────────────────────────────────────────────────────
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
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
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
    if (state.showArchived) actions.handleSwitchArchiveView(false)
    actions.handleSortModeChange(nextSortMode)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`排序：${currentLabel}${!state.showArchived ? ` · ${directionLabel}` : ''}`}
        className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-border/70 bg-background/70 text-muted-foreground transition hover:bg-accent hover:text-foreground"
      >
        <ArrowUpDown size={14} />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-1.5 min-w-[164px] overflow-hidden rounded-2xl border border-border/70 bg-card shadow-lg">
          <button
            type="button"
            onClick={() => handleSelectSort('time')}
            className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-[13px] transition ${!state.showArchived && state.sortMode === 'time' ? 'bg-foreground/5 font-medium text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
          >
            {!state.showArchived && state.sortMode === 'time' ? <Check size={13} className="shrink-0" /> : <span className="w-[13px] shrink-0" />}
            <span className="flex-1 text-left">按日期</span>
            {!state.showArchived && state.sortMode === 'time' ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <SortDirectionIcon size={11} />
                {directionLabel}
              </span>
            ) : null}
          </button>
          {allowPrioritySort ? (
            <button
              type="button"
              onClick={() => handleSelectSort('priority')}
              className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-[13px] transition ${!state.showArchived && state.sortMode === 'priority' ? 'bg-foreground/5 font-medium text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
            >
              {!state.showArchived && state.sortMode === 'priority' ? <Check size={13} className="shrink-0" /> : <span className="w-[13px] shrink-0" />}
              <span className="flex-1 text-left">按优先级</span>
              {!state.showArchived && state.sortMode === 'priority' ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <SortDirectionIcon size={11} />
                  {directionLabel}
                </span>
              ) : null}
            </button>
          ) : null}
          <div className="mx-3 border-t border-border/40" />
          <button
            type="button"
            onClick={() => { actions.handleSwitchArchiveView(!state.showArchived); setOpen(false) }}
            className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-[13px] transition ${state.showArchived ? 'bg-foreground/5 font-medium text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
          >
            {state.showArchived ? <Check size={13} className="shrink-0" /> : <span className="w-[13px] shrink-0" />}
            已归档
          </button>
        </div>
      ) : null}
    </div>
  )
}

// ── 配色主题切换 ─────────────────────────────────────────────────────────────
function NoteThemeButton() {
  const { theme, setThemeId } = useNoteColorTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`便签配色：${theme.label} · ${theme.subtitle}`}
        className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-border/70 bg-background/70 text-muted-foreground transition hover:bg-accent hover:text-foreground"
      >
        <Palette size={14} />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-[1000] mt-1.5 min-w-[196px] overflow-hidden rounded-2xl border border-border/70 bg-card p-1.5 shadow-lg">
          {NOTE_COLOR_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setThemeId(t.id); setOpen(false) }}
              className={[
                'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition',
                t.id === theme.id
                  ? 'bg-foreground/5 font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              ].join(' ')}
            >
              <div className="flex gap-0.5 shrink-0">
                {t.colors.slice(0, 5).map((c, i) => (
                  <span
                    key={i}
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: c, boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }}
                  />
                ))}
              </div>
              <span className="flex-1 text-[13px]">{t.label}</span>
              <span className="text-[11px] opacity-55">{t.subtitle}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ── 快速筛选 ────────────────────────────────────────────────────────────────
function SidebarQuickFilters({ filters, agendaItems }: { filters: MemoBoardFilters; agendaItems?: MemoAgendaItem[] | null }) {
  const state = useNoteBoardBoardState()
  const actions = useNoteBoardActions()
  const today = useMemo(() => {
    const { year, month, day } = getShanghaDateParts(new Date())
    return toDateKey(year, month, day)
  }, [])

  const isAll = !state.searchQuery && state.activeTags.length === 0 && !filters.effectiveSelectedDate && !state.activeDueDate && !state.showArchived
  const isTodayCreated = filters.effectiveSelectedDate === today && !state.searchQuery && state.activeTags.length === 0 && !state.activeDueDate
  const isTodayDue = state.activeDueDate === today && !state.searchQuery && state.activeTags.length === 0 && !filters.effectiveSelectedDate

  const todayDueCount = useMemo(() => {
    if (!agendaItems) return 0
    return agendaItems.filter((item) => {
      const { year, month, day } = getShanghaDateParts(item.dueAt)
      return toDateKey(year, month, day) === today
    }).length
  }, [agendaItems, today])

  const todayCreatedCount = filters.memoDateCounts.get(today) ?? 0

  function handleAll() {
    if (state.searchQuery) actions.handleSearch('')
    if (state.activeTags.length > 0) actions.handleTagFilter('')
    if (state.activeDueDate) actions.handleDueDateFilter(null)
    if (state.showArchived) actions.handleSwitchArchiveView(false)
    filters.clearDateFilter()
  }

  function handleTodayCreated() {
    if (state.searchQuery) actions.handleSearch('')
    if (state.activeTags.length > 0) actions.handleTagFilter('')
    if (state.showArchived) actions.handleSwitchArchiveView(false)
    if (state.activeDueDate) actions.handleDueDateFilter(null)
    filters.setSelectedDate(isTodayCreated ? null : today)
  }

  function handleTodayDue() {
    if (state.searchQuery) actions.handleSearch('')
    if (state.activeTags.length > 0) actions.handleTagFilter('')
    if (state.showArchived) actions.handleSwitchArchiveView(false)
    filters.clearDateFilter()
    actions.handleDueDateFilter(isTodayDue ? null : today)
  }

  const quickFilters = [
    { key: 'all', label: '全部便签', icon: Layers, active: isAll, count: state.totalLoaded, onClick: handleAll },
    { key: 'today-created', label: '今日创建', icon: CalendarCheck, active: isTodayCreated, count: todayCreatedCount, onClick: handleTodayCreated },
    { key: 'today-due', label: '今日截止', icon: AlarmClock, active: isTodayDue, count: todayDueCount, onClick: handleTodayDue },
    { key: 'archive', label: '已归档', icon: Archive, active: state.showArchived, count: null, onClick: () => actions.handleSwitchArchiveView(!state.showArchived) },
  ] as const

  return (
    <div className="space-y-2">
      <p className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">快速筛选</p>
      <div className="flex flex-col gap-0.5">
        {quickFilters.map(({ key, label, icon: Icon, active, count, onClick }) => (
          <button
            key={key}
            type="button"
            onClick={onClick}
            className={[
              'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition',
              active
                ? 'bg-[#c0644a]/10 font-medium text-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            ].join(' ')}
          >
            <Icon size={13} className="shrink-0 opacity-70" />
            <span className="flex-1 text-left">{label}</span>
            {count !== null ? (
              <span className={['text-[11px] tabular-nums', active ? 'text-foreground/55' : 'text-muted-foreground/50'].join(' ')}>
                {count}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Filters hook ─────────────────────────────────────────────────────────────
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
  externalDateCounts: Map<string, number> | null,
): MemoBoardFilters {
  const state = useNoteBoardBoardState()
  const actions = useNoteBoardActions()
  const effectiveSelectedDate = state.searchQuery || state.activeTags.length > 0 ? null : state.activeDate

  const computedDateCounts = useMemo(() => {
    if (externalDateCounts) return externalDateCounts
    const counts = new Map<string, number>()
    for (const item of allItems) {
      const key = getItemDateKey(item)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [allItems, externalDateCounts])

  const filterItemsByDate = useCallback((items: NoteCardViewModel[]) => {
    if (!effectiveSelectedDate) return items
    return items.filter((item) => getItemDateKey(item) === effectiveSelectedDate)
  }, [effectiveSelectedDate])

  return {
    memoDateCounts: computedDateCounts,
    selectedDate: state.activeDate,
    effectiveSelectedDate,
    isFilterMode: Boolean(state.searchQuery || state.activeTags.length > 0 || effectiveSelectedDate || state.activeDueDate),
    setSelectedDate: actions.handleDateFilter,
    clearDateFilter: () => actions.handleDateFilter(null),
    filterItemsByDate,
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────
function hexToRgb(hex: string): string {
  return `${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)}`
}

// ── Shell ────────────────────────────────────────────────────────────────────
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
  agendaItems?: MemoAgendaItem[] | null
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
  agendaItems,
  extraControls,
  children,
}: MemoBoardShellProps) {
  const state = useNoteBoardBoardState()
  const actions = useNoteBoardActions()
  const { theme } = useNoteColorTheme()
  const [mobileCalendarOpen, setMobileCalendarOpen] = useState(false)
  const [calendarMode, setCalendarMode] = useState<'heatmap' | 'agenda'>('agenda')
  const isMobileCalendarOpen = state.isMobileViewport && mobileCalendarOpen

  const shellBg = `radial-gradient(ellipse at top left, rgba(${hexToRgb(theme.shell[0])},0.32) 0%, transparent 55%), radial-gradient(ellipse at bottom right, rgba(${hexToRgb(theme.shell[1])},0.26) 0%, transparent 50%)`

  const filterPillLabel = state.searchQuery
    ? `"${state.searchQuery}" · ${filteredCount}${itemUnit}`
    : state.activeTags.length > 0
      ? `${state.activeTags.map((t) => `#${t}`).join(' ')} · ${filteredCount}${itemUnit}`
      : filters.effectiveSelectedDate
        ? `${filters.effectiveSelectedDate} · ${filteredCount}${itemUnit}`
        : state.activeDueDate
          ? `截止 ${state.activeDueDate} · ${filteredCount}${itemUnit}`
          : null

  const handleClearFilter = useCallback(() => {
    if (state.searchQuery) { actions.handleSearch(''); return }
    if (state.activeTags.length > 0) { actions.handleTagFilter(''); return }
    if (state.activeDueDate) { actions.handleDueDateFilter(null); return }
    filters.clearDateFilter()
  }, [actions, filters, state.activeDueDate, state.activeTags, state.searchQuery])

  const ToggleIcon = toggleTarget === 'stream' ? LayoutList : Layers
  const toggleLabel = toggleTarget === 'stream' ? '流式视图' : '便签视图'

  return (
    <section className="rounded-[32px] border border-border/60 bg-card/95 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-6" style={{ backgroundImage: shellBg }}>
      {/* 顶部区域：标题、状态、筛选、操作 */}
      <div className="mb-5 flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h2 className="text-[28px] font-bold leading-[0.88] tracking-[-0.04em] text-foreground sm:text-[36px]">
            {title}
          </h2>
          <div className="mt-2 flex min-h-[24px] flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-[11px] uppercase leading-none tracking-[0.18em] text-muted-foreground/40">{summary}</span>
            {filters.isFilterMode && filterPillLabel ? (
              <>
                <span aria-hidden className="text-[10px] text-muted-foreground/25">·</span>
                <button
                  type="button"
                  onClick={handleClearFilter}
                  className="inline-flex items-center gap-1 rounded-full border border-[#c0644a]/20 bg-[#c0644a]/10 px-2.5 py-[3px] text-[11px] font-medium text-[#c0644a]/70 transition hover:bg-[#c0644a]/15 hover:text-[#c0644a]"
                >
                  <span className="max-w-[160px] truncate">{filterPillLabel}</span>
                  <X size={9} className="shrink-0 opacity-75" />
                </button>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:shrink-0 sm:justify-end">
          <div className="flex-1 min-w-0 sm:contents">
            <MemoSearchField placeholder={searchPlaceholder} />
          </div>
          <MemoSortDropdown allowPrioritySort={allowPrioritySort} />
          <NoteThemeButton />
          {extraControls}
          <button
            type="button"
            onClick={onToggleViewMode}
            title={toggleLabel}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-border/70 bg-background/70 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <ToggleIcon size={14} />
          </button>
          <button
            type="button"
            onClick={() => actions.scrollToEditor()}
            title="新便签"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-foreground text-background transition hover:opacity-85"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* 桌面侧边栏 */}
        <aside className="hidden shrink-0 sm:block sm:w-[240px] lg:w-[280px]">
          <div className="sticky top-6 space-y-6">
            {calendarMode === 'agenda' && agendaItems != null
              ? (
                  <SidebarAgendaCalendar
                    agendaItems={agendaItems}
                    onSwitchMode={() => setCalendarMode('heatmap')}
                  />
                )
              : (
                  <SidebarCalendar
                    memoDateCounts={filters.memoDateCounts}
                    selectedDate={filters.selectedDate}
                    onSelectDate={filters.setSelectedDate}
                    onSwitchMode={agendaItems != null ? () => setCalendarMode('agenda') : undefined}
                  />
                )}
            <SidebarQuickFilters filters={filters} agendaItems={agendaItems} />
            <SidebarTagCloud />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* 移动端日历展开 */}
          <div className="mb-3 sm:hidden">
            <button
              type="button"
              onClick={() => setMobileCalendarOpen((v) => !v)}
              className="flex h-[36px] w-full items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 text-[13px] text-muted-foreground transition hover:bg-accent"
            >
              <CalendarDays size={14} className="shrink-0" />
              <span className="flex-1 text-left">
                {filters.effectiveSelectedDate
                  ? filters.effectiveSelectedDate
                  : state.activeDueDate
                    ? `截止 ${state.activeDueDate}`
                    : calendarMode === 'agenda'
                      ? '日程视图'
                      : '按日期筛选'}
              </span>
              {filters.effectiveSelectedDate ? (
                <X size={13} onClick={(e) => { e.stopPropagation(); filters.clearDateFilter() }} />
              ) : state.activeDueDate ? (
                <X size={13} onClick={(e) => { e.stopPropagation(); actions.handleDueDateFilter(null) }} />
              ) : (
                <ChevronDown size={13} className={`transition-transform${isMobileCalendarOpen ? ' rotate-180' : ''}`} />
              )}
            </button>
            {isMobileCalendarOpen ? (
              <div className="mt-2 rounded-2xl border border-border/60 bg-background/80 p-3">
                {calendarMode === 'agenda' && agendaItems != null
                  ? (
                      <SidebarAgendaCalendar
                        agendaItems={agendaItems}
                        onSwitchMode={() => setCalendarMode('heatmap')}
                        onAfterSelect={() => setMobileCalendarOpen(false)}
                      />
                    )
                  : (
                      <SidebarCalendar
                        memoDateCounts={filters.memoDateCounts}
                        selectedDate={filters.selectedDate}
                        onSelectDate={(key) => {
                          filters.setSelectedDate(key)
                          if (key) setMobileCalendarOpen(false)
                        }}
                        onSwitchMode={agendaItems != null ? () => setCalendarMode('agenda') : undefined}
                      />
                    )}
              </div>
            ) : null}
          </div>

          {/* 移动端标签 */}
          {state.allTags.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-1.5 sm:hidden">
              {state.allTags.slice(0, 12).map(({ name }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => actions.handleTagFilter(name)}
                  className={[
                    'rounded-full px-2.5 py-1 text-[12px] transition',
                    state.activeTags.includes(name)
                      ? 'bg-foreground text-background'
                      : 'border border-border/70 text-muted-foreground hover:bg-accent',
                  ].join(' ')}
                >
                  #{name}
                </button>
              ))}
              {state.activeTags.length > 0 ? (
                <button
                  type="button"
                  onClick={() => actions.handleTagFilter('')}
                  className="flex items-center gap-1 rounded-full border border-border/70 px-2.5 py-1 text-[12px] text-muted-foreground"
                >
                  <X size={12} />
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
