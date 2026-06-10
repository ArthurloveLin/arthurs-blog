// Habit history calendar: completed/missed/delayed day heatmap + drill-in.
'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { getHabitStatusClassName, getHabitStatusLabel } from '@/components/note-board/utils/habit-ui'
import type { MemoHabitHistoryEvent, MemoHabitOverview } from '@/lib/memo-habits'
import type {} from '@/lib/note-boards'
import { useNoteColorTheme } from '@/components/note-board/contexts/NoteColorThemeContext'
import { formatStableDate } from '@/lib/date-format'
import { getShanghaiDateParts, toDateKey } from '@/lib/shanghai-time'
import { SidebarModeButtons, WEEKDAY_LABELS, buildCalendarCells, hexToRgb, type SidebarModeEntry, type SidebarModeKey } from './SidebarShared'

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
    const { year, month, day } = getShanghaiDateParts(new Date())
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
      const { year, month, day } = getShanghaiDateParts(event.occurredAt)
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
            <p className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--memo-shell-muted)] opacity-70">{item.label}</p>
            <p className="mt-1 text-[18px] font-semibold leading-none text-[color:var(--memo-shell-heading)]">{item.value}</p>
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
