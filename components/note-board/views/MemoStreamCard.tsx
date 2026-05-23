'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlarmClock, Archive, ArchiveRestore, Lock, MessageCircle, PencilLine, Trash2 } from 'lucide-react'
import EmojiReactionSummary from '@/components/emoji/EmojiReactionSummary'
import ReactionToggleBar from '@/components/ReactionToggleBar'
import { NoteActionButton } from '@/components/note-board/components/NoteActionButton'
import { NoteContent } from '@/components/note-board/components/NoteContent'
import { PriorityPicker } from '@/components/note-board/components/PriorityPicker'
import { useNoteBoardActions } from '@/components/note-board/NoteBoardProvider'
import type { NoteCardViewModel } from '@/components/note-board/types'
import { getStickyColorIndex, getStickyColorSeed, STICKY_COLORS } from '@/components/note-board/utils/board'
import { hasInlineDueTags } from '@/components/note-board/utils/editor'
import { NoteCommentPanel } from '@/components/note-board/components/NoteCommentPanel'
import { useNoteColorTheme } from '@/components/note-board/contexts/NoteColorThemeContext'
import { formatCommentTimeLabel } from '@/lib/date-format'

function formatDueLabel(dueAt: string): { label: string; variant: 'upcoming' | 'soon' | 'overdue' } {
  const diff = Date.parse(dueAt) - Date.now()
  const abs = Math.abs(diff)
  const mins = Math.floor(abs / 60000)
  const hours = Math.floor(abs / 3600000)
  const days = Math.floor(abs / 86400000)

  const fmt = (n: number, unit: string) => `${n}${unit}`

  if (diff < 0) {
    const label = days > 0 ? `超期 ${fmt(days, 'd')}` : hours > 0 ? `超期 ${fmt(hours, 'h')}` : `超期 ${fmt(mins || 1, 'm')}`
    return { label, variant: 'overdue' }
  }

  const label = days > 0 ? `${fmt(days, 'd')}后截止` : hours > 0 ? `${fmt(hours, 'h')}后截止` : `${fmt(mins || 1, 'm')}后截止`
  const variant = diff < 86400000 ? 'soon' : 'upcoming'
  return { label, variant }
}

interface MemoStreamCardProps {
  item: NoteCardViewModel
}

