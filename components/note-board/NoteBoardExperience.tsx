'use client'

import dynamic from 'next/dynamic'
import useSWR from 'swr'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlarmClock, ChevronLeft, ChevronRight } from 'lucide-react'
import { MemoHabitDetailPanel } from '@/components/note-board/views/MemoHabitDetailPanel'
import { NoteEditor } from '@/components/note-board/components/NoteEditor'
import { PriorityPicker } from '@/components/note-board/components/PriorityPicker'
import { VisibilityPicker } from '@/components/note-board/components/VisibilityPicker'
import { StickyNoteCard } from '@/components/note-board/components/StickyNoteCard'
import {
  NoteBoardProvider,
  useNoteBoardActions,
  useNoteBoardBindings,
  useNoteBoardBoardState,
  useNoteBoardEditorState,
  useNoteBoardMeta,
  useNoteBoardToast,
} from '@/components/note-board/NoteBoardProvider'
import { MemoBoardShell, useMemoBoardFilters, type MemoBoardFilters } from '@/components/note-board/views/MemoBoardShell'
import { getStickyColorIndex, getStickyColorSeed } from '@/components/note-board/utils/board'
import { NoteColorThemeProvider } from '@/components/note-board/contexts/NoteColorThemeContext'
import { NOTE_MAX_LENGTH } from '@/lib/input-limits'
import type { NoteBoardViewConfig } from '@/lib/note-board-config'
import {
  getNoteBoardViewModeCookieName,
  getNoteBoardViewModeStorageKey,
  type NoteBoardViewMode,
} from '@/lib/note-board-view-mode'
import type { MemoHabitItemDetail, MemoHabitOverview } from '@/lib/memo-habits'
import type { MemoAgendaItem, NoteMessage } from '@/lib/note-boards'
import { getShanghaDateParts, toDateKey } from '@/components/note-board/views/MemoSidebar'
export { StickyStackPreview } from '@/components/note-board/views/StickyStackPreview'

const MemosStreamView = dynamic(
  () => import('@/components/note-board/views/MemosStreamView').then((m) => m.MemosStreamView),
)

const MobileStickyStack = dynamic(
  () => import('@/components/note-board/views/MobileStickyStack').then((module) => module.MobileStickyStack),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[280px] animate-pulse rounded-[24px] border border-dashed border-border/50 bg-background/15" />
    ),
  },
)

interface NoteBoardPageProps {
  board: NoteBoardViewConfig
  initialMessages: NoteMessage[]
  initialQuery?: string
  initialViewMode?: NoteBoardViewMode
}

