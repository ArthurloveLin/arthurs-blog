'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, History, Tag, X } from 'lucide-react'
import { getHabitStatusClassName, getHabitStatusLabel } from '@/components/note-board/utils/habit-ui'
import type { MemoHabitHistoryEvent, MemoHabitOverview } from '@/lib/memo-habits'
import type { MemoAgendaItem } from '@/lib/note-boards'
import { NOTE_PRIORITY_META } from '@/lib/note-priority'
import {
  useNoteBoardActions,
  useNoteBoardBoardState,
} from '@/components/note-board/NoteBoardProvider'
import { useNoteColorTheme } from '@/components/note-board/contexts/NoteColorThemeContext'
import { formatStableDate } from '@/lib/date-format'

function hexToRgb(hex: string): string {
  return `${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)}`
}

type SidebarModeKey = 'agenda' | 'heatmap' | 'history'
export const SIDEBAR_MODE_ICONS: Record<SidebarModeKey, React.ReactNode> = {
  agenda: <CalendarDays size={13} />,
  heatmap: <Activity size={13} />,
  history: <History size={13} />,
}

export interface SidebarModeEntry {
  key: SidebarModeKey
  label: string
}

interface SidebarModeControlProps {
  sidebarModes: readonly SidebarModeEntry[]
  calendarMode: SidebarModeKey
  onCalendarModeChange: (mode: SidebarModeKey) => void
}

