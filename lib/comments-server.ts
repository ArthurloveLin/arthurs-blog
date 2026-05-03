import { attachViewerEmojiReactions, getEmojiReactionSummaryMap } from '@/lib/comment-emojis'
import { getViewerReactionMap, normalizeReactionIdentity } from '@/lib/comment-reactions'
import { createCommentRecord, type Comment, type CommentViewerState } from '@/lib/comments'
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

function trimTrailingSlash(value: string | undefined) {
  return value?.replace(/\/+$/, '') ?? ''
}

function getCommentThreadUrl(targetType: string, targetId: string) {
  const workerBaseUrl = trimTrailingSlash(process.env.NEXT_PUBLIC_ENGAGEMENT_WORKER_URL)
  if (!workerBaseUrl) {
    return null
  }

  const url = new URL(workerBaseUrl)
  const basePath = url.pathname === '/' ? '' : trimTrailingSlash(url.pathname)
  url.pathname = `${basePath}/api/comments`
  url.searchParams.set('target_type', targetType)
  url.searchParams.set('target_id', targetId)

  return url.toString()
}

async function getCommentRows(targetType: string, targetId: string) {
  const { data, error } = await supabaseAdmin
    .from('comments')
    .select('id, author, content, created_at, updated_at, parent_id, upvotes, downvotes')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as CommentRow[]
}

export async function getPublicComments(targetType: string, targetId: string): Promise<Comment[]> {
  const rows = await getCommentRows(targetType, targetId)
  const withEmojiSummary = await attachViewerEmojiReactions(rows)

  return withEmojiSummary.map((comment) => createCommentRecord(comment))
}

export async function getCommentThread(targetType: string, targetId: string): Promise<Comment[]> {
  const workerUrl = getCommentThreadUrl(targetType, targetId)
  if (!workerUrl) {
    return getPublicComments(targetType, targetId)
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
    return getPublicComments(targetType, targetId)
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