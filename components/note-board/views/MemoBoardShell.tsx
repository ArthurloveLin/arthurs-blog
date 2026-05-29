'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, Check, ChevronDown, Filter, Layers, LayoutList, Palette, Plus, Search, X } from 'lucide-react'
import {
  useNoteBoardActions,
  useNoteBoardBoardState,
  useNoteBoardMeta,
} from '@/components/note-board/NoteBoardProvider'
import type { NoteCardViewModel } from '@/components/note-board/types'
import { SidebarAgendaCalendar, SidebarCalendar, SidebarHabitHistory, SidebarTagCloud, getShanghaDateParts, toDateKey } from '@/components/note-board/views/MemoSidebar'
import type { MemoHabitOverview } from '@/lib/memo-habits'
import type { MemoAgendaItem } from '@/lib/note-boards'
import { NOTE_COLOR_THEMES, useNoteColorTheme } from '@/components/note-board/contexts/NoteColorThemeContext'
import type { NoteSortMode } from '@/lib/note-priority'

const CONTROL_BUTTON_CLASS = 'flex h-[34px] w-[34px] items-center justify-center rounded-full border transition [border-color:var(--memo-control-border)] [background:var(--memo-control-surface)] text-[color:var(--memo-control-text)] hover:[background:var(--memo-control-hover-surface)] hover:text-[color:var(--memo-control-hover-text)]'
const MENU_PANEL_CLASS = 'absolute right-0 top-full mt-1.5 overflow-hidden rounded-2xl border [border-color:var(--memo-panel-border)] [background:var(--memo-panel-surface)] [box-shadow:var(--memo-panel-shadow)]'
const MENU_ITEM_BASE_CLASS = 'flex w-full items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] transition'
const MENU_ITEM_ACTIVE_CLASS = '[background:var(--memo-control-active-surface)] font-medium text-[color:var(--memo-control-active-text)]'
const MENU_ITEM_IDLE_CLASS = 'text-[color:var(--memo-control-text)] hover:[background:var(--memo-control-hover-surface)] hover:text-[color:var(--memo-control-hover-text)]'
const SIDEBAR_PANEL_CLASS = 'rounded-[24px] border p-4 [border-color:var(--memo-panel-border)] [background:var(--memo-panel-surface)] [box-shadow:var(--memo-panel-shadow)]'

function getItemDateKey(item: NoteCardViewModel) {
  const { year, month, day } = getShanghaDateParts(item.message.created_at)
  return toDateKey(year, month, day)
}

