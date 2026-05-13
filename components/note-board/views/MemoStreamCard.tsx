'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Archive, ArchiveRestore, PencilLine } from 'lucide-react'
import EmojiReactionSummary from '@/components/emoji/EmojiReactionSummary'
import ReactionToggleBar from '@/components/ReactionToggleBar'
import { NoteActionButton } from '@/components/note-board/components/NoteActionButton'
import { NoteContent } from '@/components/note-board/components/NoteContent'
import { PriorityPicker } from '@/components/note-board/components/PriorityPicker'
import { useNoteBoardActions } from '@/components/note-board/NoteBoardProvider'
import type { NoteCardViewModel } from '@/components/note-board/types'
import { getStickyColorIndex, getStickyColorSeed, STICKY_COLORS } from '@/components/note-board/utils/board'
import { formatCommentTimeLabel } from '@/lib/date-format'

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

  const accentColor = STICKY_COLORS[
    getStickyColorIndex(getStickyColorSeed(message))
  ] ?? STICKY_COLORS[0]

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

      {/* Header: 时间 + 操作按钮 */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[12px] font-medium leading-none text-foreground/70">
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
            <button
              type="button"
              className="rounded-full px-2 py-0.5 text-[11px] text-rose-500/60 transition hover:bg-rose-50 hover:text-rose-600"
              onClick={() => setConfirmingAction((c) => (c === 'delete' ? null : 'delete'))}
            >
              {confirmingAction === 'delete' ? '确认删除？' : '删除'}
            </button>
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
      <div className="text-[13.5px] leading-[1.7] text-foreground/85">
        <NoteContent
          content={message.content}
          variant="stream"
          onToggleChecklistItem={checklistControl?.onToggle}
          checklistPending={checklistControl?.pending}
        />
      </div>


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
    </div>
  )
}
