'use client'

import { Archive, ArchiveRestore, Lock, MessageCircle, PencilLine, Trash2 } from 'lucide-react'
import { useState } from 'react'
import EmojiReactionSummary from '@/components/emoji/EmojiReactionSummary'
import ReactionToggleBar from '@/components/ReactionToggleBar'
import { NoteActionButton } from '@/components/note-board/components/NoteActionButton'
import { NoteCommentPanel } from '@/components/note-board/components/NoteCommentPanel'
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
  const { message, actions, canDelete, canEdit, priorityControl, isPriorityUpdating, reactionControl, checklistControl, isOptimistic, isOptimisticEditing, isFresh } = item
  const [confirmingAction, setConfirmingAction] = useState<'archive' | 'delete' | null>(null)
  const [showComments, setShowComments] = useState(false)

  return (
    <div className={[
      'rounded-[20px] border border-border/60 bg-background/55 p-5 shadow-sm transition-all',
      (isOptimistic || isOptimisticEditing || isFresh) ? 'animate-in fade-in slide-in-from-bottom-3 duration-300' : '',
    ].filter(Boolean).join(' ')}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{message.author}</span>
          {message.visibility === 'admin_only' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
              <Lock size={9} strokeWidth={2.2} />
              仅管理员
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatCommentTimeLabel(message.created_at, message.updated_at)}
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
            <NoteActionButton
              label={confirmingAction === 'delete' ? '确认删除便签' : '删除便签'}
              onClick={() => setConfirmingAction((current) => current === 'delete' ? null : 'delete')}
            >
              <Trash2 size={15} strokeWidth={1.9} />
            </NoteActionButton>
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
        <NoteContent
          content={message.content}
          variant="board"
          onToggleChecklistItem={checklistControl?.onToggle}
          checklistPending={checklistControl?.pending}
        />
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
      <div className="mt-4 flex items-center border-t border-border/20 pt-3">
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className={[
            'flex items-center gap-1.5 text-[12px] font-medium transition',
            showComments ? 'text-foreground/70' : 'text-muted-foreground/55 hover:text-foreground/70',
          ].join(' ')}
        >
          <MessageCircle size={13} strokeWidth={1.8} />
          评论
        </button>
      </div>
      {showComments && <NoteCommentPanel noteId={message.id} />}
    </div>
  )
}