function SidebarModeButtons({ sidebarModes, calendarMode, onCalendarModeChange }: SidebarModeControlProps) {
  return (
    <div className="flex items-center gap-0.5">
      {sidebarModes.map((mode) => (
        <button
          key={mode.key}
          type="button"
          onClick={() => onCalendarModeChange(mode.key)}
          title={mode.label}
          aria-label={mode.label}
          className={[
            'rounded-full p-1.5 transition',
            calendarMode === mode.key
              ? 'bg-foreground/10 text-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          ].join(' ')}
        >
          {SIDEBAR_MODE_ICONS[mode.key]}
        </button>
      ))}
    </div>
  )
}

export const CHIP_COLORS = [
  '#c0644a', '#7a5ae0', '#1f8a5b',
  '#2a6fdb', '#b2841f', '#a14d8b', '#4a8c7a',
]

export function getTagColor(tagName: string): string {
  let hash = 0
  for (let i = 0; i < tagName.length; i++) {
    hash = (hash + tagName.charCodeAt(i)) % CHIP_COLORS.length
  }
  return CHIP_COLORS[hash] ?? CHIP_COLORS[0]!
}

export function getShanghaDateParts(ts: string | Date): { year: number; month: number; day: number } {
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

export function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function getShanghaHourMinute(iso: string): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date(iso))
  return {
    hour: Number(parts.find((p) => p.type === 'hour')?.value ?? 0),
    minute: Number(parts.find((p) => p.type === 'minute')?.value ?? 0),
  }
}

function formatShanghaTime(iso: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const h = parts.find((p) => p.type === 'hour')?.value ?? '00'
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00'
  return `${h}:${m}`
}


function buildCalendarCells(year: number, month: number) {
  const firstDow = new Date(year, month - 1, 1).getDay()
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

export interface SidebarCalendarProps {
  memoDateCounts: Map<string, number>
  selectedDate: string | null
  onSelectDate: (key: string | null) => void
  onSwitchMode?: () => void
  sidebarModes?: readonly SidebarModeEntry[]
  calendarMode?: SidebarModeKey
  onCalendarModeChange?: (mode: SidebarModeKey) => void
}

export function SidebarCalendar({ memoDateCounts, selectedDate, onSelectDate, sidebarModes, calendarMode, onCalendarModeChange }: SidebarCalendarProps) {
  const { theme } = useNoteColorTheme()
  const heatmapBg = theme.chrome.heatmapBg
  const today = useMemo(() => {
    const { year, month, day } = getShanghaDateParts(new Date())
    return { year, month, day, key: toDateKey(year, month, day) }
  }, [])

  const maxCount = useMemo(() => {
    let max = 0
    memoDateCounts.forEach((c) => { if (c > max) max = c })
    return max
  }, [memoDateCounts])

  const [displayMonth, setDisplayMonth] = useState(() => {
    const dates = [...memoDateCounts.keys()].sort().reverse()
    if (dates.length > 0) {
      const [y, m] = (dates[0] ?? '').split('-').map(Number)
      if (y && m) return { year: y, month: m }
    }
    return { year: today.year, month: today.month }
  })

  const cells = useMemo(() => buildCalendarCells(displayMonth.year, displayMonth.month), [displayMonth])

  const monthLabel = formatStableDate(
    new Date(displayMonth.year, displayMonth.month - 1, 1),
    { year: 'numeric', month: 'long' },
  )

  function prevMonth() {
    setDisplayMonth(({ year, month }) =>
      month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 },
    )
  }

  function nextMonth() {
    setDisplayMonth(({ year, month }) =>
      month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 },
    )
  }

  return (
    <div className="space-y-2.5">
      {/* 月份导航 */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded-full p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          aria-label="上个月"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="text-[14px] font-semibold text-foreground/80">{monthLabel}</span>
        <div className="flex items-center gap-0.5">
          {sidebarModes && calendarMode && onCalendarModeChange ? (
            <SidebarModeButtons
              sidebarModes={sidebarModes}
              calendarMode={calendarMode}
              onCalendarModeChange={onCalendarModeChange}
            />
          ) : null}
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="下个月"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* 星期标题 */}
      <div className="grid grid-cols-7 text-center">
        {WEEKDAY_LABELS.map((lbl) => (
          <span key={lbl} className="text-[12px] text-muted-foreground/35">{lbl}</span>
        ))}
      </div>

      {/* 日期格子 */}
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {cells.map((cell, i) => {
          if (cell.kind !== 'current') {
            return <span key={i} className="py-1 text-[13px] text-muted-foreground/18">{cell.day}</span>
          }
          const key = toDateKey(displayMonth.year, displayMonth.month, cell.day)
          const hasMemos = memoDateCounts.has(key)
          const count = memoDateCounts.get(key) ?? 0
          const isSelected = selectedDate === key
          const isToday = key === today.key
          const heatOpacity = hasMemos && maxCount > 0 ? 0.15 + 0.45 * (count / maxCount) : 0
          return (
            <button
              key={i}
              type="button"
              disabled={!hasMemos && !isSelected}
              onClick={() => onSelectDate(isSelected ? null : key)}
              className={[
                'relative mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[13px] transition',
                isSelected
                  ? 'bg-foreground font-semibold text-background'
                  : isToday
                    ? 'bg-foreground/10 font-semibold text-foreground ring-1 ring-foreground/25'
                    : hasMemos
                      ? 'text-foreground hover:bg-accent'
                      : 'cursor-default text-muted-foreground/55',
              ].join(' ')}
              style={hasMemos && !isSelected ? { backgroundColor: `rgba(${hexToRgb(heatmapBg)},${heatOpacity})` } : undefined}
              title={hasMemos ? `${count} 条 Memo` : undefined}
            >
              {cell.day}
              {hasMemos && !isSelected ? (
                <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full" style={{ backgroundColor: heatmapBg, opacity: 0.75 }} />
              ) : null}
            </button>
          )
        })}
      </div>

      {selectedDate ? (
        <button
          type="button"
          onClick={() => onSelectDate(null)}
          className="flex w-full items-center justify-center gap-1 rounded-full border border-border/60 py-1.5 text-[13px] text-muted-foreground transition hover:text-foreground"
        >
          <X size={12} />
          清除日期筛选
        </button>
      ) : null}
    </div>
  )
}

const TIMELINE_HOURS = Array.from({ length: 24 }, (_, i) => i)

interface AgendaDayPanelProps {
  dateKey: string
  items: MemoAgendaItem[]
  selectedDueDate: string | null
  onBack: () => void
  onFilterDay: (key: string | null) => void
}

