'use client'

// Editor-toolbar popover that builds an inline @due[label](iso[,repeat]) tag and
// splices it into the note content via insertAtCursor. Pure text-splicer: holds
// no provider/editor state; the tag rides along with the note content through the
// normal create/update path. Extracted from NoteBoardExperience.tsx.

import { useMemo, useRef, useState } from 'react'
import { AlarmClock, ChevronLeft, ChevronRight } from 'lucide-react'
import { useDismiss } from '@/hooks/useDismiss'

const DUE_WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function buildDueDateCells(year: number, month: number) {
  const firstDow = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: Array<{ kind: 'empty' } | { kind: 'day'; day: number }> = []
  for (let i = 0; i < firstDow; i++) cells.push({ kind: 'empty' })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ kind: 'day', day: d })
  return cells
}

type RepeatMode = 'once' | 'daily' | 'weekly' | 'monthly' | 'weekdays' | 'custom'

const REPEAT_MODE_OPTIONS: { value: RepeatMode; label: string }[] = [
  { value: 'once', label: '一次' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
  { value: 'weekdays', label: '周一至周五' },
  { value: 'custom', label: '自定义' },
]

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']


export function DueDateInserter({ insertAtCursor }: { insertAtCursor: (text: string) => void }) {
  const [nowTs] = useState(Date.now)
  const today = useMemo(() => {
    const d = new Date(nowTs)
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }
  }, [nowTs])

  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [viewYear, setViewYear] = useState(today.year)
  const [viewMonth, setViewMonth] = useState(today.month)
  const [selectedDay, setSelectedDay] = useState<{ year: number; month: number; day: number } | null>(null)
  const [hour, setHour] = useState(9)
  const [minute, setMinute] = useState(0)
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('once')
  const [customDays, setCustomDays] = useState<number[]>([])

  // 可编辑的年月头部
  const [editingHeader, setEditingHeader] = useState(false)
  const [editYear, setEditYear] = useState('')
  const [editMonth, setEditMonth] = useState('')
  const editYearRef = useRef<HTMLInputElement>(null)

  // 可编辑的时间
  const [editingHour, setEditingHour] = useState(false)
  const [editingMinute, setEditingMinute] = useState(false)
  const [hourInput, setHourInput] = useState('')
  const [minuteInput, setMinuteInput] = useState('')

  const wrapperRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const labelInputRef = useRef<HTMLInputElement>(null)
  const [panelPos, setPanelPos] = useState<{ bottom: number; left: number }>({ bottom: 0, left: 0 })

  const cells = useMemo(() => buildDueDateCells(viewYear, viewMonth), [viewYear, viewMonth])

  function handleToggle() {
    if (!open && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect()
      setPanelPos({
        bottom: window.innerHeight - rect.top + 8,
        left: Math.min(rect.left, window.innerWidth - 296 - 8),
      })
    }
    setOpen((v) => !v)
  }

  useDismiss({
    enabled: open,
    onDismiss: () => setOpen(false),
    refs: [panelRef, wrapperRef],
  })

  function prevMonth() {
    if (viewMonth === 1) { setViewYear((y) => y - 1); setViewMonth(12) }
    else setViewMonth((m) => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 12) { setViewYear((y) => y + 1); setViewMonth(1) }
    else setViewMonth((m) => m + 1)
  }

  function startEditHeader() {
    setEditYear(String(viewYear))
    setEditMonth(String(viewMonth))
    setEditingHeader(true)
    setTimeout(() => editYearRef.current?.select(), 20)
  }

  function commitHeader() {
    const y = parseInt(editYear)
    const m = parseInt(editMonth)
    if (y >= 2000 && y <= 2099) setViewYear(y)
    if (m >= 1 && m <= 12) setViewMonth(m)
    setEditingHeader(false)
  }

  function commitHour() {
    const v = parseInt(hourInput)
    if (!isNaN(v)) setHour(Math.max(0, Math.min(23, v)))
    setEditingHour(false)
  }

  function commitMinute() {
    const v = parseInt(minuteInput)
    if (!isNaN(v)) setMinute(Math.max(0, Math.min(59, v)))
    setEditingMinute(false)
  }

  function handleInsert() {
    if (!selectedDay) return
    if (repeatMode === 'custom' && customDays.length === 0) return
    const pad = (n: number) => String(n).padStart(2, '0')
    const dateStr = `${selectedDay.year}-${pad(selectedDay.month)}-${pad(selectedDay.day)}`
    // Anchor to Asia/Shanghai explicitly: everything downstream (reminders, habit
    // occurrences, all display) is Shanghai-based, so a browser in another timezone
    // must not shift the picked wall-clock time.
    const iso = new Date(`${dateStr}T${pad(hour)}:${pad(minute)}:00+08:00`).toISOString()
    const repeatSpec = repeatMode === 'daily' ? ',daily'
      : repeatMode === 'weekly' ? ',weekly'
      : repeatMode === 'monthly' ? ',monthly'
      : repeatMode === 'weekdays' ? ',weekdays'
      : repeatMode === 'custom' ? `,custom:${customDays.sort((a, b) => a - b).join(',')}`
      : ''
    const tag = `@due[${label.trim() || '提醒'}](${iso}${repeatSpec})`
    insertAtCursor(tag)

    setOpen(false)
    setLabel('')
    setSelectedDay(null)
    setRepeatMode('once')
    setCustomDays([])
  }

  const timeInput = 'w-9 border-b border-border/60 bg-transparent text-center font-mono text-[1.1rem] font-semibold tabular-nums text-foreground outline-none focus:border-primary/50'

  return (
    <div ref={wrapperRef}>
      <button
        type="button"
        title="插入提醒"
        onClick={handleToggle}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/70 text-slate-700 transition-all hover:bg-white"
      >
        <AlarmClock size={13} strokeWidth={1.8} />
      </button>

      {open ? (
        <div
          ref={panelRef}
          style={{ position: 'fixed', bottom: panelPos.bottom, left: panelPos.left, zIndex: 'var(--z-popover)' }}
          className="w-[18.5rem] rounded-[1.25rem] border border-border/70 bg-card p-4 shadow-[0_22px_56px_rgba(15,23,42,0.18)]"
        >
          {/* 月份导航 — 标题可点击直接编辑年月 */}
          <div className="mb-3 flex items-center justify-between px-0.5">
            <button type="button" onClick={prevMonth} aria-label="上个月"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/40 bg-muted/30 text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground">
              <ChevronLeft size={14} />
            </button>

            {editingHeader ? (
              <div
                className="flex items-center gap-1"
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) commitHeader()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitHeader()
                  if (e.key === 'Escape') setEditingHeader(false)
                }}
              >
                <input
                  ref={editYearRef}
                  type="number"
                  value={editYear}
                  onChange={(e) => setEditYear(e.target.value)}
                  className="w-[3.4rem] rounded-lg border border-border/60 bg-background px-1.5 py-0.5 text-center text-[0.82rem] font-bold text-foreground outline-none focus:ring-1 focus:ring-primary/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-[0.82rem] font-bold text-foreground">年</span>
                <input
                  type="number"
                  min="1" max="12"
                  value={editMonth}
                  onChange={(e) => setEditMonth(e.target.value)}
                  className="w-[2.2rem] rounded-lg border border-border/60 bg-background px-1.5 py-0.5 text-center text-[0.82rem] font-bold text-foreground outline-none focus:ring-1 focus:ring-primary/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-[0.82rem] font-bold text-foreground">月</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={startEditHeader}
                title="点击编辑年月"
                className="text-[0.88rem] font-bold text-foreground transition-colors hover:text-primary"
              >
                {viewYear}年 {viewMonth}月
              </button>
            )}

            <button type="button" onClick={nextMonth} aria-label="下个月"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/40 bg-muted/30 text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground">
              <ChevronRight size={14} />
            </button>
          </div>

          {/* 星期标题 */}
          <div className="mb-1 grid grid-cols-7 text-center">
            {DUE_WEEKDAY_LABELS.map((lbl) => (
              <span key={lbl} className="pb-1 text-[0.62rem] font-bold uppercase tracking-[0.05em] text-muted-foreground/60">{lbl}</span>
            ))}
          </div>

          {/* 日期格子 */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((cell, i) => {
              if (cell.kind === 'empty') return <span key={i} />
              const isToday = cell.day === today.day && viewMonth === today.month && viewYear === today.year
              const isSelected = selectedDay?.day === cell.day && selectedDay.month === viewMonth && selectedDay.year === viewYear
              const isPast = new Date(viewYear, viewMonth - 1, cell.day) < new Date(today.year, today.month - 1, today.day)
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedDay({ year: viewYear, month: viewMonth, day: cell.day })}
                  className={[
                    'relative flex aspect-square w-full items-center justify-center rounded-[0.55rem] text-[0.78rem] font-medium transition-all',
                    isSelected
                      ? 'bg-primary font-bold text-primary-foreground shadow-[0_4px_10px_rgba(15,23,42,0.22)]'
                      : isToday
                        ? 'font-bold text-foreground ring-1 ring-border hover:bg-accent'
                        : isPast
                          ? 'text-muted-foreground/45 hover:bg-muted/30'
                          : 'text-foreground hover:bg-accent',
                  ].join(' ')}
                >
                  {cell.day}
                  {isToday && !isSelected ? (
                    <span className="absolute bottom-[3px] left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-current" />
                  ) : null}
                </button>
              )
            })}
          </div>

          {/* 时间 + 重复 + 标签 — 统一配置区 */}
          <div className="mt-3 rounded-2xl bg-muted/30 p-3 space-y-3">

            {/* 时间 */}
            <div className="flex items-center justify-center gap-1.5">
              {editingHour ? (
                <input
                  autoFocus
                  type="number"
                  min="0" max="23"
                  value={hourInput}
                  onChange={(e) => setHourInput(e.target.value)}
                  onBlur={commitHour}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitHour(); if (e.key === 'Escape') setEditingHour(false) }}
                  onFocus={(e) => e.target.select()}
                  className={timeInput}
                />
              ) : (
                <button type="button" title="点击输入小时"
                  onClick={() => { setHourInput(String(hour).padStart(2, '0')); setEditingHour(true) }}
                  className="w-9 text-center font-mono text-[1.1rem] font-semibold tabular-nums text-foreground transition-colors hover:text-primary">
                  {String(hour).padStart(2, '0')}
                </button>
              )}
              <span className="pb-px font-mono text-[1.1rem] font-semibold text-muted-foreground/60">:</span>
              {editingMinute ? (
                <input
                  autoFocus
                  type="number"
                  min="0" max="59"
                  value={minuteInput}
                  onChange={(e) => setMinuteInput(e.target.value)}
                  onBlur={commitMinute}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitMinute(); if (e.key === 'Escape') setEditingMinute(false) }}
                  onFocus={(e) => e.target.select()}
                  className={timeInput}
                />
              ) : (
                <button type="button" title="点击输入分钟"
                  onClick={() => { setMinuteInput(String(minute).padStart(2, '0')); setEditingMinute(true) }}
                  className="w-9 text-center font-mono text-[1.1rem] font-semibold tabular-nums text-foreground transition-colors hover:text-primary">
                  {String(minute).padStart(2, '0')}
                </button>
              )}
            </div>

            {/* 重复模式 */}
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {REPEAT_MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setRepeatMode(opt.value); if (opt.value !== 'custom') setCustomDays([]) }}
                    className={[
                      'rounded-full border px-2.5 py-0.5 text-[11px] transition-all',
                      repeatMode === opt.value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border/60 text-muted-foreground hover:bg-muted/40',
                    ].join(' ')}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {repeatMode === 'custom' ? (
                <div className="flex gap-1">
                  {WEEKDAY_LABELS.map((lbl, dow) => {
                    const active = customDays.includes(dow)
                    return (
                      <button
                        key={dow}
                        type="button"
                        onClick={() => setCustomDays((prev) =>
                          active ? prev.filter((d) => d !== dow) : [...prev, dow].sort((a, b) => a - b)
                        )}
                        className={[
                          'flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-medium transition-all',
                          active ? 'bg-primary text-primary-foreground' : 'border border-border/60 text-muted-foreground hover:bg-muted/40',
                        ].join(' ')}
                      >
                        {lbl}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>

            {/* 提醒标题 */}
            <input
              ref={labelInputRef}
              autoFocus
              type="text"
              placeholder="提醒标题（显示在通知中）"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && selectedDay) { e.preventDefault(); handleInsert() } }}
              className="w-full rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-primary/30"
            />
          </div>

          {/* 操作按钮 */}
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)}
              className="rounded-full border border-border/60 px-3 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/40">
              取消
            </button>
            <button
              type="button"
              disabled={!selectedDay || (repeatMode === 'custom' && customDays.length === 0)}
              onClick={handleInsert}
              className="rounded-full border border-primary bg-primary px-3 py-1 text-[11px] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              插入提醒
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
