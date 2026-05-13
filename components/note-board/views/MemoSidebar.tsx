'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Tag, X } from 'lucide-react'
import {
  useNoteBoardActions,
  useNoteBoardBoardState,
} from '@/components/note-board/NoteBoardProvider'
import { formatStableDate } from '@/lib/date-format'

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
}

export function SidebarCalendar({ memoDateCounts, selectedDate, onSelectDate }: SidebarCalendarProps) {
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
        <span className="text-[13px] font-semibold text-foreground/80">{monthLabel}</span>
        <button
          type="button"
          onClick={nextMonth}
          className="rounded-full p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          aria-label="下个月"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* 星期标题 */}
      <div className="grid grid-cols-7 text-center">
        {WEEKDAY_LABELS.map((lbl) => (
          <span key={lbl} className="text-[11px] text-muted-foreground/60">{lbl}</span>
        ))}
      </div>

      {/* 日期格子 */}
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {cells.map((cell, i) => {
          if (cell.kind !== 'current') {
            return <span key={i} className="py-1 text-[12px] text-muted-foreground/25">{cell.day}</span>
          }
          const key = toDateKey(displayMonth.year, displayMonth.month, cell.day)
          const hasMemos = memoDateCounts.has(key)
          const count = memoDateCounts.get(key) ?? 0
          const isSelected = selectedDate === key
          const isToday = key === today.key
          const heatOpacity = hasMemos && maxCount > 0 ? 0.08 + 0.22 * (count / maxCount) : 0
          return (
            <button
              key={i}
              type="button"
              disabled={!hasMemos && !isSelected}
              onClick={() => onSelectDate(isSelected ? null : key)}
              className={[
                'relative mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[12px] transition',
                isSelected
                  ? 'bg-foreground font-semibold text-background'
                  : isToday
                    ? 'font-semibold text-foreground ring-1 ring-border'
                    : hasMemos
                      ? 'text-foreground hover:bg-accent'
                      : 'cursor-default text-muted-foreground/40',
              ].join(' ')}
              style={hasMemos && !isSelected ? { backgroundColor: `rgba(192,100,74,${heatOpacity})` } : undefined}
              title={hasMemos ? `${count} 条 Memo` : undefined}
            >
              {cell.day}
              {hasMemos && !isSelected ? (
                <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#c0644a]/50" />
              ) : null}
            </button>
          )
        })}
      </div>

      {selectedDate ? (
        <button
          type="button"
          onClick={() => onSelectDate(null)}
          className="flex w-full items-center justify-center gap-1 rounded-full border border-border/60 py-1.5 text-[12px] text-muted-foreground transition hover:text-foreground"
        >
          <X size={12} />
          清除日期筛选
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
      <p className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <Tag size={11} />
        标签
      </p>
      <div className="flex flex-wrap gap-1.5">
        {state.allTags.slice(0, 30).map(({ name, count }) => {
          const isActive = state.activeTag === name
          return (
            <button
              key={name}
              type="button"
              onClick={() => actions.handleTagFilter(name)}
              className={[
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] transition',
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
          <span className="text-[12px] text-muted-foreground/60">+{state.allTags.length - 30}</span>
        ) : null}
      </div>
      {state.activeTag ? (
        <button
          type="button"
          onClick={() => actions.handleTagFilter(state.activeTag)}
          className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <X size={12} />
          清除筛选
        </button>
      ) : null}
    </div>
  )
}
