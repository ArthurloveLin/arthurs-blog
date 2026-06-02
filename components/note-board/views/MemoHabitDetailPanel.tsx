'use client'

import { useEffect, useRef, useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { HABIT_DELAY_PRESETS, getHabitStatusClassName, getHabitStatusLabel, getHabitStreakLabel } from '@/components/note-board/utils/habit-ui'
import { useNoteColorTheme } from '@/components/note-board/contexts/NoteColorThemeContext'
import type { MemoHabitItemDetail } from '@/lib/memo-habits'

interface MemoHabitDetailPanelProps {
  detail: MemoHabitItemDetail | null | undefined
  isLoading: boolean
  isMobile: boolean
  anchorPos?: { x: number; y: number }
  onClose: () => void
  onComplete: () => Promise<void>
  onDelay: (delayUntil: string) => Promise<void>
  onDeleteOccurrence?: (occurrenceId: string) => Promise<void>
}

function formatDetailTimestamp(iso: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

const STATUS_DOT_CLASS: Record<string, string> = {
  completed: 'bg-emerald-400',
  missed: 'bg-red-400',
  delayed: 'bg-sky-400',
}

const STATUS_TEXT_CLASS: Record<string, string> = {
  completed: 'text-emerald-600 dark:text-emerald-400',
  missed: 'text-red-500 dark:text-red-400',
  delayed: 'text-sky-500 dark:text-sky-400',
}

const RECORDS_PER_PAGE = 6

export function MemoHabitDetailPanel({
  detail, isLoading, isMobile, anchorPos,
  onClose, onComplete, onDelay, onDeleteOccurrence,
}: MemoHabitDetailPanelProps) {
  const { theme } = useNoteColorTheme()
  const cardRef = useRef<HTMLDivElement>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)
  const [recordPage, setRecordPage] = useState(0)

  useEffect(() => { setRecordPage(0) }, [detail?.currentState?.itemKey])

  const visible = !!(detail || isLoading)

  useEffect(() => {
    if (!visible || isMobile) return
    function handlePointerDown(e: PointerEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [visible, isMobile, onClose])

  if (!visible) return null

  const currentState = detail?.currentState ?? null
  const streakLabel = currentState ? getHabitStreakLabel(currentState.streak) : null
  const canComplete = currentState?.status === 'pending'
  const canDelay = currentState != null && (
    currentState.status === 'pending' ||
    currentState.status === 'scheduled' ||
    currentState.status === 'delayed'
  )
  const totalPages = detail ? Math.ceil(detail.recentOccurrences.length / RECORDS_PER_PAGE) : 1

  async function handleComplete() {
    if (completing) return
    setCompleting(true)
    try { await onComplete() } finally { setCompleting(false) }
  }

  async function handleDeleteOccurrence(occurrenceId: string) {
    if (!onDeleteOccurrence || deletingId) return
    setDeletingId(occurrenceId)
    try { await onDeleteOccurrence(occurrenceId) } finally { setDeletingId(null) }
  }

  const c = theme.chrome

  const innerContent = (
    <>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {/* eyebrow row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <p
              className="text-[9.5px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: c.muted }}
            >
              重复任务
            </p>
            {currentState && !isLoading ? (
              <span className={[
                'inline-flex items-center rounded-full border px-2 py-px text-[10px] font-semibold',
                getHabitStatusClassName(currentState.status),
              ].join(' ')}>
                {getHabitStatusLabel(currentState)}
              </span>
            ) : null}
            {streakLabel && !isLoading ? (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-200/70 bg-amber-50/80 px-2 py-px text-[10px] font-semibold text-amber-600 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-400">
                🔥 {streakLabel}
              </span>
            ) : null}
          </div>

          {/* title */}
          <h3
            className="mt-1 text-[17px] font-semibold leading-snug"
            style={{ color: c.heading }}
          >
            {detail?.label ?? '加载中…'}
          </h3>

          {/* subtitle */}
          {detail?.lineText ? (
            <p
              className="mt-0.5 line-clamp-2 text-[11.5px] leading-[1.5]"
              style={{ color: c.summary }}
            >
              {detail.lineText}
            </p>
          ) : null}

          {/* time meta */}
          {currentState && !isLoading ? (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span
                  className="text-[9px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: c.muted }}
                >
                  计划
                </span>
                <span className="tabular-nums font-medium" style={{ color: c.heading }}>
                  {formatDetailTimestamp(currentState.dueAt)}
                </span>
              </span>
              {detail?.nextDueAt ? (
                <span className="flex items-center gap-1.5">
                  <span
                    className="text-[9px] font-semibold uppercase tracking-[0.16em]"
                    style={{ color: c.muted }}
                  >
                    下次
                  </span>
                  <span className="tabular-nums" style={{ color: c.summary }}>
                    {formatDetailTimestamp(detail.nextDueAt)}
                  </span>
                </span>
              ) : null}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition"
          style={{ color: c.muted }}
          aria-label="关闭"
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = c.panelMutedSurface }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '' }}
        >
          <X size={13} />
        </button>
      </div>

      {/* ── Divider ─────────────────────────────────────────────────────── */}
      <div className="my-3 border-t" style={{ borderColor: c.panelBorder }} />

      {/* ── Body ────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {/* actions skeleton */}
          <div className="flex gap-1.5">
            <div className="h-7 w-20 animate-pulse rounded-full" style={{ background: c.panelMutedSurface }} />
            <div className="h-7 w-16 animate-pulse rounded-full" style={{ background: c.panelMutedSurface, animationDelay: '60ms' }} />
            <div className="h-7 w-16 animate-pulse rounded-full" style={{ background: c.panelMutedSurface, animationDelay: '120ms' }} />
          </div>
          <div className="border-t" style={{ borderColor: c.panelBorder }} />
          {/* records skeleton */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: c.panelMutedSurface }} />
              <div
                className="h-4 animate-pulse rounded"
                style={{ background: c.panelMutedSurface, animationDelay: `${i * 70}ms`, width: `${48 + i * 11}%` }}
              />
            </div>
          ))}
        </div>
      ) : detail ? (
        <div className="space-y-4">

          {/* ── Actions ─────────────────────────────────────────────────── */}
          {(canComplete || canDelay) ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {canComplete ? (
                  <button
                    type="button"
                    onClick={() => void handleComplete()}
                    disabled={completing}
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-semibold transition active:scale-95 disabled:opacity-50"
                    style={{ background: c.primarySurface, color: c.primaryText }}
                  >
                    {completing ? (
                      <span
                        className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-t-transparent"
                        style={{ borderColor: `${c.primaryText}40`, borderTopColor: c.primaryText }}
                      />
                    ) : (
                      <span className="text-[11px] leading-none">✓</span>
                    )}
                    记为完成
                  </button>
                ) : null}
                {canDelay ? HABIT_DELAY_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      const delayUntil = new Date(Date.now() + preset.minutes * 60 * 1000).toISOString()
                      void onDelay(delayUntil)
                    }}
                    className="inline-flex items-center rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition"
                    style={{
                      background: c.controlSurface,
                      borderColor: c.controlBorder,
                      color: c.controlText,
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLButtonElement
                      el.style.background = c.controlHoverSurface
                      el.style.color = c.controlHoverText
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLButtonElement
                      el.style.background = c.controlSurface
                      el.style.color = c.controlText
                    }}
                  >
                    {preset.label}
                  </button>
                )) : null}
              </div>

              <div className="border-t" style={{ borderColor: c.panelBorder }} />
            </>
          ) : null}

          {/* ── Records ─────────────────────────────────────────────────── */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p
                className="text-[9.5px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: c.muted }}
              >
                最近记录
              </p>
              {detail.recentOccurrences.length > 0 ? (
                <span
                  className="tabular-nums text-[9.5px]"
                  style={{ color: c.muted }}
                >
                  {detail.recentOccurrences.length} 条
                </span>
              ) : null}
            </div>

            {detail.recentOccurrences.length === 0 ? (
              <p
                className="py-4 text-center text-[12px]"
                style={{ color: c.muted }}
              >
                暂无历史记录
              </p>
            ) : (
              <>
                <div className="space-y-px">
                  {detail.recentOccurrences
                    .slice(recordPage * RECORDS_PER_PAGE, (recordPage + 1) * RECORDS_PER_PAGE)
                    .map((event) => {
                      const eventState = {
                        noteId: event.noteId,
                        itemKey: event.itemKey,
                        label: event.label,
                        lineText: event.lineText,
                        dueAt: event.dueAt,
                        status: event.status,
                        streak: 0,
                        delayedTo: event.delayedTo,
                        completionSource: event.completionSource,
                      } as const
                      const isDeleting = deletingId === event.occurrenceId
                      return (
                        <div
                          key={event.occurrenceId}
                          className="group flex items-center gap-2 rounded-lg px-2 py-[5px] transition"
                          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = c.panelMutedSurface }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = '' }}
                        >
                          {/* status dot */}
                          <span className={[
                            'h-1.5 w-1.5 shrink-0 rounded-full',
                            STATUS_DOT_CLASS[event.status] ?? 'bg-muted/40',
                          ].join(' ')} />

                          {/* timestamp */}
                          <span
                            className="flex-1 tabular-nums text-[11.5px]"
                            style={{ color: c.summary }}
                          >
                            {formatDetailTimestamp(event.occurredAt)}
                          </span>

                          {/* status label */}
                          <span className={[
                            'shrink-0 text-[10.5px] font-medium',
                            STATUS_TEXT_CLASS[event.status] ?? 'text-muted-foreground',
                          ].join(' ')}>
                            {getHabitStatusLabel(eventState)}
                          </span>

                          {/* source badge */}
                          {event.completionSource === 'reminder_confirm' ? (
                            <span
                              className="shrink-0 rounded px-1 py-px text-[9px]"
                              style={{ background: c.panelMutedSurface, color: c.muted }}
                            >
                              提醒
                            </span>
                          ) : null}

                          {/* delete */}
                          {onDeleteOccurrence ? (
                            <button
                              type="button"
                              disabled={isDeleting || !!deletingId}
                              onClick={() => void handleDeleteOccurrence(event.occurrenceId)}
                              className="shrink-0 opacity-0 transition hover:text-red-500 group-hover:opacity-100 disabled:pointer-events-none"
                              style={{ color: c.muted }}
                              title="删除"
                            >
                              {isDeleting ? (
                                <span
                                  className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-t-transparent"
                                  style={{ borderColor: `${c.muted}40`, borderTopColor: c.muted }}
                                />
                              ) : (
                                <Trash2 size={10} />
                              )}
                            </button>
                          ) : null}
                        </div>
                      )
                    })}
                </div>

                {/* pagination */}
                {totalPages > 1 ? (
                  <div
                    className="mt-1.5 flex items-center justify-between border-t pt-1.5"
                    style={{ borderColor: c.panelBorder }}
                  >
                    <button
                      type="button"
                      disabled={recordPage === 0}
                      onClick={() => setRecordPage(p => p - 1)}
                      className="px-1.5 py-1 text-[13px] transition disabled:pointer-events-none disabled:opacity-20"
                      style={{ color: c.muted }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = c.heading }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = c.muted }}
                    >
                      ←
                    </button>
                    <span className="tabular-nums text-[10px]" style={{ color: c.muted }}>
                      {recordPage + 1} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={(recordPage + 1) * RECORDS_PER_PAGE >= detail.recentOccurrences.length}
                      onClick={() => setRecordPage(p => p + 1)}
                      className="px-1.5 py-1 text-[13px] transition disabled:pointer-events-none disabled:opacity-20"
                      style={{ color: c.muted }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = c.heading }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = c.muted }}
                    >
                      →
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  )

  // ── Mobile: bottom sheet ──────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="pointer-events-none fixed inset-0 z-[var(--z-modal)] flex items-end">
        <button
          type="button"
          aria-label="关闭详情"
          className="pointer-events-auto absolute inset-0 bg-black/20"
          onClick={onClose}
        />
        <aside
          className="pointer-events-auto relative w-full max-h-[82vh] overflow-y-auto rounded-t-[28px] border px-5 pb-6 pt-4"
          style={{
            background: c.panelSurface,
            borderColor: c.panelBorder,
            boxShadow: '0 -12px 48px rgba(0,0,0,0.12)',
          }}
        >
          {innerContent}
        </aside>
      </div>
    )
  }

  // ── Desktop: floating card ────────────────────────────────────────────────
  const CARD_W = 340
  const MARGIN = 8
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const cardLeft = anchorPos
    ? Math.max(MARGIN, Math.min(vw - CARD_W - MARGIN, anchorPos.x - CARD_W / 2))
    : vw - CARD_W - MARGIN
  const cardTop = anchorPos
    ? Math.max(72, Math.min(vh - 240, anchorPos.y - 56))
    : 80

  return (
    <>
      <style>{`
        @keyframes memoHabitCardIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div
        ref={cardRef}
        className="fixed z-[var(--z-modal)] w-[340px] max-h-[calc(100vh-6rem)] overflow-y-auto rounded-[22px] border p-5"
        style={{
          left: cardLeft,
          top: cardTop,
          background: c.panelSurface,
          borderColor: c.panelBorder,
          boxShadow: c.panelShadow,
          animation: 'memoHabitCardIn 0.18s ease-out',
        }}
      >
        {innerContent}
      </div>
    </>
  )
}
