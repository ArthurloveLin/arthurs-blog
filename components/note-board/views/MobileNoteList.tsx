'use client'

import { Archive, ArchiveRestore, PencilLine } from 'lucide-react'
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
      {items.map(({ message, actions, canDelete, canEdit, priorityControl, isPriorityUpdating }) => (
        <div key={message.id} className="rounded-[20px] border border-border/60 bg-background/55 p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium">{message.author}</span>
            <div className="flex items-center gap-3">
              <span className="whitespace-nowrap text-xs text-muted-foreground">{formatCommentTimeLabel(message.created_at, message.updated_at)}</span>
              {priorityControl ? (
                <PriorityPicker
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
                    <NoteActionButton label={actions.archive.archived ? '取消归档' : '归档便签'} onClick={actions.archive.onToggle}>
                      {actions.archive.archived ? <ArchiveRestore size={15} strokeWidth={1.9} /> : <Archive size={15} strokeWidth={1.9} />}
                    </NoteActionButton>
                  ) : null}
                </div>
              ) : null}
              {canDelete && actions.delete ? (
                <button
                  type="button"
                  className="rounded-full px-2 py-1 text-xs text-rose-600/70 transition hover:bg-rose-50 hover:text-rose-600"
                  onClick={actions.delete.onClick}
                >
                  删除
                </button>
              ) : null}
            </div>
          </div>
          <div className="text-sm leading-relaxed text-foreground/90">
            <NoteContent content={message.content} variant="board" />
          </div>
        </div>
      ))}
    </div>
  )
}