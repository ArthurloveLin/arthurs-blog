// Agenda calendar: due-date dots + per-day timeline drill-in panel.
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type {} from '@/lib/memo-habits'
import type { MemoAgendaItem } from '@/lib/note-boards'
import { NOTE_PRIORITY_META } from '@/lib/note-priority'
import {
  useNoteBoardActions,
  useNoteBoardBoardState,
} from '@/components/note-board/NoteBoardProvider'
import { formatStableDate } from '@/lib/date-format'
import { getShanghaiDateParts, getShanghaiHourMinute, toDateKey } from '@/lib/shanghai-time'
import { SidebarModeButtons, buildCalendarCells, formatShanghaTime, type SidebarModeEntry, type SidebarModeKey } from './SidebarShared'

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
      const { hour, minute } = getShanghaiHourMinute(item.dueAt)
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
    const { year, month, day } = getShanghaiDateParts(new Date())
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
      const { year, month, day } = getShanghaiDateParts(item.dueAt)
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
