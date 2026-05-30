'use client'

import { useEffect, useRef, useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { HABIT_DELAY_PRESETS, formatHabitTime, getHabitStatusClassName, getHabitStatusLabel, getHabitStreakLabel } from '@/components/note-board/utils/habit-ui'
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

export function MemoHabitDetailPanel({ detail, isLoading, isMobile, anchorPos, onClose, onComplete, onDelay, onDeleteOccurrence }: MemoHabitDetailPanelProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)
  const [showAllRecords, setShowAllRecords] = useState(false)

  const visible = !!(detail || isLoading)

  // Click-outside dismiss for PC card
  useEffect(() => {
    if (!visible || isMobile) return
    function handlePointerDown(e: PointerEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [visible, isMobile, onClose])

  if (!visible) return null

  const currentState = detail?.currentState ?? null
  const streakLabel = currentState ? getHabitStreakLabel(currentState.streak) : null
  const canComplete = currentState?.status === 'pending'
  const canDelay = currentState != null && (currentState.status === 'pending' || currentState.status === 'scheduled' || currentState.status === 'delayed')

  async function handleComplete() {
    if (completing) return
    setCompleting(true)
    try {
      await onComplete()
    } finally {
      setCompleting(false)
    }
  }

  async function handleDeleteOccurrence(occurrenceId: string) {
    if (!onDeleteOccurrence || deletingId) return
    setDeletingId(occurrenceId)
    try {
      await onDeleteOccurrence(occurrenceId)
    } finally {
      setDeletingId(null)
    }
  }

  const innerContent = (
    <>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/50">重复任务详情</p>
          <h3 className="mt-1 truncate text-[20px] font-semibold leading-tight text-foreground/90">
            {detail?.label ?? '加载中…'}
          </h3>
          {detail?.lineText ? (
            <p className="mt-1 text-[12px] text-muted-foreground/65">{detail.lineText}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <X size={15} />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-16 animate-pulse rounded-2xl bg-muted/30" />
          <div className="h-24 animate-pulse rounded-2xl bg-muted/30" />
          <div className="h-32 animate-pulse rounded-2xl bg-muted/30" />
        </div>
      ) : detail ? (
        <div className="space-y-4 overflow-y-auto pr-1">
          {currentState ? (
            <div className="rounded-2xl border border-border/50 bg-background/60 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={[
                  'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium',
                  getHabitStatusClassName(currentState.status),
                ].join(' ')}>
                  {getHabitStatusLabel(currentState)}
                </span>
                {streakLabel ? (
                  <span className="inline-flex items-center rounded-full border border-border/60 bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground/75">
                    {streakLabel}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] text-muted-foreground/70">
                <div className="rounded-xl bg-background/80 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/45">计划时间</p>
                  <p className="mt-1 text-foreground/80">{formatDetailTimestamp(currentState.dueAt)}</p>
                </div>
                <div className="rounded-xl bg-background/80 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/45">下次</p>
                  <p className="mt-1 text-foreground/80">{detail.nextDueAt ? formatDetailTimestamp(detail.nextDueAt) : '无'}</p>
                </div>
              </div>
            </div>
          ) : null}

          {(canComplete || canDelay) ? (
            <div className="rounded-2xl border border-border/50 bg-background/60 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/55">操作</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {canComplete ? (
                  <button
                    type="button"
                    onClick={() => void handleComplete()}
                    disabled={completing}
                    className="inline-flex items-center rounded-full bg-foreground px-3 py-1.5 text-[12px] font-medium text-background transition hover:opacity-90 disabled:opacity-50"
                  >
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
                    className="inline-flex items-center rounded-full border border-border/60 bg-background px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  >
                    延后 {preset.label}
                  </button>
                )) : null}
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-border/50 bg-background/60 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/55">最近记录</p>
            <div className="mt-3 space-y-2">
              {detail.recentOccurrences.length === 0 ? (
                <div className="rounded-xl bg-background/80 px-3 py-4 text-[12px] text-muted-foreground/55">
                  还没有历史记录。
                </div>
              ) : (showAllRecords ? detail.recentOccurrences : detail.recentOccurrences.slice(0, 3)).map((event) => {
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
                  <div key={event.occurrenceId} className="flex items-start justify-between gap-2 rounded-xl bg-background/80 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-foreground/80">{event.label}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground/55">{formatDetailTimestamp(event.occurredAt)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={[
                        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
                        getHabitStatusClassName(eventState.status),
                      ].join(' ')}>
                        {getHabitStatusLabel(eventState)}
                      </span>
                      {event.completionSource ? (
                        <span className="text-[10px] text-muted-foreground/45">
                          {event.completionSource === 'manual_check' ? '手动勾选' : '提醒确认'}
                        </span>
                      ) : null}
                      {onDeleteOccurrence ? (
                        <button
                          type="button"
                          disabled={isDeleting || !!deletingId}
                          onClick={() => void handleDeleteOccurrence(event.occurrenceId)}
                          className="mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] text-muted-foreground/50 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-950/40"
                          title="删除此条记录"
                        >
                          <Trash2 size={9} />
                          {isDeleting ? '删除中…' : '删除'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
            {detail.recentOccurrences.length > 3 ? (
              <button
                type="button"
                onClick={() => setShowAllRecords(v => !v)}
                className="mt-2 w-full rounded-xl py-1.5 text-[11px] text-muted-foreground/55 transition hover:bg-background/80 hover:text-muted-foreground"
              >
                {showAllRecords ? '收起' : `查看全部 ${detail.recentOccurrences.length} 条`}
              </button>
            ) : null}
          </div>

          {detail.nextDueAt ? (
            <div className="text-[12px] text-muted-foreground/60">
              下次计划时间：{formatHabitTime(detail.nextDueAt)}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  )

  // ── Mobile: bottom sheet drawer ───────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 flex pointer-events-none items-end">
        <button
          type="button"
          aria-label="关闭详情"
          className="absolute inset-0 bg-black/20 pointer-events-auto"
          onClick={onClose}
        />
        <aside className="relative pointer-events-auto w-full max-h-[82vh] rounded-t-[28px] border border-border/60 bg-card shadow-[0_24px_80px_rgba(15,23,42,0.18)] px-5 pb-6 pt-4">
          {innerContent}
        </aside>
      </div>
    )
  }

  // ── Desktop: inline floating card, no dark overlay ────────────────────────
  const CARD_W = 360
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
    <div
      ref={cardRef}
      className="fixed z-50 w-[360px] max-h-[calc(100vh-6rem)] overflow-y-auto rounded-[28px] border border-border/60 bg-card p-5 shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
      style={{ left: cardLeft, top: cardTop, animation: 'memoHabitCardIn 0.18s ease-out' }}
    >
      <style>{`
        @keyframes memoHabitCardIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      {innerContent}
    </div>
  )
}