function BoardStickyView({ onToggleViewMode, filters, agendaItems, habitOverview, onOpenHabitDetail }: { onToggleViewMode: () => void; filters: MemoBoardFilters; agendaItems?: import('@/lib/note-boards').MemoAgendaItem[] | null; habitOverview?: MemoHabitOverview | null; onOpenHabitDetail?: (noteId: string, itemKey: string) => void }) {
  const state = useNoteBoardBoardState()
  const editorState = useNoteBoardEditorState()
  const actions = useNoteBoardActions()
  const meta = useNoteBoardMeta()
  const bindings = useNoteBoardBindings()
  const bindContainer = useCallback((node: HTMLDivElement | null) => {
    bindings.bindContainer(node)
  }, [bindings])
  // When a date filter is active, pull from allNoteItems so items on page 2+
  // are reachable. When no filter, keep the paginated noteItems.
  const isFilterActive = !!(filters.effectiveSelectedDate || state.activeDueDate)
  const filteredNoteItems = useMemo(() => {
    const sourceItems = isFilterActive ? state.allNoteItems : state.noteItems
    const byDate = filters.filterItemsByDate(sourceItems)
    if (!state.activeDueDate || !agendaItems?.length) return byDate
    const matchingIds = new Set(
      agendaItems
        .filter((a: MemoAgendaItem) => {
          const { year, month, day } = getShanghaDateParts(a.dueAt)
          return toDateKey(year, month, day) === state.activeDueDate
        })
        .map((a: MemoAgendaItem) => a.memoId),
    )
    return byDate.filter((item) => matchingIds.has(item.message.id))
  }, [filters, isFilterActive, state.noteItems, state.allNoteItems, state.activeDueDate, agendaItems])
  const summary = state.viewportReady && !state.isMobileViewport && !filters.isFilterMode && !state.activeDueDate
    ? `第 ${state.currentPage} 页 · ${state.visibleCount} 张`
    : `共 ${state.totalLoaded} 张`
  const emptyLabel = state.showArchived
    ? '还没有已归档便签。'
    : filters.isFilterMode
      ? '没有匹配的内容。'
      : meta.board.emptyLabel

  return (
    <MemoBoardShell
      title={meta.board.title}
      summary={summary}
      itemUnit="张"
      filteredCount={filteredNoteItems.length}
      toggleTarget="stream"
      onToggleViewMode={onToggleViewMode}
      filters={filters}
      searchPlaceholder={meta.board.slug === 'guestbook' ? '搜索留言内容…' : '搜索 Memo…'}
      allowPrioritySort={meta.board.slug === 'memo'}
      agendaItems={agendaItems}
      habitOverview={habitOverview}
      onOpenHabitDetail={onOpenHabitDetail}
    >
      {!state.viewportReady ? (
        <div
          className="rounded-[28px] p-5 sm:p-6"
          style={{ minHeight: 380 }}
        >
          <div className="h-full min-h-[280px] rounded-[24px] border border-dashed border-border/50 bg-background/15" />
        </div>
      ) : filteredNoteItems.length === 0 ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-[24px] border border-dashed border-border/50 bg-background/15 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : state.isMobileViewport ? (
        <div className="mb-12">
          <MobileStickyStack
            items={filteredNoteItems}
            habitStatesByNote={habitOverview?.currentStates}
            onOpenHabitDetail={onOpenHabitDetail}
          />
        </div>
      ) : (
        <div>
          <div
            ref={bindContainer}
            className={['note-board-canvas relative rounded-[28px] p-5 sm:p-6', editorState.editingMessage ? 'overflow-visible' : 'overflow-hidden'].join(' ')}
            style={{ minHeight: Math.max(meta.surface.height, 420) }}
          >
            {!meta.surface.hasMeasured ? null : (
              <div className="relative" style={{ minHeight: Math.max(meta.surface.height, 320) }}>
                {filteredNoteItems.map((item, index) => {
                  const { message, actions: cardActions, priorityControl, reactionControl, checklistControl, inlineEditor, isEditing, isOptimistic, isOptimisticEditing, isFresh } = item

                  const layout = meta.surface.layouts[index]
                  const targetPosition = meta.surface.getTargetPosition(index)
                  const collapsedPosition = {
                    x: Math.max((meta.surface.size.width - meta.surface.cardWidth) / 2, 0) + Math.min(index, 4) * 2,
                    y: 22 + Math.min(index, 4) * 4,
                    rotation: index % 2 === 0 ? -2 : 2,
                  }
                  // When a filter is active, ignore saved custom positions so
                  // items re-layout from slot 0 instead of staying scattered.
                  const custom = isFilterActive ? undefined : state.customPositions[message.id]
                  const position = custom ?? (meta.surface.isScattered ? targetPosition : collapsedPosition)

                  return (
                    <StickyNoteCard.Board
                      key={message.id}
                      message={message}
                      x={position.x}
                      y={position.y}
                      rotation={position.rotation}
                      zIndex={state.cardZIndices[message.id] ?? layout?.zIndex ?? state.messages.length - index}
                      width={meta.surface.cardWidth}
                      bounds={{ width: meta.surface.size.width, height: Math.max(meta.surface.height, 420) }}
                      colorIndex={layout?.colorIndex ?? getStickyColorIndex(getStickyColorSeed(message))}
                      draggable={meta.surface.isScattered && !isEditing}
                      actions={cardActions}
                      priorityControl={priorityControl}
                      reactionControl={reactionControl}
                      checklistControl={checklistControl}
                      habitStates={habitOverview?.currentStates[message.id]}
                      onOpenHabitDetail={onOpenHabitDetail}
                      inlineEditor={inlineEditor}
                      isOptimistic={isOptimistic}
                      isOptimisticEditing={isOptimisticEditing}
                      isFresh={isFresh}
                      onLift={() => actions.bringCardToFront(message.id)}
                      onCommit={(nextPosition) => actions.setCardPosition(message.id, nextPosition)}
                      onHeightChange={(nextHeight) => actions.handleCardHeightChange(message.id, nextHeight)}
                    />
                  )
                })}
              </div>
            )}
          </div>

          {state.hasPreviousPage || state.hasNextPage ? (
            <div className="mt-6 flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/95 px-2 py-2 text-sm shadow-sm">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-muted-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={actions.handlePreviousPage}
                  disabled={!state.hasPreviousPage || state.isPending || state.isRefreshingBoard}
                >
                  <ChevronLeft size={16} />
                  上一页
                </button>
                <span className="min-w-[92px] text-center text-xs text-muted-foreground">
                  第 {state.currentPage} 页
                </span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-muted-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => void actions.handleNextPage()}
                  disabled={!state.hasNextPage || state.isPending || state.isRefreshingBoard}
                >
                  下一页
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {state.viewportReady && state.isMobileViewport && state.hasMore ? (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            className="rounded-full border border-border/70 bg-card px-5 py-2 text-sm text-foreground transition hover:border-foreground/20 hover:bg-accent"
            onClick={() => void actions.handleLoadMore()}
            disabled={state.isPending}
          >
            {state.isPending ? '正在展开更多便签…' : '加载更多便签'}
          </button>
        </div>
      ) : null}
    </MemoBoardShell>
  )
}

const DUE_WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function buildDueDateCells(year: number, month: number) {
  const firstDow = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: Array<{ kind: 'empty' } | { kind: 'day'; day: number }> = []
  for (let i = 0; i < firstDow; i++) cells.push({ kind: 'empty' })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ kind: 'day', day: d })
  return cells
}

type RepeatMode = 'once' | 'daily' | 'weekdays' | 'custom'

const REPEAT_MODE_OPTIONS: { value: RepeatMode; label: string }[] = [
  { value: 'once', label: '一次' },
  { value: 'daily', label: '每天' },
  { value: 'weekdays', label: '周一至周五' },
  { value: 'custom', label: '自定义' },
]

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']


function DueDateInserter({ insertAtCursor }: { insertAtCursor: (text: string) => void }) {
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

  useEffect(() => {
    if (!open) return
    setTimeout(() => labelInputRef.current?.focus(), 30)
    function onPointerDown(e: PointerEvent) {
      if (
        panelRef.current?.contains(e.target as Node) ||
        wrapperRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

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
    const iso = new Date(`${dateStr}T${pad(hour)}:${pad(minute)}`).toISOString()
    const repeatSpec = repeatMode === 'daily' ? ',daily'
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
          style={{ position: 'fixed', bottom: panelPos.bottom, left: panelPos.left, zIndex: 1000 }}
          className="w-[18.5rem] rounded-[1.25rem] border border-border/70 bg-card/95 p-4 shadow-[0_22px_56px_rgba(15,23,42,0.18)] backdrop-blur-xl"
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
                      ? 'bg-slate-900 font-bold text-white shadow-[0_4px_10px_rgba(15,23,42,0.22)]'
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
                        ? 'border-slate-900 bg-slate-900 text-white'
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
                          active ? 'bg-slate-900 text-white' : 'border border-border/60 text-muted-foreground hover:bg-muted/40',
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
              className="rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-[11px] text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              插入提醒
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function NoteBoardEditorSection({ autoFocusOnEdit = false }: { autoFocusOnEdit?: boolean }) {
  const state = useNoteBoardEditorState()
  const boardState = useNoteBoardBoardState()
  const actions = useNoteBoardActions()
  const bindings = useNoteBoardBindings()
  const bindEditorSection = useCallback((node: HTMLElement | null) => {
    bindings.bindEditorSection(node)
  }, [bindings])

  return (
    <section ref={bindEditorSection} className="rounded-[28px] border border-border/60 bg-card/95 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{state.editorSectionLabel}</p>
        </div>
        <p className="text-xs text-muted-foreground">当前身份：{state.loadingIdentity ? '加载中…' : state.viewerIdentity}</p>
      </div>

      {state.editorMode === 'edit' ? (
        <div className="mt-4 rounded-[24px] border border-dashed border-border/70 bg-background/55 px-4 py-3 text-sm text-muted-foreground">
          正在编辑 {state.editingMessage?.author} 的便签。保存后卡片时间会自动刷新。
        </div>
      ) : null}

      {state.canWrite ? (
        <form className="mt-4 space-y-3" onSubmit={actions.handleSubmit}>
          <NoteEditor
            value={state.editorValue}
            onChange={actions.updateEditorValue}
            placeholder={state.editorPlaceholder}
            saveLabel={state.editorSaveLabel}
            isSaving={state.editorSaving}
            onSave={() => void actions.submitEditor()}
            onCancel={state.editorMode === 'edit' ? actions.cancelEditingNote : undefined}
            saveDisabled={!state.editorValue.trim()}
            maxLength={NOTE_MAX_LENGTH}
            minHeightClassName="min-h-[140px]"
            shellClassName="overflow-hidden rounded-[24px] border border-border/70 bg-background/55"
            toolbarClassName="px-4 py-3 text-xs text-muted-foreground"
            toolbarLeadingAddon={(insertAtCursor) => (
              <>
                {state.priorityEnabled ? (
                  <PriorityPicker.Dot
                    value={state.editorPriority}
                    onChange={actions.updateEditorPriority}
                    buttonClassName="h-8 w-8"
                    dotClassName="h-2.5 w-2.5"
                    menuAlign="start"
                    menuDirection="up"
                  />
                ) : null}
                {state.isAdmin ? (
                  <VisibilityPicker
                    value={state.editorVisibility}
                    onChange={actions.updateEditorVisibility}
                  />
                ) : null}
                {state.isAdmin ? <DueDateInserter insertAtCursor={insertAtCursor} /> : null}
              </>
            )}
            autoFocus={state.editorMode === 'edit' && (boardState.isMobileViewport || autoFocusOnEdit)}
          />
        </form>
      ) : (
        <p className="mt-4 text-sm leading-7 text-muted-foreground">这里先开放浏览，Memo 暂时由 admin 维护与更新。</p>
      )}

      {state.error ? <p className="mt-3 text-sm text-rose-600">{state.error}</p> : null}
    </section>
  )
}

function NoteBoardToast() {
  const toastNotice = useNoteBoardToast()

  if (!toastNotice) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-5 z-50 flex justify-center sm:justify-end">
      <div className="rounded-full bg-slate-950 px-4 py-2 text-sm text-white shadow-[0_18px_50px_rgba(15,23,42,0.28)]">
        {toastNotice.message}
      </div>
    </div>
  )
}

function NoteBoardExperience({ initialViewMode = 'sticky' }: { initialViewMode?: NoteBoardViewMode }) {
  const meta = useNoteBoardMeta()
  const state = useNoteBoardBoardState()
  const viewModeStorageKey = getNoteBoardViewModeStorageKey(meta.board.slug)
  const viewModeCookieName = getNoteBoardViewModeCookieName(meta.board.slug)

  const { data: dateCountsRaw } = useSWR<{ date: string; count: number }[]>(
    meta.board.slug === 'memo' ? '/api/note-boards/memo/dates' : null,
    (url: string) => fetch(url).then((r) => r.json()),
    { revalidateOnFocus: false, dedupingInterval: 120_000 },
  )
  const externalDateCounts = useMemo(() => {
    if (!dateCountsRaw) return null
    const map = new Map<string, number>()
    for (const { date, count } of dateCountsRaw) map.set(date, count)
    return map
  }, [dateCountsRaw])

  const filters = useMemoBoardFilters(state.allNoteItems, externalDateCounts)

  const { data: agendaItems } = useSWR<import('@/lib/note-boards').MemoAgendaItem[]>(
    meta.board.slug === 'memo' ? '/api/note-boards/memo/agenda' : null,
    (url: string) => fetch(url).then((r) => r.json()),
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  )

  const { data: habitOverview, mutate: mutateHabitOverview } = useSWR<MemoHabitOverview>(
    meta.board.slug === 'memo' ? '/api/note-boards/memo/habits/overview' : null,
    (url: string) => fetch(url).then((r) => r.json()),
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  )

  const [selectedHabit, setSelectedHabit] = useState<{ noteId: string; itemKey: string } | null>(null)
  const selectedHabitKey = selectedHabit
    ? `/api/note-boards/memo/habits/item?note_id=${encodeURIComponent(selectedHabit.noteId)}&item_key=${encodeURIComponent(selectedHabit.itemKey)}`
    : null
  const { data: selectedHabitDetail, mutate: mutateSelectedHabitDetail, isLoading: isHabitDetailLoading } = useSWR<MemoHabitItemDetail>(
    selectedHabitKey,
    (url: string) => fetch(url).then((r) => r.json()),
    { revalidateOnFocus: false },
  )

  const [viewMode, setViewMode] = useState<NoteBoardViewMode>(initialViewMode)

  useEffect(() => {
    window.localStorage.setItem(viewModeStorageKey, viewMode)
    document.cookie = `${viewModeCookieName}=${viewMode}; path=/; max-age=31536000; SameSite=Lax`
  }, [viewMode, viewModeCookieName, viewModeStorageKey])

  const toggleViewMode = useCallback(
    () => setViewMode((v) => (v === 'sticky' ? 'stream' : 'sticky')),
    [],
  )

  const openHabitDetail = useCallback((noteId: string, itemKey: string) => {
    setSelectedHabit({ noteId, itemKey })
  }, [])

  const closeHabitDetail = useCallback(() => {
    setSelectedHabit(null)
  }, [])

  const handleCompleteHabit = useCallback(async () => {
    if (!selectedHabit) return
    const response = await fetch('/api/note-boards/memo/habits/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note_id: selectedHabit.noteId, item_key: selectedHabit.itemKey }),
    })
    if (!response.ok) return
    const detail = await response.json() as MemoHabitItemDetail
    await mutateSelectedHabitDetail(detail, { revalidate: false })
    await mutateHabitOverview()
  }, [mutateHabitOverview, mutateSelectedHabitDetail, selectedHabit])

  const handleDelayHabit = useCallback(async (delayUntil: string) => {
    if (!selectedHabit) return
    const response = await fetch('/api/note-boards/memo/habits/delay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note_id: selectedHabit.noteId, item_key: selectedHabit.itemKey, delay_until: delayUntil }),
    })
    if (!response.ok) return
    const detail = await response.json() as MemoHabitItemDetail
    await mutateSelectedHabitDetail(detail, { revalidate: false })
    await mutateHabitOverview()
  }, [mutateHabitOverview, mutateSelectedHabitDetail, selectedHabit])

  const handleDeleteOccurrence = useCallback(async (occurrenceId: string) => {
    const response = await fetch(`/api/note-boards/memo/habits/occurrence/${encodeURIComponent(occurrenceId)}`, {
      method: 'DELETE',
    })
    if (!response.ok) return
    await mutateSelectedHabitDetail()
    await mutateHabitOverview()
  }, [mutateHabitOverview, mutateSelectedHabitDetail])

  return (
    <div className="space-y-6">
      {viewMode === 'stream'
        ? <MemosStreamView onToggleViewMode={toggleViewMode} filters={filters} agendaItems={agendaItems ?? null} habitOverview={habitOverview ?? null} onOpenHabitDetail={openHabitDetail} />
        : <BoardStickyView onToggleViewMode={toggleViewMode} filters={filters} agendaItems={agendaItems ?? null} habitOverview={habitOverview ?? null} onOpenHabitDetail={openHabitDetail} />}
      <NoteBoardEditorSection autoFocusOnEdit={viewMode === 'stream'} />
      <NoteBoardToast />
      <MemoHabitDetailPanel
        detail={selectedHabitDetail}
        isLoading={Boolean(selectedHabit) && isHabitDetailLoading}
        isMobile={state.isMobileViewport}
        onClose={closeHabitDetail}
        onComplete={handleCompleteHabit}
        onDelay={handleDelayHabit}
        onDeleteOccurrence={handleDeleteOccurrence}
      />
    </div>
  )
}

export function NoteBoardPage({ board, initialMessages, initialQuery = '', initialViewMode = 'sticky' }: NoteBoardPageProps) {
  const { data: externalTagsRaw } = useSWR<{ name: string; count: number }[]>(
    board.slug === 'memo' ? '/api/note-boards/memo/tags' : null,
    (url: string) => fetch(url).then((r) => r.json()),
    { revalidateOnFocus: false, dedupingInterval: 120_000 },
  )

  return (
    <NoteColorThemeProvider>
      <NoteBoardProvider board={board} initialMessages={initialMessages} initialQuery={initialQuery} externalTags={externalTagsRaw ?? null}>
        <NoteBoardExperience initialViewMode={initialViewMode} />
      </NoteBoardProvider>
    </NoteColorThemeProvider>
  )
}