// ── 搜索框 ──────────────────────────────────────────────────────────────────
function MemoSearchField({ placeholder }: { placeholder: string }) {
  const EXPAND_DURATION_MS = 600
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
  const showInputContent = isFocused || state.searchQuery.length > 0

  useEffect(() => {
    return () => {
      if (expandTimerRef.current) {
        clearTimeout(expandTimerRef.current)
      }
    }
  }, [])

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
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current)
    }

    setIsExpanding(true)
    expandTimerRef.current = setTimeout(() => {
      inputRef.current?.focus()
    }, EXPAND_DURATION_MS)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="group relative shrink-0 h-[34px] w-[34px]"
      style={{ zIndex: isExpanded ? 10 : undefined }}
    >
      {/* Expanding container anchored at the RIGHT edge — grows to the LEFT so it never
          pushes neighbouring flex items rightward on mobile. */}
      <div
        className={[
          'absolute right-0 top-0 h-full rounded-full border overflow-hidden',
          'transition-[width,background,box-shadow,border-color] duration-[600ms]',
          isExpanded
            ? '[border-color:var(--memo-control-border)] [background:var(--memo-control-surface)]'
            : '[border-color:var(--memo-control-border)] [background:var(--memo-control-surface)] group-hover:[border-color:var(--memo-filter-border)]',
        ].join(' ')}
        style={{
          width: isExpanded ? 'min(210px, 80vw)' : '34px',
          transitionTimingFunction: isExpanded ? 'cubic-bezier(0,1.22,.66,1.39)' : 'cubic-bezier(0.4,0,0.2,1)',
          boxShadow: isExpanded ? '0 0 0 1px var(--memo-filter-border)' : undefined,
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
            showInputContent
              ? 'pointer-events-auto cursor-text pl-3.5 text-[color:var(--memo-shell-heading)] placeholder:text-muted-foreground/60'
              : 'pointer-events-none cursor-pointer pl-0 text-transparent caret-transparent placeholder:text-transparent [text-indent:-9999px]',
          ].join(' ')}
          style={{ transitionTimingFunction: 'cubic-bezier(0,1.22,.66,1.39)' }}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      {/* Button stays at a fixed position (right side of the 34px wrapper) */}
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={hasQuery ? handleClear : handleExpandAndFocus}
        className="absolute inset-0 z-10 flex h-[34px] w-[34px] items-center justify-center text-[color:var(--memo-control-text)] transition hover:text-[color:var(--memo-control-hover-text)]"
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
        className={CONTROL_BUTTON_CLASS}
      >
        <ArrowUpDown size={14} />
      </button>
      {open ? (
        <div className={`${MENU_PANEL_CLASS} z-20 min-w-[164px] p-1.5`}>
          <button
            type="button"
            onClick={() => handleSelectSort('time')}
            className={`${MENU_ITEM_BASE_CLASS} ${!state.showArchived && state.sortMode === 'time' ? MENU_ITEM_ACTIVE_CLASS : MENU_ITEM_IDLE_CLASS}`}
          >
            {!state.showArchived && state.sortMode === 'time' ? <Check size={13} className="shrink-0" /> : <span className="w-[13px] shrink-0" />}
            <span className="flex-1 text-left">按日期</span>
            {!state.showArchived && state.sortMode === 'time' ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-[color:var(--memo-shell-muted)]">
                <SortDirectionIcon size={11} />
                {directionLabel}
              </span>
            ) : null}
          </button>
          {allowPrioritySort ? (
            <button
              type="button"
              onClick={() => handleSelectSort('priority')}
              className={`${MENU_ITEM_BASE_CLASS} ${!state.showArchived && state.sortMode === 'priority' ? MENU_ITEM_ACTIVE_CLASS : MENU_ITEM_IDLE_CLASS}`}
            >
              {!state.showArchived && state.sortMode === 'priority' ? <Check size={13} className="shrink-0" /> : <span className="w-[13px] shrink-0" />}
              <span className="flex-1 text-left">按优先级</span>
              {!state.showArchived && state.sortMode === 'priority' ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-[color:var(--memo-shell-muted)]">
                  <SortDirectionIcon size={11} />
                  {directionLabel}
                </span>
              ) : null}
            </button>
          ) : null}
          <div className="mx-3 border-t [border-color:var(--memo-panel-border)] opacity-80" />
          <button
            type="button"
            onClick={() => { actions.handleSwitchArchiveView(!state.showArchived); setOpen(false) }}
            className={`${MENU_ITEM_BASE_CLASS} ${state.showArchived ? MENU_ITEM_ACTIVE_CLASS : MENU_ITEM_IDLE_CLASS}`}
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
        className={CONTROL_BUTTON_CLASS}
      >
        <Palette size={14} />
      </button>
      {open ? (
        <div className={`${MENU_PANEL_CLASS} z-[1000] w-[176px] p-1`}>
          <div className="grid grid-cols-3 gap-0.5">
            {NOTE_COLOR_THEMES.map((t) => {
              const isActive = t.id === theme.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setThemeId(t.id); setOpen(false) }}
                  aria-label={t.label}
                  aria-pressed={isActive}
                  title={`${t.label} · ${t.subtitle}`}
                  className={[
                    'flex flex-col items-center gap-[3px] py-2 rounded-xl transition',
                    isActive
                      ? `${MENU_ITEM_ACTIVE_CLASS} ring-1`
                      : MENU_ITEM_IDLE_CLASS,
                  ].join(' ')}
                >
                  <span className="text-sm leading-none" aria-hidden="true">{t.icon}</span>
                  <div className="flex gap-[3px] mt-0.5">
                    {t.colors.slice(0, 3).map((c, i) => (
                      <span
                        key={i}
                        className="w-[5px] h-[5px] rounded-full"
                        style={{ backgroundColor: c, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }}
                      />
                    ))}
                  </div>
                  <span className="text-[9px] font-medium leading-none mt-0.5 opacity-70">{t.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ── 快速筛选 ────────────────────────────────────────────────────────────────
function SidebarQuickFilters({ filters, agendaItems }: { filters: MemoBoardFilters; agendaItems?: MemoAgendaItem[] | null }) {
  const state = useNoteBoardBoardState()
  const actions = useNoteBoardActions()
  const meta = useNoteBoardMeta()
  const isGuestboard = meta.board.slug === 'guestbook'
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

  const allCount = useMemo(() => {
    if (isGuestboard) {
      return state.totalLoaded
    }

    let total = 0
    filters.memoDateCounts.forEach((count) => {
      total += count
    })
    return total
  }, [filters.memoDateCounts, isGuestboard, state.totalLoaded])

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

  type QuickFilter = { key: string; label: string; active: boolean; count: number | null; onClick: () => void }
  const quickFilters: QuickFilter[] = [
    { key: 'all', label: isGuestboard ? '全部留言' : '全部便签', active: isAll, count: allCount, onClick: handleAll },
    { key: 'today-created', label: '今日创建', active: isTodayCreated, count: todayCreatedCount, onClick: handleTodayCreated },
    ...(!isGuestboard ? [
      { key: 'today-due', label: '今日截止', active: isTodayDue, count: todayDueCount, onClick: handleTodayDue },
    ] : []),
    { key: 'archive', label: '已归档', active: state.showArchived, count: null, onClick: () => actions.handleSwitchArchiveView(!state.showArchived) },
  ]

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold uppercase tracking-[0.12em] text-[color:var(--memo-shell-muted)]">
        <Filter size={11} />
        快速筛选
      </p>
      <div className="flex flex-col gap-0.5">
        {quickFilters.map(({ key, label, active, count, onClick }) => (
          <button
            key={key}
            type="button"
            onClick={onClick}
            className={[
              'flex w-full items-center rounded-lg px-2.5 py-2 text-[13px] transition',
              active
                ? '[background:var(--memo-control-active-surface)] font-medium text-[color:var(--memo-control-active-text)]'
                : 'text-[color:var(--memo-control-text)] hover:[background:var(--memo-control-hover-surface)] hover:text-[color:var(--memo-control-hover-text)]',
            ].join(' ')}
          >
            <span className="flex-1 text-left">{label}</span>
            {count !== null ? (
              <span className={['text-[11px] tabular-nums', active ? 'opacity-65' : 'opacity-55'].join(' ')}>
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
  setHistoryFilter: (date: string | null, ids: string[] | null) => void
  clearDateFilter: () => void
  filterItemsByDate: (items: NoteCardViewModel[]) => NoteCardViewModel[]
}

export function useMemoBoardFilters(
  allItems: NoteCardViewModel[],
  externalDateCounts: Map<string, number> | null,
): MemoBoardFilters {
  const state = useNoteBoardBoardState()
  const actions = useNoteBoardActions()
  const baseDateFilter = state.searchQuery || state.activeTags.length > 0 ? null : state.activeDate

  // historySelectedDate tracks the date selected in the history view for UI purposes
  // (filter badge display, HistoryDayPanel "isFiltered" check) without triggering
  // an API re-fetch by date. historyNoteIds holds the IDs to filter client-side.
  const [historyNoteIds, setHistoryNoteIds] = useState<string[] | null>(null)
  const [historySelectedDate, setHistorySelectedDate] = useState<string | null>(null)

  // When in history mode, show historySelectedDate in the filter badge instead of
  // the API-backed baseDateFilter, which is not set in that mode.
  const effectiveSelectedDate = historySelectedDate ?? baseDateFilter

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
    // History filter: filter by note IDs client-side without touching the API query.
    // Must be checked before effectiveSelectedDate so that switching dates in the
    // history view does not trigger an API re-fetch (which would return notes filtered
    // by creation date, losing habit-event notes that were created on other dates).
    if (historyNoteIds !== null) {
      const idSet = new Set(historyNoteIds)
      return items.filter((item) => idSet.has(item.message.id))
    }
    if (!effectiveSelectedDate) return items
    return items.filter((item) => getItemDateKey(item) === effectiveSelectedDate)
  }, [effectiveSelectedDate, historyNoteIds])

  const setHistoryFilter = useCallback((date: string | null, ids: string[] | null) => {
    setHistorySelectedDate(date)
    setHistoryNoteIds(ids)
  }, [])

  return {
    memoDateCounts: computedDateCounts,
    selectedDate: state.activeDate,
    effectiveSelectedDate,
    isFilterMode: Boolean(state.searchQuery || state.activeTags.length > 0 || effectiveSelectedDate || state.activeDueDate || historyNoteIds !== null),
    setSelectedDate: actions.handleDateFilter,
    setHistoryFilter,
    clearDateFilter: () => { actions.handleDateFilter(null); setHistoryNoteIds(null); setHistorySelectedDate(null) },
    filterItemsByDate,
  }
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
  habitOverview?: MemoHabitOverview | null
  onOpenHabitDetail?: (noteId: string, itemKey: string, source?: 'sidebar' | 'note') => void
  showSidebar?: boolean
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
  habitOverview,
  onOpenHabitDetail,
  showSidebar = true,
  extraControls,
  children,
}: MemoBoardShellProps) {
  const state = useNoteBoardBoardState()
  const actions = useNoteBoardActions()
  const meta = useNoteBoardMeta()
  const isGuestboard = meta.board.slug === 'guestbook'
  const { theme } = useNoteColorTheme()
  const [mobileCalendarOpen, setMobileCalendarOpen] = useState(false)
  const [calendarMode, setCalendarMode] = useState<'heatmap' | 'agenda' | 'history'>('agenda')
  const [mobileTagsExpanded, setMobileTagsExpanded] = useState(false)
  const isMobileCalendarOpen = state.isMobileViewport && mobileCalendarOpen
  const resolvedCalendarMode = !habitOverview && calendarMode === 'history' ? 'agenda' : calendarMode
  const sidebarModes = useMemo(() => [
    { key: 'agenda' as const, label: '日程' },
    { key: 'heatmap' as const, label: '热力' },
    { key: 'history' as const, label: '历史' },
  ], [])

  const themeVars = {
    '--memo-shell-surface': theme.chrome.shellSurface,
    '--memo-shell-border': theme.chrome.shellBorder,
    '--memo-shell-shadow': theme.chrome.shellShadow,
    '--memo-shell-heading': theme.chrome.heading,
    '--memo-shell-summary': theme.chrome.summary,
    '--memo-shell-muted': theme.chrome.muted,
    '--memo-control-surface': theme.chrome.controlSurface,
    '--memo-control-border': theme.chrome.controlBorder,
    '--memo-control-text': theme.chrome.controlText,
    '--memo-control-hover-surface': theme.chrome.controlHoverSurface,
    '--memo-control-hover-text': theme.chrome.controlHoverText,
    '--memo-control-active-surface': theme.chrome.controlActiveSurface,
    '--memo-control-active-text': theme.chrome.controlActiveText,
    '--memo-panel-surface': theme.chrome.panelSurface,
    '--memo-panel-muted-surface': theme.chrome.panelMutedSurface,
    '--memo-panel-border': theme.chrome.panelBorder,
    '--memo-panel-shadow': theme.chrome.panelShadow,
    '--memo-card-surface': theme.chrome.cardSurface,
    '--memo-card-editing-surface': theme.chrome.cardEditingSurface,
    '--memo-card-border': theme.chrome.cardBorder,
    '--memo-card-hover-border': theme.chrome.cardHoverBorder,
    '--memo-card-text': theme.chrome.cardText,
    '--memo-card-muted': theme.chrome.cardMuted,
    '--memo-card-shadow': theme.chrome.cardShadow,
    '--memo-card-hover-shadow': theme.chrome.cardHoverShadow,
    '--memo-filter-surface': theme.chrome.filterSurface,
    '--memo-filter-border': theme.chrome.filterBorder,
    '--memo-filter-text': theme.chrome.filterText,
    '--memo-primary-surface': theme.chrome.primarySurface,
    '--memo-primary-text': theme.chrome.primaryText,
  } as CSSProperties

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
  const toggleLabel = toggleTarget === 'stream' ? '流式视图' : isGuestboard ? '留言视图' : '便签视图'

  const renderSidebarPanel = useCallback((isMobilePanel: boolean) => {
    const modeProps = {
      sidebarModes,
      calendarMode: resolvedCalendarMode,
      onCalendarModeChange: (m: 'heatmap' | 'agenda' | 'history') => setCalendarMode(m),
    }
    if (resolvedCalendarMode === 'agenda' && agendaItems != null) {
      return (
        <SidebarAgendaCalendar
          agendaItems={agendaItems}
          onAfterSelect={isMobilePanel ? () => setMobileCalendarOpen(false) : undefined}
          {...modeProps}
        />
      )
    }

    if (resolvedCalendarMode === 'history' && habitOverview && onOpenHabitDetail) {
      return (
        <SidebarHabitHistory
          overview={habitOverview}
          onOpenItemDetail={(noteId, itemKey) => onOpenHabitDetail(noteId, itemKey, 'sidebar')}
          onAfterSelect={isMobilePanel ? () => setMobileCalendarOpen(false) : undefined}
          onFilterDay={(key, noteIds) => {
            // Do NOT call setSelectedDate here: that would change activeDate and
            // trigger an SWR re-fetch filtered by creation date, which would
            // discard habit-event notes created on other dates. Instead, use
            // setHistoryFilter which only does client-side filtering by note ID.
            filters.setHistoryFilter(key, noteIds ?? null)
          }}
          selectedDate={filters.effectiveSelectedDate}
          {...modeProps}
        />
      )
    }

    return (
      <SidebarCalendar
        memoDateCounts={filters.memoDateCounts}
        selectedDate={filters.selectedDate}
        onSelectDate={(key) => {
          filters.setSelectedDate(key)
          if (isMobilePanel && key) {
            setMobileCalendarOpen(false)
          }
        }}
        {...modeProps}
      />
    )
  }, [agendaItems, filters, habitOverview, onOpenHabitDetail, resolvedCalendarMode, sidebarModes])

  return (
    <section className="rounded-[32px] border p-5 [border-color:var(--memo-shell-border)] [background:var(--memo-shell-surface)] [box-shadow:var(--memo-shell-shadow)] sm:p-6" style={themeVars}>
      {/* 顶部区域：标题、状态、筛选、操作 */}
      <div className="mb-5 flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h2 className="text-[28px] font-bold leading-[0.88] tracking-[-0.04em] text-[color:var(--memo-shell-heading)] sm:text-[36px]">
            {title}
          </h2>
          <div className="mt-2 flex min-h-[24px] flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-[11px] uppercase leading-none tracking-[0.18em] text-[color:var(--memo-shell-summary)]">{summary}</span>
            {filters.isFilterMode && filterPillLabel ? (
              <>
                <span aria-hidden className="text-[10px] text-[color:var(--memo-shell-muted)] opacity-70">·</span>
                <button
                  type="button"
                  onClick={handleClearFilter}
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-[3px] text-[11px] font-medium transition [border-color:var(--memo-filter-border)] [background:var(--memo-filter-surface)] text-[color:var(--memo-filter-text)] hover:opacity-90"
                >
                  <span className="max-w-[160px] truncate">{filterPillLabel}</span>
                  <X size={9} className="shrink-0 opacity-75" />
                </button>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1.5">
          <MemoSearchField placeholder={searchPlaceholder} />
          <MemoSortDropdown allowPrioritySort={allowPrioritySort} />
          <NoteThemeButton />
          {extraControls}
          <button
            type="button"
            onClick={onToggleViewMode}
            title={toggleLabel}
            className={CONTROL_BUTTON_CLASS}
          >
            <ToggleIcon size={14} />
          </button>
          <button
            type="button"
            onClick={() => actions.scrollToEditor()}
            title={isGuestboard ? '新留言' : '新便签'}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-[color:var(--memo-primary-text)] transition hover:opacity-90 [background:var(--memo-primary-surface)]"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* 桌面侧边栏 */}
        {showSidebar && (
          <aside className="hidden shrink-0 sm:block sm:w-[240px] lg:w-[280px]">
            <div className="sticky top-6 space-y-6">
              <div className={SIDEBAR_PANEL_CLASS}>{renderSidebarPanel(false)}</div>
              <div className={SIDEBAR_PANEL_CLASS}><SidebarQuickFilters filters={filters} agendaItems={agendaItems} /></div>
              <div className={SIDEBAR_PANEL_CLASS}><SidebarTagCloud /></div>
            </div>
          </aside>
        )}

        <div className="min-w-0 flex-1">
          {/* 移动端日历展开 */}
          {showSidebar && (
            <div className="mb-3 sm:hidden">
            <button
              type="button"
              onClick={() => setMobileCalendarOpen((v) => !v)}
              className="flex h-[36px] w-full items-center gap-2 rounded-full border px-3 text-[13px] transition [border-color:var(--memo-control-border)] [background:var(--memo-control-surface)] text-[color:var(--memo-control-text)] hover:[background:var(--memo-control-hover-surface)] hover:text-[color:var(--memo-control-hover-text)]"
            >
              <CalendarDays size={14} className="shrink-0" />
              <span className="flex-1 text-left">
                {filters.effectiveSelectedDate
                  ? filters.effectiveSelectedDate
                  : state.activeDueDate
                    ? `截止 ${state.activeDueDate}`
                    : resolvedCalendarMode === 'agenda'
                      ? '日程视图'
                      : resolvedCalendarMode === 'history'
                        ? '重复任务历史'
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
              <div className="mt-2 rounded-2xl border p-3 [border-color:var(--memo-panel-border)] [background:var(--memo-panel-surface)] [box-shadow:var(--memo-panel-shadow)]">
                <div className="mb-3 inline-flex rounded-full border p-1 [border-color:var(--memo-control-border)] [background:var(--memo-control-surface)]">
                  {sidebarModes.map((mode) => (
                    <button
                      key={mode.key}
                      type="button"
                      onClick={() => setCalendarMode(mode.key as 'heatmap' | 'agenda' | 'history')}
                      className={[
                        'rounded-full px-3 py-1 text-[12px] font-medium transition',
                        resolvedCalendarMode === mode.key
                          ? '[background:var(--memo-primary-surface)] text-[color:var(--memo-primary-text)]'
                          : 'text-[color:var(--memo-control-text)] hover:[background:var(--memo-control-hover-surface)] hover:text-[color:var(--memo-control-hover-text)]',
                      ].join(' ')}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
                {renderSidebarPanel(true)}
              </div>
            ) : null}
          </div>
          )}

          {/* 移动端标签 */}
          {state.allTags.length > 0 ? (
            <div className="mb-4 sm:hidden">
              <div className="relative">
                <div
                  className={[
                    'flex flex-wrap gap-1.5 transition-all duration-300',
                    mobileTagsExpanded ? '' : 'max-h-[68px] overflow-hidden',
                  ].join(' ')}
                >
                  {state.allTags.map(({ name }) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => actions.handleTagFilter(name)}
                      className={[
                        'rounded-full px-2.5 py-1 text-[12px] transition',
                        state.activeTags.includes(name)
                          ? '[background:var(--memo-primary-surface)] text-[color:var(--memo-primary-text)]'
                          : 'border [border-color:var(--memo-control-border)] text-[color:var(--memo-control-text)] hover:[background:var(--memo-control-hover-surface)] hover:text-[color:var(--memo-control-hover-text)]',
                      ].join(' ')}
                    >
                      #{name}
                    </button>
                  ))}
                </div>
                {!mobileTagsExpanded && state.allTags.length > 6 ? (
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[var(--memo-shell-surface)] to-transparent" />
                ) : null}
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                {state.allTags.length > 6 ? (
                  <button
                    type="button"
                    onClick={() => setMobileTagsExpanded((v) => !v)}
                    className="flex items-center gap-0.5 text-[11px] font-medium text-[color:var(--memo-shell-muted)] transition hover:text-[color:var(--memo-control-text)]"
                  >
                    {mobileTagsExpanded ? '收起' : '展开'}
                    <ChevronDown
                      size={12}
                      className={['transition-transform duration-200', mobileTagsExpanded ? 'rotate-180' : ''].join(' ')}
                    />
                  </button>
                ) : null}
                {state.activeTags.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => actions.handleTagFilter('')}
                    className="flex items-center gap-1 text-[11px] text-[color:var(--memo-shell-muted)] transition hover:text-[color:var(--memo-control-text)]"
                  >
                    <X size={10} />
                    清除筛选
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {children}
        </div>
      </div>
    </section>
  )
}
