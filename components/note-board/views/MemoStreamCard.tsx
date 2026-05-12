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
import { parseHashtags } from '@/components/note-board/utils/editor'
import { formatCommentTimeLabel, formatStableDate } from '@/lib/date-format'

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

  const hashtags = parseHashtags(message.content)
  const absoluteDate = formatStableDate(message.updated_at ?? message.created_at, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      ref={cardRef}
      className={[
        'rounded-[20px] border bg-card/80 p-5 shadow-sm transition-all',
        isEditing ? 'border-border bg-accent/30' : 'border-border/60',
        isOptimistic || isOptimisticEditing || isFresh
          ? 'animate-in fade-in slide-in-from-bottom-3 duration-300'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted-foreground">
            {formatCommentTimeLabel(message.created_at, message.updated_at)}
          </span>
          <span className="text-[10px] text-muted-foreground/50">{absoluteDate}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
                  <PencilLine size={15} strokeWidth={1.9} />
                </NoteActionButton>
              ) : null}
              {actions.archive ? (
                <NoteActionButton
                  label={actions.archive.archived ? '取消归档' : '归档便签'}
                  onClick={() =>
                    setConfirmingAction((c) => (c === 'archive' ? null : 'archive'))
                  }
                >
                  {actions.archive.archived ? (
                    <ArchiveRestore size={15} strokeWidth={1.9} />
                  ) : (
                    <Archive size={15} strokeWidth={1.9} />
                  )}
                </NoteActionButton>
              ) : null}
            </>
          ) : null}
          {canDelete && actions.delete ? (
            <button
              type="button"
              className="rounded-full px-2 py-1 text-xs text-rose-600/70 transition hover:bg-rose-50 hover:text-rose-600"
              onClick={() => setConfirmingAction((c) => (c === 'delete' ? null : 'delete'))}
            >
              {confirmingAction === 'delete' ? '确认删除？' : '删除'}
            </button>
          ) : null}
        </div>
      </div>

      {/* Confirm row */}
      {confirmingAction ? (
        <div className="mb-3 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[11px] text-muted-foreground transition hover:text-foreground"
            onClick={() => setConfirmingAction(null)}
          >
            取消
          </button>
          <button
            type="button"
            className="rounded-full bg-foreground px-3 py-1 text-[11px] text-background transition hover:opacity-90"
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

      {/* Content */}
      <div className="text-sm leading-relaxed text-foreground/90">
        <NoteContent
          content={message.content}
          variant="stream"
          onToggleChecklistItem={checklistControl?.onToggle}
          checklistPending={checklistControl?.pending}
        />
      </div>

      {/* Hashtag chips */}
      {hashtags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {hashtags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => boardActions.handleTagFilter(tag)}
              className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground transition hover:border-border hover:text-foreground"
            >
              #{tag}
            </button>
          ))}
        </div>
      ) : null}

      {/* Reactions */}
      <EmojiReactionSummary
        entries={reactionControl.emojiReactions}
        onSelect={reactionControl.onEmojiReact}
        variant="bare"
        className="mt-4 gap-x-2 gap-y-1"
      />
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
