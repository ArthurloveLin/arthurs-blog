'use client'

import { Archive, ArchiveRestore, PencilLine } from 'lucide-react'
import { useState } from 'react'
import EmojiReactionSummary from '@/components/emoji/EmojiReactionSummary'
import ReactionToggleBar from '@/components/ReactionToggleBar'
import { NoteActionButton } from '@/components/note-board/components/NoteActionButton'
import { NoteContent } from '@/components/note-board/components/NoteContent'
import { PriorityPicker } from '@/components/note-board/components/PriorityPicker'
import type { NoteCardViewModel } from '@/components/note-board/types'
import { formatCommentTimeLabel } from '@/lib/date-format'

interface MobileNoteListProps {
  items: NoteCardViewModel[]
}

export function MobileNoteList({ items }: MobileNoteListProps) {
  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => <MobileNoteListItem key={item.message.id} item={item} />)}
    </div>
  )
}

function MobileNoteListItem({ item }: { item: NoteCardViewModel }) {
  const { message, actions, canDelete, canEdit, priorityControl, isPriorityUpdating, reactionControl, isOptimistic, isOptimisticEditing, isFresh } = item
  const [confirmingAction, setConfirmingAction] = useState<'archive' | 'delete' | null>(null)

  return (
    <div className={[
      'rounded-[20px] border border-border/60 bg-background/55 p-5 shadow-sm transition-all',
      (isOptimistic || isOptimisticEditing || isFresh) ? 'animate-in fade-in slide-in-from-bottom-3 duration-300' : '',
    ].filter(Boolean).join(' ')}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{message.author}</span>
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {isOptimistic ? '发布中…' : isOptimisticEditing ? '编辑中…' : formatCommentTimeLabel(message.created_at, message.updated_at)}
          </span>
          {priorityControl ? (
            <PriorityPicker.Dot
              value={priorityControl.value}
              onChange={priorityControl.onChange}
              disabled={isPriorityUpdating || priorityControl.disabled}
            />
          ) : null}
          {canEdit ? (
            <div className="flex items-center gap-2">
              {actions.edit ? (
                <NoteActionButton label="编辑便签" onClick={actions.edit.onClick}>
                  <PencilLine size={15} strokeWidth={1.9} />
                </NoteActionButton>
              ) : null}
              {actions.archive ? (
                <NoteActionButton
                  label={confirmingAction === 'archive' ? '确认归档便签' : (actions.archive.archived ? '取消归档' : '归档便签')}
                  onClick={() => setConfirmingAction((current) => current === 'archive' ? null : 'archive')}
                >
                  {actions.archive.archived ? <ArchiveRestore size={15} strokeWidth={1.9} /> : <Archive size={15} strokeWidth={1.9} />}
                </NoteActionButton>
              ) : null}
            </div>
          ) : null}
          {canDelete && actions.delete ? (
            <button
              type="button"
              className="rounded-full px-2 py-1 text-xs text-rose-600/70 transition hover:bg-rose-50 hover:text-rose-600"
              onClick={() => setConfirmingAction((current) => current === 'delete' ? null : 'delete')}
            >
              {confirmingAction === 'delete' ? '确认删除？' : '删除'}
            </button>
          ) : null}
        </div>
      </div>
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
              if (confirmingAction === 'archive') {
                actions.archive?.onToggle()
              }

              if (confirmingAction === 'delete') {
                actions.delete?.onClick()
              }

              setConfirmingAction(null)
            }}
          >
            {confirmingAction === 'archive' ? '确认归档' : '确认删除'}
          </button>
        </div>
      ) : null}
      <div className="text-sm leading-relaxed text-foreground/90">
        <NoteContent content={message.content} variant="board" />
      </div>
      <EmojiReactionSummary
        entries={reactionControl.emojiReactions}
        onSelect={reactionControl.onEmojiReact}
        variant="bare"
        className="mt-4 gap-x-2 gap-y-1"
      />
      <ReactionToggleBar
        className="mt-4"
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