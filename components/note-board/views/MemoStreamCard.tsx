'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { AlarmClock, Archive, ArchiveRestore, FileDown, Lock, MessageCircle, PencilLine, Trash2 } from 'lucide-react'
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
import { formatCommentTimeLabel, formatStableDate } from '@/lib/date-format'
import type { MemoHabitCurrentState } from '@/lib/memo-habits'

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

function exportNote(content: string, format: 'md' | 'txt') {
  const firstLine = content.split('\n')[0]?.replace(/^#+\s*/, '').replace(/[^\w\u4e00-\u9fff\-]/g, ' ').trim().slice(0, 40) || 'memo'
  const text = format === 'md' ? content : content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/==([^=\n]+)==/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/~~([^~\n]+)~~/g, '$1')
    .replace(/@due\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/#[\w\u4e00-\u9fff]+/g, (m) => m.slice(1))
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim()
  const ext = format === 'md' ? 'md' : 'txt'
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${firstLine}.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}

interface MemoStreamCardProps {
  item: NoteCardViewModel
  habitStates?: Record<string, MemoHabitCurrentState>
  onOpenHabitDetail?: (noteId: string, itemKey: string) => void
  onCompleteHabitItem?: (noteId: string, itemKey: string) => void
}

export function MemoStreamCard({ item, habitStates, onOpenHabitDetail, onCompleteHabitItem }: MemoStreamCardProps) {
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
  const [showExportMenu, setShowExportMenu] = useState(false)
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
  const cardThemeVars = {
    '--memo-local-card-surface': theme.chrome.cardSurface,
    '--memo-local-card-editing-surface': theme.chrome.cardEditingSurface,
    '--memo-local-card-border': theme.chrome.cardBorder,
    '--memo-local-card-hover-border': theme.chrome.cardHoverBorder,
    '--memo-local-card-shadow': theme.chrome.cardShadow,
    '--memo-local-card-hover-shadow': theme.chrome.cardHoverShadow,
    '--memo-local-card-text': theme.chrome.cardText,
    '--memo-local-card-muted': theme.chrome.cardMuted,
    '--memo-local-control-surface': theme.chrome.controlSurface,
    '--memo-local-control-border': theme.chrome.controlBorder,
    '--memo-local-control-text': theme.chrome.controlText,
    '--memo-local-primary-surface': theme.chrome.primarySurface,
    '--memo-local-primary-text': theme.chrome.primaryText,
  } as CSSProperties

  return (
    <div
      ref={cardRef}
      className={[
        'relative overflow-hidden rounded-[22px] border p-5 pl-9 transition-all duration-200 ease-out will-change-transform hover:-translate-y-1 [border-color:var(--memo-local-card-border)] [background:var(--memo-local-card-surface)] [box-shadow:var(--memo-local-card-shadow)] hover:[border-color:var(--memo-local-card-hover-border)] hover:[box-shadow:var(--memo-local-card-hover-shadow)]',
        isEditing
          ? '-translate-y-1 [border-color:var(--memo-local-card-hover-border)] [background:var(--memo-local-card-editing-surface)] [box-shadow:var(--memo-local-card-hover-shadow)]'
          : '',
        isOptimistic || isOptimisticEditing || isFresh
          ? 'animate-in fade-in slide-in-from-bottom-3 duration-300'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={cardThemeVars}
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
            <p className="text-[14px] font-medium leading-none text-[color:var(--memo-local-card-text)]">{message.author}</p>
            {message.visibility === 'admin_only' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                <Lock size={9} strokeWidth={2.2} />
                仅管理员
              </span>
            ) : null}
          </div>
          <span className="mt-1.5 block text-[12px] leading-none text-[color:var(--memo-local-card-muted)]">
            {formatCommentTimeLabel(message.created_at, message.updated_at)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
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
          <NoteActionButton
            label="导出便签"
            onClick={() => setShowExportMenu((v) => !v)}
          >
            <FileDown size={14} strokeWidth={1.85} />
          </NoteActionButton>
        </div>
      </div>

      {/* 确认操作行 */}
      {confirmingAction ? (
        <div className="mb-3 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-full border px-3 py-1 text-[11.5px] transition [border-color:var(--memo-local-control-border)] [background:var(--memo-local-control-surface)] text-[color:var(--memo-local-control-text)] hover:opacity-90"
            onClick={() => setConfirmingAction(null)}
          >
            取消
          </button>
          <button
            type="button"
            className="rounded-full px-3 py-1 text-[11.5px] font-medium transition hover:opacity-90 [background:var(--memo-local-primary-surface)] text-[color:var(--memo-local-primary-text)]"
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

      {/* 导出格式选择行 */}
      {showExportMenu ? (
        <div className="mb-3 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-full border px-3 py-1 text-[11.5px] transition [border-color:var(--memo-local-control-border)] [background:var(--memo-local-control-surface)] text-[color:var(--memo-local-control-text)] hover:opacity-90"
            onClick={() => setShowExportMenu(false)}
          >
            取消
          </button>
          <button
            type="button"
            className="rounded-full border px-3 py-1 text-[11.5px] transition [border-color:var(--memo-local-control-border)] [background:var(--memo-local-control-surface)] text-[color:var(--memo-local-control-text)] hover:opacity-90"
            onClick={() => { exportNote(message.content, 'txt'); setShowExportMenu(false) }}
          >
            纯文本
          </button>
          <button
            type="button"
            className="rounded-full px-3 py-1 text-[11.5px] font-medium transition hover:opacity-90 [background:var(--memo-local-primary-surface)] text-[color:var(--memo-local-primary-text)]"
            onClick={() => { exportNote(message.content, 'md'); setShowExportMenu(false) }}
          >
            Markdown
          </button>
        </div>
      ) : null}

      {/* 正文内容 */}
      <div className="text-[15px] leading-[1.75] text-[color:var(--memo-local-card-text)]">
        <NoteContent
          content={message.content}
          variant="stream"
          onToggleChecklistItem={checklistControl?.onToggle}
          checklistPending={checklistControl?.pending}
          notifiedDues={message.notified_dues}
          habitStates={habitStates}
          onOpenHabitDetail={onOpenHabitDetail ? (itemKey) => onOpenHabitDetail(message.id, itemKey) : undefined}
          onCompleteHabitItem={onCompleteHabitItem ? (itemKey) => onCompleteHabitItem(message.id, itemKey) : undefined}
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

      {/* 表情反应 */}
      <EmojiReactionSummary
        entries={reactionControl.emojiReactions}
        onSelect={reactionControl.onEmojiReact}
        variant="bare"
        className="mt-4 gap-x-2 gap-y-1"
      />
      {/* 点赞/踩 + 创建日期 */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <ReactionToggleBar
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
        <span className="shrink-0 text-[11px] leading-none text-[color:var(--memo-local-card-muted)]">
          {formatStableDate(message.created_at, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* 评论入口 */}
      <div className="mt-3 flex items-center border-t pt-3 [border-color:var(--memo-local-card-border)]">
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className={[
            'flex items-center gap-1.5 text-[12px] font-medium transition',
            showComments ? 'text-[color:var(--memo-local-card-text)] opacity-75' : 'text-[color:var(--memo-local-card-muted)] hover:opacity-80',
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