function AgendaDayPanel({ dateKey, items, selectedDueDate, onBack, onFilterDay }: AgendaDayPanelProps) {
  const [yearStr, monthStr, dayStr] = dateKey.split('-')
  const dateLabel = formatStableDate(
    new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr)),
    { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' },
  )

  const byHour = useMemo(() => {
    const map = new Map<number, Array<{ item: MemoAgendaItem; timeLabel: string; minute: number }>>()
    for (const item of items) {
      const { hour, minute } = getShanghaHourMinute(item.dueAt)
      const bucket = map.get(hour) ?? []
      bucket.push({ item, timeLabel: formatShanghaTime(item.dueAt), minute })
      bucket.sort((a, b) => a.minute - b.minute)
      map.set(hour, bucket)
    }
    return map
  }, [items])

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Scroll to the first hour that has items so the user doesn't have to manually scroll down
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || byHour.size === 0) return
    let firstHour = 23
    for (const h of byHour.keys()) {
      if (h < firstHour) firstHour = h
    }
    // Each empty hour row is exactly h-6 = 24px; hours before firstHour have no items, so
    // the accumulated height is firstHour * 24px plus the container's top padding (py-0.5 = 2px).
    const HOUR_ROW_HEIGHT = 24
    const TOP_PADDING = 2
    container.scrollTop = TOP_PADDING + firstHour * HOUR_ROW_HEIGHT
  }, [byHour])

  const isFiltered = selectedDueDate === dateKey

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 rounded-full p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          aria-label="返回日历"
        >
          <ChevronLeft size={14} />
        </button>
        <p className="flex-1 truncate text-[13px] font-semibold text-foreground/80">{dateLabel}</p>
        <span className="shrink-0 text-[11px] text-muted-foreground/45">{items.length}项</span>
      </div>

      <button
        type="button"
        onClick={() => onFilterDay(isFiltered ? null : dateKey)}
        className={[
          'flex w-full items-center justify-center gap-1 rounded-full py-1.5 text-[12px] font-medium transition',
          isFiltered
            ? 'bg-foreground/10 text-foreground ring-1 ring-inset ring-foreground/20'
            : 'border border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground',
        ].join(' ')}
      >
        {isFiltered ? <><X size={11} /><span>取消筛选</span></> : '筛选当日截止'}
      </button>

      <div ref={scrollContainerRef} className="max-h-[min(58vh,380px)] overflow-y-auto overscroll-contain rounded-xl border border-border/30 bg-background/40">
        <div className="px-2 py-0.5">
          {TIMELINE_HOURS.map((h) => {
            const hourItems = byHour.get(h)
            return (
              <div key={h}>
                <div className="flex h-6 items-center gap-2">
                  <span className="w-7 shrink-0 text-right text-[9px] tabular-nums text-muted-foreground/30">
                    {String(h).padStart(2, '0')}
                  </span>
                  <div className="flex-1 border-t border-border/20" />
                </div>
                {hourItems?.map(({ item, timeLabel }, idx) => (
                  <div key={idx} className="mb-1.5 flex items-start gap-1.5 pl-9">
                    <span className="shrink-0 text-[9px] tabular-nums leading-[18px] text-muted-foreground/50">{timeLabel}</span>
                    <span
                      className={['flex-1 truncate rounded-[4px] px-1.5 py-[3px] text-[11px] leading-[14px] text-white', item.isNotified ? 'opacity-45 line-through' : ''].filter(Boolean).join(' ')}
                      style={{ backgroundColor: NOTE_PRIORITY_META[item.priority].color }}
                      title={item.label}
                    >
                      {item.label || '截止'}
                    </span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export interface SidebarAgendaCalendarProps {
  agendaItems: MemoAgendaItem[]
  onSwitchMode?: () => void
  onAfterSelect?: () => void
  sidebarModes?: readonly SidebarModeEntry[]
  calendarMode?: SidebarModeKey
  onCalendarModeChange?: (mode: SidebarModeKey) => void
}

export function SidebarAgendaCalendar({ agendaItems, onAfterSelect, sidebarModes, calendarMode, onCalendarModeChange }: SidebarAgendaCalendarProps) {
  const actions = useNoteBoardActions()
  const state = useNoteBoardBoardState()

  const today = useMemo(() => {
    const { year, month, day } = getShanghaDateParts(new Date())
    return { year, month, day, key: toDateKey(year, month, day) }
  }, [])

  const [displayMonth, setDisplayMonth] = useState(() => ({ year: today.year, month: today.month }))
  const [detailDay, setDetailDay] = useState<string | null>(null)

  const monthLabel = formatStableDate(
    new Date(displayMonth.year, displayMonth.month - 1, 1),
    { year: 'numeric', month: 'long' },
  )

  function prevMonth() {
    setDisplayMonth(({ year, month }) =>
      month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 },
    )
  }

  function nextMonth() {
    setDisplayMonth(({ year, month }) =>
      month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 },
    )
  }

  const cells = useMemo(() => buildCalendarCells(displayMonth.year, displayMonth.month), [displayMonth])

  const byDate = useMemo(() => {
    const map = new Map<string, MemoAgendaItem[]>()
    for (const item of agendaItems) {
      const { year, month, day } = getShanghaDateParts(item.dueAt)
      const key = toDateKey(year, month, day)
      const existing = map.get(key) ?? []
      existing.push(item)
      map.set(key, existing)
    }
    return map
  }, [agendaItems])

  const selectedDueDate = state.activeDueDate

  if (detailDay !== null) {
    return (
      <AgendaDayPanel
        dateKey={detailDay}
        items={byDate.get(detailDay) ?? []}
        selectedDueDate={selectedDueDate}
        onBack={() => setDetailDay(null)}
        onFilterDay={(key) => {
          actions.handleDueDateFilter(key)
          if (!key) {
            setDetailDay(null)
            onAfterSelect?.()
          }
        }}
      />
    )
  }

  return (
    <div className="space-y-2">
      {/* 月份导航 */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded-full p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          aria-label="上个月"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="text-[14px] font-semibold text-foreground/80">{monthLabel}</span>
        <div className="flex items-center gap-0.5">
          {sidebarModes && calendarMode && onCalendarModeChange ? (
            <SidebarModeButtons
              sidebarModes={sidebarModes}
              calendarMode={calendarMode}
              onCalendarModeChange={onCalendarModeChange}
            />
          ) : null}
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="下个月"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* 星期标题 */}
      <div className="grid grid-cols-7 text-center">
        {['一', '二', '三', '四', '五', '六', '日'].map((lbl) => (
          <span key={lbl} className="text-[11px] text-muted-foreground/35">{lbl}</span>
        ))}
      </div>

      {/* 网格 */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map((cell, i) => {
          if (cell.kind !== 'current') {
            return (
              <div key={i} className="flex h-[60px] flex-col rounded-sm p-1">
                <span className="shrink-0 text-[10px] text-muted-foreground/10">{cell.day}</span>
              </div>
            )
          }
          const key = toDateKey(displayMonth.year, displayMonth.month, cell.day)
          const items = byDate.get(key) ?? []
          const isSelected = selectedDueDate === key
          const isToday = key === today.key
          return (
            <button
              key={i}
              type="button"
              onClick={() => { setDetailDay(key); actions.handleDueDateFilter(key) }}
              className={[
                'flex h-[60px] w-full flex-col rounded-sm p-1 text-left transition',
                isSelected
                  ? 'bg-foreground/10 ring-1 ring-inset ring-foreground/25'
                  : 'cursor-pointer hover:bg-accent',
              ].join(' ')}
            >
              <span className={[
                'shrink-0 text-[10px] font-medium leading-tight',
                isSelected
                  ? 'text-foreground'
                  : isToday
                    ? 'font-bold text-foreground underline decoration-dotted underline-offset-2'
                    : 'text-foreground/70',
              ].join(' ')}>
                {cell.day}
              </span>
              <div className="mt-0.5 flex-1 overflow-hidden space-y-px">
                {items.slice(0, 2).map((item, li) => (
                  <span
                    key={li}
                    className={['block truncate rounded-[3px] px-0.5 text-[9px] leading-[13px] text-white', item.isNotified ? 'opacity-40 line-through' : ''].filter(Boolean).join(' ')}
                    style={{ backgroundColor: NOTE_PRIORITY_META[item.priority].color }}
                    title={item.label}
                  >
                    {item.label || '截止'}
                  </span>
                ))}
                {items.length > 2 ? (
                  <span className="block text-[9px] leading-[13px] text-muted-foreground/40">
                    +{items.length - 2}
                  </span>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>

      {selectedDueDate ? (
        <button
          type="button"
          onClick={() => actions.handleDueDateFilter(null)}
          className="flex w-full items-center justify-center gap-1 rounded-full border border-border/60 py-1.5 text-[13px] text-muted-foreground transition hover:text-foreground"
        >
          <X size={12} />
          清除截止日期筛选
        </button>
      ) : null}
    </div>
  )
}

interface HistoryDayPanelProps {
  dateKey: string
  events: MemoHabitHistoryEvent[]
  onBack: () => void
  onOpenItemDetail: (noteId: string, itemKey: string) => void
  onAfterSelect?: () => void
  selectedDate?: string | null
  onFilterDay?: (key: string | null, noteIds?: string[]) => void
}

function HistoryDayPanel({ dateKey, events, onBack, onOpenItemDetail, onAfterSelect, selectedDate, onFilterDay }: HistoryDayPanelProps) {
  const [yearStr, monthStr, dayStr] = dateKey.split('-')
  const dateLabel = formatStableDate(
    new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr)),
    { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' },
  )

  const isFiltered = selectedDate === dateKey

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 rounded-full p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          aria-label="返回历史日历"
        >
          <ChevronLeft size={14} />
        </button>
        <p className="flex-1 truncate text-[13px] font-semibold text-foreground/80">{dateLabel}</p>
        <span className="shrink-0 text-[11px] text-muted-foreground/45">{events.length}条</span>
      </div>

      {onFilterDay ? (
        <button
          type="button"
          onClick={() => onFilterDay(
            isFiltered ? null : dateKey,
            isFiltered ? undefined : [...new Set(events.map((e) => e.noteId))],
          )}
          className={[
            'flex w-full items-center justify-center gap-1 rounded-full py-1.5 text-[12px] font-medium transition',
            isFiltered
              ? 'bg-foreground/10 text-foreground ring-1 ring-inset ring-foreground/20'
              : 'border border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground',
          ].join(' ')}
        >
          {isFiltered ? <><X size={11} /><span>取消筛选便签</span></> : '筛选当日便签'}
        </button>
      ) : null}

      <div className="max-h-[min(58vh,380px)] overflow-y-auto overscroll-contain rounded-xl border border-border/30 bg-background/40 px-2 py-2">
        {events.length === 0 ? (
          <div className="flex min-h-[120px] items-center justify-center text-[12px] text-muted-foreground/55">
            当天还没有记录
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => {
              const state = {
                noteId: event.noteId,
                itemKey: event.itemKey,
                label: event.label,
                lineText: event.lineText,
                dueAt: event.dueAt,
                status: event.status,
                streak: 0,
                delayedTo: event.delayedTo,
                completedAt: event.status === 'completed' ? event.occurredAt : null,
                completionSource: event.completionSource,
              } as const
              return (
                <button
                  key={event.occurrenceId}
                  type="button"
                  onClick={() => {
                    onOpenItemDetail(event.noteId, event.itemKey)
                    onAfterSelect?.()
                  }}
                  className="flex w-full items-start justify-between gap-2 rounded-xl border border-border/40 bg-background/70 px-3 py-2 text-left transition hover:border-border/80 hover:bg-accent/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-foreground/85">{event.label}</p>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground/55">{event.lineText || '查看详情'}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={[
                      'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
                      getHabitStatusClassName(state.status),
                    ].join(' ')}>
                      {getHabitStatusLabel(state)}
                    </span>
                    <span className="text-[10px] text-muted-foreground/45">
                      {new Intl.DateTimeFormat('zh-CN', {
                        timeZone: 'Asia/Shanghai',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      }).format(new Date(event.occurredAt))}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export interface SidebarHabitHistoryProps {
  overview: MemoHabitOverview
  onOpenItemDetail: (noteId: string, itemKey: string) => void
  onAfterSelect?: () => void
  sidebarModes?: readonly SidebarModeEntry[]
  calendarMode?: SidebarModeKey
  onCalendarModeChange?: (mode: SidebarModeKey) => void
  onFilterDay?: (key: string | null, noteIds?: string[]) => void
  selectedDate?: string | null
}

export function SidebarHabitHistory({ overview, onOpenItemDetail, onAfterSelect, sidebarModes, calendarMode, onCalendarModeChange, onFilterDay, selectedDate }: SidebarHabitHistoryProps) {
  const { theme } = useNoteColorTheme()
  const heatmapBg = theme.chrome.heatmapBg
  const heatmapInk = theme.chrome.heatmapInk

  const today = useMemo(() => {
    const { year, month, day } = getShanghaDateParts(new Date())
    return { year, month, day, key: toDateKey(year, month, day) }
  }, [])

  const [displayMonth, setDisplayMonth] = useState(() => {
    const lastDate = overview.daySummaries.at(-1)?.date
    if (lastDate) {
      const [year, month] = lastDate.split('-').map(Number)
      if (year && month) return { year, month }
    }
    return { year: today.year, month: today.month }
  })
  const [detailDay, setDetailDay] = useState<string | null>(null)

  const monthLabel = formatStableDate(
    new Date(displayMonth.year, displayMonth.month - 1, 1),
    { year: 'numeric', month: 'long' },
  )

  function prevMonth() {
    setDisplayMonth(({ year, month }) =>
      month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 },
    )
  }

  function nextMonth() {
    setDisplayMonth(({ year, month }) =>
      month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 },
    )
  }

  const cells = useMemo(() => buildCalendarCells(displayMonth.year, displayMonth.month), [displayMonth])

  const daySummaryMap = useMemo(() => {
    return new Map(overview.daySummaries.map((summary) => [summary.date, summary]))
  }, [overview.daySummaries])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, MemoHabitHistoryEvent[]>()
    for (const event of overview.recentEvents) {
      const { year, month, day } = getShanghaDateParts(event.occurredAt)
      const key = toDateKey(year, month, day)
      const bucket = map.get(key) ?? []
      bucket.push(event)
      map.set(key, bucket)
    }
    return map
  }, [overview.recentEvents])

  const maxCompleted = useMemo(() => {
    let max = 0
    for (const s of overview.daySummaries) if (s.completed > max) max = s.completed
    return max
  }, [overview.daySummaries])

  const maxMissed = useMemo(() => {
    let max = 0
    for (const s of overview.daySummaries) if (s.missed > max) max = s.missed
    return max
  }, [overview.daySummaries])

  const maxDelayed = useMemo(() => {
    let max = 0
    for (const s of overview.daySummaries) if (s.delayed > max) max = s.delayed
    return max
  }, [overview.daySummaries])

  if (detailDay) {
    return (
      <HistoryDayPanel
        dateKey={detailDay}
        events={eventsByDate.get(detailDay) ?? []}
        onBack={() => { setDetailDay(null); onFilterDay?.(null) }}
        onOpenItemDetail={onOpenItemDetail}
        onAfterSelect={onAfterSelect}
        selectedDate={selectedDate}
        onFilterDay={onFilterDay}
      />
    )
  }

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: '今日完成', value: overview.summary.completedToday },
          { label: '当前连续', value: overview.summary.currentStreak },
          { label: '本周完成率', value: `${overview.summary.completionRate7d}%` },
          { label: '本周漏失/延后', value: `${overview.summary.missedThisWeek}/${overview.summary.delayedThisWeek}` },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border/40 bg-background/55 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/55">{item.label}</p>
            <p className="mt-1 text-[18px] font-semibold leading-none text-foreground/85">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded-full p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          aria-label="上个月"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="text-[14px] font-semibold text-foreground/80">{monthLabel}</span>
        <div className="flex items-center gap-0.5">
          {sidebarModes && calendarMode && onCalendarModeChange ? (
            <SidebarModeButtons
              sidebarModes={sidebarModes}
              calendarMode={calendarMode}
              onCalendarModeChange={onCalendarModeChange}
            />
          ) : null}
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="下个月"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center">
        {WEEKDAY_LABELS.map((lbl) => (
          <span key={lbl} className="text-[11px] text-muted-foreground/35">{lbl}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px">
        {cells.map((cell, index) => {
          if (cell.kind !== 'current') {
            return (
              <div key={index} className="flex h-[60px] flex-col rounded-sm p-1">
                <span className="shrink-0 text-[10px] text-muted-foreground/10">{cell.day}</span>
              </div>
            )
          }

          const key = toDateKey(displayMonth.year, displayMonth.month, cell.day)
          const summary = daySummaryMap.get(key)
          const isToday = key === today.key

          const completedOpacity = summary && maxCompleted > 0 && summary.completed > 0
            ? 0.32 + 0.60 * (summary.completed / maxCompleted) : 0
          const missedOpacity = summary && maxMissed > 0 && summary.missed > 0
            ? 0.32 + 0.60 * (summary.missed / maxMissed) : 0
          const delayedOpacity = summary && maxDelayed > 0 && summary.delayed > 0
            ? 0.32 + 0.60 * (summary.delayed / maxDelayed) : 0

          return (
            <button
              key={index}
              type="button"
              disabled={!summary}
              onClick={() => {
                setDetailDay(key)
                const dayEvents = eventsByDate.get(key) ?? []
                onFilterDay?.(key, dayEvents.length > 0 ? [...new Set(dayEvents.map((e) => e.noteId))] : undefined)
              }}
              className={[
                'flex h-[60px] w-full flex-col rounded-sm p-1 text-left transition',
                summary ? 'cursor-pointer hover:bg-accent' : 'cursor-default',
              ].join(' ')}
              title={summary ? `完成 ${summary.completed} · 错过 ${summary.missed} · 延后 ${summary.delayed}` : undefined}
            >
              <span className={[
                'shrink-0 text-[10px] font-medium leading-tight',
                isToday
                  ? 'font-bold text-foreground underline decoration-dotted underline-offset-2'
                  : summary
                    ? 'text-foreground/80'
                    : 'text-muted-foreground/18',
              ].join(' ')}>
                {cell.day}
              </span>
              {summary ? (
                <div className="mt-auto flex w-full flex-col gap-px">
                  {summary.completed > 0 ? (
                    <span
                      className="block truncate rounded-[3px] px-0.5 text-[9px] font-semibold leading-[13px]"
                      style={{
                        backgroundColor: `rgba(${hexToRgb(heatmapBg)},${completedOpacity * 0.62})`,
                        color: heatmapInk,
                      }}
                    >
                      完{summary.completed}
                    </span>
                  ) : null}
                  {summary.delayed > 0 ? (
                    <span
                      className="block truncate rounded-[3px] px-0.5 text-[9px] font-semibold leading-[13px]"
                      style={{
                        backgroundColor: `rgba(37,99,235,${delayedOpacity * 0.52})`,
                        color: 'rgba(23,50,145,0.95)',
                      }}
                    >
                      延{summary.delayed}
                    </span>
                  ) : null}
                  {summary.missed > 0 ? (
                    <span
                      className="block truncate rounded-[3px] px-0.5 text-[9px] font-semibold leading-[13px]"
                      style={{
                        backgroundColor: `rgba(220,38,38,${missedOpacity * 0.52})`,
                        color: 'rgba(153,27,27,0.95)',
                      }}
                    >
                      错{summary.missed}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </button>
          )
        })}
      </div>

    </div>
  )
}

export function SidebarTagCloud() {
  const state = useNoteBoardBoardState()
  const actions = useNoteBoardActions()
  const [isExpanded, setIsExpanded] = useState(false)

  if (state.allTags.length === 0) return null

  const needsExpansion = state.allTags.length > 8

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <Tag size={11} />
          标签
        </p>
        {needsExpansion ? (
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className="flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground/60 transition hover:text-muted-foreground"
          >
            {isExpanded ? '收起' : '展开'}
            <ChevronDown
              size={12}
              className={['transition-transform duration-200', isExpanded ? 'rotate-180' : ''].join(' ')}
            />
          </button>
        ) : null}
      </div>
      <div className="relative">
        <div
          className={[
            'flex flex-wrap gap-1.5 transition-all duration-300',
            !isExpanded && needsExpansion ? 'max-h-[268px] overflow-hidden' : '',
          ].join(' ')}
        >
          {state.allTags.map(({ name, count }) => {
            const isActive = state.activeTags.includes(name)
            return (
              <button
                key={name}
                type="button"
                onClick={() => actions.handleTagFilter(name)}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] transition',
                  isActive
                    ? 'bg-foreground text-background'
                    : 'border border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground',
                ].join(' ')}
              >
                <span>#{name}</span>
                <span className="opacity-60">{count}</span>
              </button>
            )
          })}
        </div>
        {!isExpanded && needsExpansion ? (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[var(--memo-panel-surface,hsl(var(--background)))] to-transparent" />
        ) : null}
      </div>
      {state.activeTags.length > 0 ? (
        <button
          type="button"
          onClick={() => actions.handleTagFilter('')}
          className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <X size={12} />
          清除筛选
        </button>
      ) : null}
    </div>
  )
}
