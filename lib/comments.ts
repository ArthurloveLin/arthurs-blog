import type { EmojiReactionEntry } from '@/lib/comment-emojis'
import type { ReactionValue } from '@/lib/comment-reactions'

export type CommentSyncState = 'persisted' | 'pending'

export interface CommentReplyTarget {
  id: string
  author: string
}

export interface Comment {
  id: string
  author: string
  content: string
  created_at: string
  updated_at: string | null
  parent_id: string | null
  upvotes: number
  downvotes: number
  viewer_reaction: ReactionValue
  emoji_reactions: EmojiReactionEntry[]
  viewer_emojis: string[]
  sync_state?: CommentSyncState
  optimistic?: boolean
}

export interface CommentViewerState {
  id: string
  viewer_reaction: ReactionValue
  viewer_emojis: string[]
}

type CommentRecordInput = Omit<Comment, 'viewer_reaction' | 'viewer_emojis' | 'emoji_reactions' | 'upvotes' | 'downvotes'>
  & Partial<Pick<Comment, 'viewer_reaction' | 'viewer_emojis' | 'emoji_reactions'>>
  & {
    upvotes?: number | null
    downvotes?: number | null
  }

function compareComments(left: Pick<Comment, 'created_at' | 'id'>, right: Pick<Comment, 'created_at' | 'id'>) {
  const timeDifference = new Date(left.created_at).getTime() - new Date(right.created_at).getTime()

  if (timeDifference !== 0) {
    return timeDifference
  }

  return left.id.localeCompare(right.id)
}

function applyViewerState(comment: Comment, viewerState?: CommentViewerState): Comment {
  const viewerEmojis = viewerState?.viewer_emojis ?? []
  const viewerEmojiSet = new Set(viewerEmojis)

  return {
    ...comment,
    viewer_reaction: viewerState?.viewer_reaction ?? 0,
    viewer_emojis: viewerEmojis,
    emoji_reactions: comment.emoji_reactions.map((entry) => ({
      ...entry,
      viewer: viewerEmojiSet.has(entry.emoji),
    })),
  }
}

export function createCommentRecord(record: CommentRecordInput): Comment {
  return {
    ...record,
    upvotes: record.upvotes ?? 0,
    downvotes: record.downvotes ?? 0,
    viewer_reaction: record.viewer_reaction ?? 0,
    emoji_reactions: record.emoji_reactions ?? [],
    viewer_emojis: record.viewer_emojis ?? [],
    sync_state: record.sync_state ?? 'persisted',
  }
}

export function applyViewerStateToComments(comments: Comment[], viewerState: CommentViewerState[]) {
  const viewerStateMap = new Map(viewerState.map((entry) => [entry.id, entry]))

  return comments.map((comment) => applyViewerState(comment, viewerStateMap.get(comment.id)))
}

export function mergeCommentThread(currentComments: Comment[], nextComments: Comment[]) {
  const currentById = new Map(currentComments.map((comment) => [comment.id, comment]))
  const nextIds = new Set(nextComments.map((comment) => comment.id))

  const mergedPersistedComments = nextComments.map((comment) => {
    const currentComment = currentById.get(comment.id)
    if (!currentComment) {
      return comment
    }

    return applyViewerState(
      {
        ...comment,
        optimistic: currentComment.optimistic,
      },
      {
        id: comment.id,
        viewer_reaction: currentComment.viewer_reaction,
        viewer_emojis: currentComment.viewer_emojis,
      },
    )
  })

  const localOnlyComments = currentComments.filter((comment) => {
    if (!comment.optimistic && comment.sync_state !== 'pending') {
      return false
    }

    return !nextIds.has(comment.id)
  })

  return [...mergedPersistedComments, ...localOnlyComments].slice().sort(compareComments)
}