'use client'

import { Archive, ArchiveRestore, PencilLine } from 'lucide-react'
import { NoteActionButton } from '@/components/note-board/components/NoteActionButton'
import { NoteContent } from '@/components/note-board/components/NoteContent'
import { PriorityPicker } from '@/components/note-board/components/PriorityPicker'
import { formatCommentTimeLabel } from '@/lib/date-format'
import type { NotePriority } from '@/lib/note-priority'
import type { NoteMessage } from '@/lib/note-boards'

interface MobileNoteListProps {
  messages: NoteMessage[]
  onDelete: (id: string) => void
  canDelete: (message: NoteMessage) => boolean
  onEdit: (message: NoteMessage) => void
  canEdit: (message: NoteMessage) => boolean
  onToggleArchive: (message: NoteMessage) => void
  showPriority: boolean
  onPriorityChange: (message: NoteMessage, priority: NotePriority) => void
  isPriorityUpdating: (id: string) => boolean
}

export function MobileNoteList({
  messages,
  onDelete,
  canDelete,
  onEdit,
  canEdit,
  onToggleArchive,
  showPriority,
  onPriorityChange,
  isPriorityUpdating,
}: MobileNoteListProps) {
  return (
    <div className="flex flex-col gap-4">
      {messages.map((message) => (
        <div key={message.id} className="rounded-[20px] border border-border/60 bg-background/55 p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium">{message.author}</span>
            <div className="flex items-center gap-3">
              <span className="whitespace-nowrap text-xs text-muted-foreground">{formatCommentTimeLabel(message.created_at, message.updated_at)}</span>
              {showPriority ? (
                <PriorityPicker
                  value={message.priority}
                  onChange={canEdit(message) ? (priority) => onPriorityChange(message, priority) : undefined}
                  disabled={isPriorityUpdating(message.id)}
                />
              ) : null}
              {canEdit(message) ? (
                <div className="flex items-center gap-2">
                  <NoteActionButton label="编辑便签" onClick={() => onEdit(message)}>
                    <PencilLine size={15} strokeWidth={1.9} />
                  </NoteActionButton>
                  <NoteActionButton label={message.archived ? '取消归档' : '归档便签'} onClick={() => onToggleArchive(message)}>
                    {message.archived ? <ArchiveRestore size={15} strokeWidth={1.9} /> : <Archive size={15} strokeWidth={1.9} />}
                  </NoteActionButton>
                </div>
              ) : null}
              {canDelete(message) ? (
                <button
                  type="button"
                  className="rounded-full px-2 py-1 text-xs text-rose-600/70 transition hover:bg-rose-50 hover:text-rose-600"
                  onClick={() => onDelete(message.id)}
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