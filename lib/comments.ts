import { attachViewerEmojiReactions, getViewerEmojiMap, type EmojiReactionEntry } from '@/lib/comment-emojis'
import { getViewerReactionMap, normalizeReactionIdentity, type ReactionValue } from '@/lib/comment-reactions'
import { supabaseAdmin } from '@/lib/supabase-admin'

const COMMENT_SELECT_FIELDS = 'id, author, content, created_at, updated_at, parent_id, upvotes, downvotes'

type CommentRow = {
  id: string
  author: string
  content: string
  created_at: string
  updated_at: string | null
  parent_id: string | null
  upvotes: number | null
  downvotes: number | null
}

export interface PublicCommentThreadItem {
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
}

export interface CommentViewerStateItem {
  id: string
  viewer_reaction: ReactionValue
  viewer_emojis: string[]
}

async function getCommentRows(targetType: string, targetId: string) {
  const { data, error } = await supabaseAdmin
    .from('comments')
    .select(COMMENT_SELECT_FIELDS)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((comment) => ({
    ...(comment as CommentRow),
    upvotes: comment.upvotes ?? 0,
    downvotes: comment.downvotes ?? 0,
  }))
}

async function getCommentIds(targetType: string, targetId: string) {
  const { data, error } = await supabaseAdmin
    .from('comments')
    .select('id')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((comment) => comment.id as string)
}

export async function getPublicCommentThread(targetType: string, targetId: string) {
  const rows = await getCommentRows(targetType, targetId)

  return attachViewerEmojiReactions(
    rows.map((comment) => ({
      ...comment,
      viewer_reaction: 0 as ReactionValue,
    })),
  ) as Promise<PublicCommentThreadItem[]>
}

export async function getCommentViewerState(targetType: string, targetId: string, identity?: string | null) {
  const normalizedIdentity = normalizeReactionIdentity(identity)
  if (!normalizedIdentity) {
    return [] as CommentViewerStateItem[]
  }

  const commentIds = await getCommentIds(targetType, targetId)
  if (commentIds.length === 0) {
    return [] as CommentViewerStateItem[]
  }

  const [viewerReactionMap, viewerEmojiMap] = await Promise.all([
    getViewerReactionMap(commentIds, normalizedIdentity),
    getViewerEmojiMap(commentIds, normalizedIdentity),
  ])

  return commentIds.map((id) => ({
    id,
    viewer_reaction: viewerReactionMap[id] ?? 0,
    viewer_emojis: viewerEmojiMap[id] ?? [],
  })) satisfies CommentViewerStateItem[]
}

export function mergePublicCommentThreadWithViewerState(
  comments: PublicCommentThreadItem[],
  viewerState: CommentViewerStateItem[],
) {
  const viewerStateMap = new Map(viewerState.map((entry) => [entry.id, entry]))

  return comments.map((comment) => {
    const nextViewerState = viewerStateMap.get(comment.id)
    const viewerEmojis = nextViewerState?.viewer_emojis ?? []
    const viewerEmojiSet = new Set(viewerEmojis)

    return {
      ...comment,
      viewer_reaction: nextViewerState?.viewer_reaction ?? 0,
      viewer_emojis: viewerEmojis,
      emoji_reactions: comment.emoji_reactions.map((entry) => ({
        ...entry,
        viewer: viewerEmojiSet.has(entry.emoji),
      })),
    }
  })
}