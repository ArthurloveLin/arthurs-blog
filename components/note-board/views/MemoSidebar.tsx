'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, Tag, X } from 'lucide-react'
import type { MemoAgendaItem } from '@/lib/note-boards'
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
          <span key={lbl} className="text-[12px] text-muted-foreground/60">{lbl}</span>
        ))}
      </div>

      {/* 日期格子 */}
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {cells.map((cell, i) => {
          if (cell.kind !== 'current') {
            return <span key={i} className="py-1 text-[13px] text-muted-foreground/25">{cell.day}</span>
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
                    ? 'font-semibold text-foreground ring-1 ring-border'
                    : hasMemos
                      ? 'text-foreground hover:bg-accent'
                      : 'cursor-default text-muted-foreground/40',
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

export interface SidebarAgendaCalendarProps {
  agendaItems: MemoAgendaItem[]
  onSwitchMode: () => void
  onAfterSelect?: () => void
}

export function SidebarAgendaCalendar({ agendaItems, onSwitchMode, onAfterSelect }: SidebarAgendaCalendarProps) {
  const actions = useNoteBoardActions()
  const state = useNoteBoardBoardState()
  const { theme } = useNoteColorTheme()
  const accentColor = theme.shell[1]

  const today = useMemo(() => {
    const { year, month, day } = getShanghaDateParts(new Date())
    return { year, month, day, key: toDateKey(year, month, day) }
  }, [])

  const [displayMonth, setDisplayMonth] = useState(() => ({ year: today.year, month: today.month }))

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
    const map = new Map<string, string[]>()
    for (const item of agendaItems) {
      const key = toDateKey(...Object.values(getShanghaDateParts(item.due_at)) as [number, number, number])
      const existing = map.get(key) ?? []
      for (const tag of item.tags) {
        if (!existing.includes(tag)) existing.push(tag)
      }
      map.set(key, existing)
    }
    return map
  }, [agendaItems])

  const selectedDueDate = state.activeDueDate

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
          <span key={lbl} className="text-[12px] text-muted-foreground/60">{lbl}</span>
        ))}
      </div>

      {/* 网格 */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((cell, i) => {
          if (cell.kind !== 'current') {
            return (
              <div key={i} className="min-h-[48px] rounded p-0.5">
                <span className="block text-[11px] text-muted-foreground/20">{cell.day}</span>
              </div>
            )
          }
          const key = toDateKey(displayMonth.year, displayMonth.month, cell.day)
          const tags = byDate.get(key) ?? []
          const isSelected = selectedDueDate === key
          const isToday = key === today.key
          return (
            <button
              key={i}
              type="button"
              onClick={() => { actions.handleDueDateFilter(isSelected ? null : key); if (!isSelected) onAfterSelect?.() }}
              className={[
                'group min-h-[48px] w-full rounded p-0.5 text-left transition',
                isSelected
                  ? 'bg-foreground/10 ring-1 ring-foreground/30'
                  : 'hover:bg-accent',
              ].join(' ')}
            >
              <span className={[
                'block text-[11px] font-medium leading-tight mb-0.5',
                isSelected ? 'text-foreground' : isToday ? 'text-foreground font-semibold' : 'text-muted-foreground/60',
              ].join(' ')}>
                {cell.day}
              </span>
              <div className="flex flex-wrap gap-0.5">
                {tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="block max-w-full truncate rounded px-0.5 text-[9px] leading-[14px] text-white"
                    style={{ backgroundColor: getTagColor(tag) }}
                  >
                    #{tag}
                  </span>
                ))}
                {tags.length > 3 ? (
                  <span className="text-[9px] leading-[14px] text-muted-foreground/50">+{tags.length - 3}</span>
                ) : null}
              </div>
              {tags.length > 0 && (
                <span className="mt-0.5 block h-0.5 w-2 rounded-full" style={{ backgroundColor: accentColor }} />
              )}
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
