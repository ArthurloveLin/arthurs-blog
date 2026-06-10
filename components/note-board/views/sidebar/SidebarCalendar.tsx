// Created-date calendar with per-day memo counts (heatmap mode).
'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type {} from '@/lib/memo-habits'
import type {} from '@/lib/note-boards'
import { useNoteColorTheme } from '@/components/note-board/contexts/NoteColorThemeContext'
import { formatStableDate } from '@/lib/date-format'
import { getShanghaiDateParts, toDateKey } from '@/lib/shanghai-time'
import { SidebarModeButtons, WEEKDAY_LABELS, buildCalendarCells, hexToRgb, type SidebarModeEntry, type SidebarModeKey } from './SidebarShared'

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
    const { year, month, day } = getShanghaiDateParts(new Date())
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
        <span className="text-[14px] font-semibold text-[color:var(--memo-shell-summary)]">{monthLabel}</span>
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
          <span key={lbl} className="text-[12px] text-[color:var(--memo-shell-muted)] opacity-50">{lbl}</span>
        ))}
      </div>

      {/* 日期格子 */}
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {cells.map((cell, i) => {
          if (cell.kind !== 'current') {
            return <span key={i} className="py-1 text-[13px] text-[color:var(--memo-shell-muted)] opacity-30">{cell.day}</span>
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
                      ? 'text-[color:var(--memo-shell-heading)] hover:bg-accent'
                      : 'cursor-default text-[color:var(--memo-shell-muted)] opacity-60',
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
