import { supabaseAdmin } from '@/lib/supabase-admin'

export type ReactionValue = -1 | 0 | 1

export interface ReactionSummary {
  upvotes: number
  downvotes: number
  viewer_reaction: ReactionValue
}

export interface ReactionTargetRecord {
  id: string
  upvotes: number | null
  downvotes: number | null
}

export function isReactionValue(value: unknown): value is Exclude<ReactionValue, 0> {
  return value === 1 || value === -1
}

export function normalizeReactionValue(value: unknown): ReactionValue {
  if (value === 1 || value === '1') return 1
  if (value === -1 || value === '-1') return -1
  return 0
}

export function normalizeReactionIdentity(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function getViewerReactionMap(commentIds: string[], identity?: string | null) {
  if (!identity || commentIds.length === 0) {
    return {} as Record<string, ReactionValue>
  }

  const { data, error } = await supabaseAdmin
    .from('comment_reactions')
    .select('comment_id, value')
    .eq('identity', identity)
    .in('comment_id', commentIds)

  if (error) {
    throw new Error(error.message)
  }

  return Object.fromEntries(
    (data ?? []).map((reaction) => [reaction.comment_id as string, normalizeReactionValue(reaction.value)]),
  ) as Record<string, ReactionValue>
}

export async function attachViewerReactions<T extends ReactionTargetRecord>(records: T[], identity?: string | null) {
  const viewerReactionMap = await getViewerReactionMap(records.map((record) => record.id), identity)

  return records.map((record) => ({
    ...record,
    upvotes: record.upvotes ?? 0,
    downvotes: record.downvotes ?? 0,
    viewer_reaction: viewerReactionMap[record.id] ?? 0,
  }))
}

export async function applyCommentReaction(commentId: string, identity: string, reaction: ReactionValue) {
  const normalizedIdentity = normalizeReactionIdentity(identity)
  if (!normalizedIdentity) {
    throw new Error('MISSING_IDENTITY')
  }

  const { data: comment, error: commentError } = await supabaseAdmin
    .from('comments')
    .select('id')
    .eq('id', commentId)
    .single()

  if (commentError || !comment) {
    throw new Error('NOT_FOUND')
  }

  const { data: existingReaction, error: reactionFetchError } = await supabaseAdmin
    .from('comment_reactions')
    .select('id, value')
    .eq('comment_id', commentId)
    .eq('identity', normalizedIdentity)
    .maybeSingle()

  if (reactionFetchError) {
    throw new Error(reactionFetchError.message)
  }

  const currentReaction = normalizeReactionValue(existingReaction?.value)

  if (reaction === 0) {
    if (existingReaction?.id) {
      const { error } = await supabaseAdmin.from('comment_reactions').delete().eq('id', existingReaction.id)
      if (error) {
        throw new Error(error.message)
      }
    }
  } else if (existingReaction?.id) {
    if (currentReaction !== reaction) {
      const { error } = await supabaseAdmin
        .from('comment_reactions')
        .update({ value: reaction })
        .eq('id', existingReaction.id)

      if (error) {
        throw new Error(error.message)
      }
    }
  } else {
    const { error } = await supabaseAdmin.from('comment_reactions').insert({
      comment_id: commentId,
      identity: normalizedIdentity,
      value: reaction,
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  const { data: reactions, error: aggregateError } = await supabaseAdmin
    .from('comment_reactions')
    .select('value')
    .eq('comment_id', commentId)

  if (aggregateError) {
    throw new Error(aggregateError.message)
  }

  let upvotes = 0
  let downvotes = 0

  for (const entry of reactions ?? []) {
    const value = normalizeReactionValue(entry.value)
    if (value === 1) {
      upvotes += 1
    } else if (value === -1) {
      downvotes += 1
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from('comments')
    .update({ upvotes, downvotes })
    .eq('id', commentId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return {
    upvotes,
    downvotes,
    viewer_reaction: reaction,
  } satisfies ReactionSummary
}