export function MemoStreamCard({ item }: MemoStreamCardProps) {
  const {
    message,
    actions,
    canDelete,
    canEdit,
    priorityControl,
    isPriorityUpdating,
    reactionControl,
    checklistControl,
    isOptimistic,
    isOptimisticEditing,
    isFresh,
    isEditing,
  } = item
  const [confirmingAction, setConfirmingAction] = useState<'archive' | 'delete' | null>(null)
  const [showComments, setShowComments] = useState(true)
  const [commentCountDelta, setCommentCountDelta] = useState(0)
  const [liveCommentCount, setLiveCommentCount] = useState<number | null>(null)
  const boardActions = useNoteBoardActions()
  const cardRef = useRef<HTMLDivElement>(null)
  const wasEditingRef = useRef(false)

  // Scroll back to this card when edit session ends (save or cancel)
  useEffect(() => {
    if (wasEditingRef.current && !isEditing) {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    wasEditingRef.current = isEditing
  }, [isEditing])

  // Scroll to this card when it is freshly published
  useEffect(() => {
    if (isFresh) {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isFresh])

  const handleEditClick = useCallback(() => {
    actions.edit?.onClick()
    boardActions.scrollToEditor()
  }, [actions.edit, boardActions])

  const { theme } = useNoteColorTheme()
  const colorIdx = getStickyColorIndex(getStickyColorSeed(message))
  const accentColor = theme.slots[colorIdx % theme.slots.length]?.tape ?? STICKY_COLORS[0]

  return (
    <div
      ref={cardRef}
      className={[
        'relative overflow-hidden rounded-[22px] border bg-card/85 p-5 pl-9 shadow-[0_10px_28px_rgba(15,23,42,0.06)] transition-all duration-200 ease-out will-change-transform hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(15,23,42,0.12)]',
        isEditing
          ? '-translate-y-1 border-border bg-accent/35 shadow-[0_18px_44px_rgba(15,23,42,0.12)]'
          : 'border-border/60 hover:border-border/80',
        isOptimistic || isOptimisticEditing || isFresh
          ? 'animate-in fade-in slide-in-from-bottom-3 duration-300'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        aria-hidden
        className="absolute bottom-5 left-4 top-5 w-1.5 rounded-full"
        style={{
          backgroundColor: accentColor,
          boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.72)',
        }}
      />

      {/* Header: 作者 + 时间 + 操作按钮 */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-medium leading-none text-foreground/85">{message.author}</p>
            {message.visibility === 'admin_only' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                <Lock size={9} strokeWidth={2.2} />
                仅管理员
              </span>
            ) : null}
          </div>
          <span className="mt-1.5 block text-[12px] leading-none text-foreground/50">
            {formatCommentTimeLabel(message.created_at, message.updated_at)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {priorityControl ? (
            <PriorityPicker.Dot
              value={priorityControl.value}
              onChange={priorityControl.onChange}
              disabled={isPriorityUpdating || priorityControl.disabled}
            />
          ) : null}
          {canEdit ? (
            <>
              {actions.edit ? (
                <NoteActionButton label="编辑便签" onClick={handleEditClick}>
                  <PencilLine size={14} strokeWidth={1.8} />
                </NoteActionButton>
              ) : null}
              {actions.archive ? (
                <NoteActionButton
                  label={actions.archive.archived ? '取消归档' : '归档便签'}
                  onClick={() => setConfirmingAction((c) => (c === 'archive' ? null : 'archive'))}
                >
                  {actions.archive.archived ? (
                    <ArchiveRestore size={14} strokeWidth={1.8} />
                  ) : (
                    <Archive size={14} strokeWidth={1.8} />
                  )}
                </NoteActionButton>
              ) : null}
            </>
          ) : null}
          {canDelete && actions.delete ? (
            <NoteActionButton
              label={confirmingAction === 'delete' ? '确认删除便签' : '删除便签'}
              onClick={() => setConfirmingAction((c) => (c === 'delete' ? null : 'delete'))}
            >
              <Trash2 size={14} strokeWidth={1.85} />
            </NoteActionButton>
          ) : null}
        </div>
      </div>

      {/* 确认操作行 */}
      {confirmingAction ? (
        <div className="mb-3 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-full border border-border/60 bg-background/60 px-3 py-1 text-[11.5px] text-muted-foreground transition hover:text-foreground"
            onClick={() => setConfirmingAction(null)}
          >
            取消
          </button>
          <button
            type="button"
            className="rounded-full bg-foreground px-3 py-1 text-[11.5px] font-medium text-background transition hover:opacity-90"
            onClick={() => {
              if (confirmingAction === 'archive') actions.archive?.onToggle()
              if (confirmingAction === 'delete') actions.delete?.onClick()
              setConfirmingAction(null)
            }}
          >
            {confirmingAction === 'archive' ? '确认归档' : '确认删除'}
          </button>
        </div>
      ) : null}

      {/* 正文内容 */}
      <div className="text-[15px] leading-[1.75] text-foreground/85">
        <NoteContent
          content={message.content}
          variant="stream"
          onToggleChecklistItem={checklistControl?.onToggle}
          checklistPending={checklistControl?.pending}
          notifiedDues={message.notified_dues}
        />
      </div>


      {/* 截止时间（仅无 inline @due 标签时显示全局 badge） */}
      {message.due_at && !hasInlineDueTags(message.content) ? (() => {
        const { label, variant } = formatDueLabel(message.due_at)
        const isRepeat = message.repeat_mode && message.repeat_mode !== 'once'
        const repeatLabel = isRepeat
          ? message.repeat_mode === 'daily' ? '每天'
          : message.repeat_mode === 'weekdays' ? '周一至周五'
          : '自定义'
          : null
        return (
          <div className={[
            'mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
            variant === 'overdue'
              ? 'bg-red-100/80 text-red-600'
              : variant === 'soon'
                ? 'bg-amber-100/80 text-amber-600'
                : 'bg-slate-100/80 text-slate-500',
          ].join(' ')}>
            <AlarmClock size={10} strokeWidth={2} />
            {label}
            {repeatLabel ? (
              <span className="ml-0.5 opacity-70">· {repeatLabel}</span>
            ) : null}
          </div>
        )
      })() : null}

      {/* memo_reminders 提醒列表 */}
      {message.reminders && message.reminders.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {message.reminders.map((r) => {
            const repeatLabel = r.repeat_mode === 'daily' ? '每天' : r.repeat_mode === 'weekdays' ? '周一至五' : r.repeat_mode === 'custom' ? '自定义' : null
            const dueDate = new Date(r.due_at)
            const timeStr = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(dueDate)
            return (
              <div key={r.id} className="group flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-50/60 py-0.5 pl-2 pr-1.5 text-[11px] text-amber-700">
                <AlarmClock size={10} strokeWidth={2} />
                <span className="font-medium">{r.label || '提醒'}</span>
                <span className="opacity-60">{timeStr}</span>
                {repeatLabel ? <span className="opacity-50">· {repeatLabel}</span> : null}
                {canDelete ? (
                  <button
                    type="button"
                    title="删除提醒"
                    onClick={async () => {
                      await fetch(`/api/note-boards/memo/reminders/${r.id}`, { method: 'DELETE' })
                      boardActions.removeReminderFromMessage(message.id, r.id)
                    }}
                    className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-amber-500 opacity-0 transition hover:bg-amber-200/60 group-hover:opacity-100"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}

      {/* 表情反应 */}
      <EmojiReactionSummary
        entries={reactionControl.emojiReactions}
        onSelect={reactionControl.onEmojiReact}
        variant="bare"
        className="mt-4 gap-x-2 gap-y-1"
      />
      {/* 点赞/踩 */}
      <ReactionToggleBar
        className="mt-3"
        compact
        variant="bare"
        upvotes={reactionControl.upvotes}
        downvotes={reactionControl.downvotes}
        viewerReaction={reactionControl.viewerReaction}
        pending={reactionControl.pending}
        emojiPending={reactionControl.emojiPending}
        onReact={reactionControl.onReact}
        onEmojiReact={reactionControl.onEmojiReact}
      />

      {/* 评论入口 */}
      <div className="mt-3 flex items-center border-t border-border/20 pt-3">
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className={[
            'flex items-center gap-1.5 text-[12px] font-medium transition',
            showComments ? 'text-foreground/70' : 'text-muted-foreground/55 hover:text-foreground/70',
          ].join(' ')}
        >
          <MessageCircle size={13} strokeWidth={1.8} />
          {(() => {
            const base = liveCommentCount ?? (message.comment_count ?? 0)
            const total = base + commentCountDelta
            return total > 0 ? `${total} 条评论` : '评论'
          })()}
        </button>
      </div>

      {showComments && (
        <NoteCommentPanel
          noteId={message.id}
          onCommentAdded={() => setCommentCountDelta((d) => d + 1)}
          onCountLoaded={(count) => { setLiveCommentCount(count); setCommentCountDelta(0) }}
        />
      )}
    </div>
  )
}
