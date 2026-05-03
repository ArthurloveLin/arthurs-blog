import { attachViewerEmojiReactions, getEmojiReactionSummaryMap } from '@/lib/comment-emojis'
import { getViewerReactionMap, normalizeReactionIdentity } from '@/lib/comment-reactions'
import { createCommentRecord, type Comment, type CommentViewerState } from '@/lib/comments'
import { getCommentWorkerUrl } from '@/lib/comment-worker'
import { supabaseAdmin } from '@/lib/supabase-admin'

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

interface CommentThreadRequestOptions {
  archived?: boolean
}

function getCommentThreadUrl(targetType: string, targetId: string, options: CommentThreadRequestOptions = {}) {
  const searchParams = new URLSearchParams()
  searchParams.set('target_type', targetType)
  searchParams.set('target_id', targetId)

  if (typeof options.archived === 'boolean') {
    searchParams.set('archived', options.archived ? '1' : '0')
  }

  return getCommentWorkerUrl('/api/comments', searchParams)
}

async function getCommentRows(targetType: string, targetId: string, options: CommentThreadRequestOptions = {}) {
  let query = supabaseAdmin
    .from('comments')
    .select('id, author, content, created_at, updated_at, parent_id, upvotes, downvotes')
    .eq('target_type', targetType)
    .eq('target_id', targetId)

  if (typeof options.archived === 'boolean') {
    query = query.eq('archived', options.archived)
  }

  const { data, error } = await query.order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as CommentRow[]
}

export async function getPublicComments(
  targetType: string,
  targetId: string,
  options: CommentThreadRequestOptions = {},
): Promise<Comment[]> {
  const rows = await getCommentRows(targetType, targetId, options)
  const withEmojiSummary = await attachViewerEmojiReactions(rows)

  return withEmojiSummary.map((comment) => createCommentRecord(comment))
}

export async function getCommentThread(
  targetType: string,
  targetId: string,
  options: CommentThreadRequestOptions = {},
): Promise<Comment[]> {
  const workerUrl = getCommentThreadUrl(targetType, targetId, options)
  if (!workerUrl) {
    return getPublicComments(targetType, targetId, options)
  }

  try {
    const response = await fetch(workerUrl, {
      headers: {
        Accept: 'application/json',
      },
      next: {
        revalidate: 30,
      },
    })

    if (!response.ok) {
      throw new Error(`COMMENT_THREAD_${response.status}`)
    }

    const payload = await response.json().catch(() => null)
    if (!Array.isArray(payload)) {
      throw new Error('INVALID_COMMENT_THREAD_PAYLOAD')
    }

    return payload.map((entry) => createCommentRecord(entry as Comment))
  } catch {
    return getPublicComments(targetType, targetId, options)
  }
}

export async function getCommentViewerState(targetType: string, targetId: string, identity: string): Promise<CommentViewerState[]> {
  const normalizedIdentity = normalizeReactionIdentity(identity)
  if (!normalizedIdentity) {
    return []
  }

  const rows = await getCommentRows(targetType, targetId)
  const commentIds = rows.map((comment) => comment.id)

  if (commentIds.length === 0) {
    return []
  }

  const [viewerReactionMap, emojiSummaryMap] = await Promise.all([
    getViewerReactionMap(commentIds, normalizedIdentity),
    getEmojiReactionSummaryMap(commentIds, normalizedIdentity),
  ])

  return commentIds.map((id) => ({
    id,
    viewer_reaction: viewerReactionMap[id] ?? 0,
    viewer_emojis: emojiSummaryMap[id]?.viewer_emojis ?? [],
  }))
}