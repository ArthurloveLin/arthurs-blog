import { NOTE_MAX_LENGTH } from '@/lib/input-limits'
import type { Comment } from '@/lib/comments'
import type { NoteMessage } from '@/lib/note-boards'
import { DEFAULT_NOTE_PRIORITY } from '@/lib/note-priority'

export function createGuestbookNoteMessage(comment: Comment, archived = false): NoteMessage {
  return {
    id: comment.id,
    author: comment.author,
    content: comment.content,
    created_at: comment.created_at,
    updated_at: comment.updated_at,
    priority: DEFAULT_NOTE_PRIORITY,
    archived,
    parent_id: comment.parent_id,
    upvotes: comment.upvotes,
    downvotes: comment.downvotes,
    viewer_reaction: comment.viewer_reaction,
    emoji_reactions: comment.emoji_reactions,
    viewer_emojis: comment.viewer_emojis,
    sync_state: comment.sync_state,
  }
}

export function createGuestbookMessagesFromComments(comments: Comment[], archived = false) {
  return comments
    .filter((comment) => comment.parent_id === null)
    .map((comment) => createGuestbookNoteMessage(comment, archived))
}

export function humanizeGuestbookMutationError(message: string | undefined, fallback: string) {
  if (!message) {
    return fallback
  }

  if (message === 'ENGAGEMENT_WORKER_UNAVAILABLE') {
    return '留言服务暂时不可用。'
  }

  if (message === 'Failed to fetch') {
    return '网络错误，请重试。'
  }

  if (message === 'Content too long') {
    return `便签不能超过 ${NOTE_MAX_LENGTH} 字。`
  }

  return message
}
