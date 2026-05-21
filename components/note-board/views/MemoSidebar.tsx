'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, Tag, X } from 'lucide-react'
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
}

export function SidebarCalendar({ memoDateCounts, selectedDate, onSelectDate, onSwitchMode }: SidebarCalendarProps) {
  const { theme } = useNoteColorTheme()
  const heatColor = theme.shell[1]
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
          {onSwitchMode ? (
            <button
              type="button"
              onClick={onSwitchMode}
              className="rounded-full p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label="切换到日程视图"
              title="日程视图"
            >
              <LayoutGrid size={13} />
            </button>
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
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
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
              style={hasMemos && !isSelected ? { backgroundColor: `rgba(${hexToRgb(heatColor)},${heatOpacity})` } : undefined}
              title={hasMemos ? `${count} 条 Memo` : undefined}
            >
              {cell.day}
              {hasMemos && !isSelected ? (
                <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full" style={{ backgroundColor: heatColor, opacity: 0.65 }} />
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

      <div className="max-h-[min(58vh,380px)] overflow-y-auto overscroll-contain rounded-xl border border-border/30 bg-background/40">
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
                      className="flex-1 truncate rounded-[4px] px-1.5 py-[3px] text-[11px] leading-[14px] text-white"
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
  onSwitchMode: () => void
  onAfterSelect?: () => void
}

export function SidebarAgendaCalendar({ agendaItems, onSwitchMode, onAfterSelect }: SidebarAgendaCalendarProps) {
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
          <button
            type="button"
            onClick={onSwitchMode}
            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="切换到热力日历"
            title="热力日历"
          >
            <CalendarDays size={13} />
          </button>
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
              <div key={i} className="flex h-[72px] flex-col rounded-sm p-1">
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
                'flex h-[72px] w-full flex-col rounded-sm p-1 text-left transition',
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
                {items.slice(0, 3).map((item, li) => (
                  <span
                    key={li}
                    className="block truncate rounded-[3px] px-0.5 text-[9px] leading-[13px] text-white"
                    style={{ backgroundColor: NOTE_PRIORITY_META[item.priority].color }}
                    title={item.label}
                  >
                    {item.label || '截止'}
                  </span>
                ))}
                {items.length > 3 ? (
                  <span className="block text-[9px] leading-[13px] text-muted-foreground/40">
                    +{items.length - 3}
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

export function SidebarTagCloud() {
  const state = useNoteBoardBoardState()
  const actions = useNoteBoardActions()

  if (state.allTags.length === 0) return null

  return (
    <div className="space-y-2.5">
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <Tag size={11} />
        标签
      </p>
      <div className="flex flex-wrap gap-1.5">
        {state.allTags.slice(0, 30).map(({ name, count }) => {
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
        {state.allTags.length > 30 ? (
          <span className="text-[13px] text-muted-foreground/60">+{state.allTags.length - 30}</span>
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
