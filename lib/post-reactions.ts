import type { EmojiReactionSummary } from '@/lib/comment-emojis'
import { normalizeEmoji } from '@/lib/comment-emojis'
import {
  normalizeReactionIdentity,
  normalizeReactionValue,
  type ReactionSummary,
  type ReactionValue,
} from '@/lib/comment-reactions'
import { supabaseAdmin } from '@/lib/supabase-admin'

export type PostReactionSummary = ReactionSummary & EmojiReactionSummary

function createEmptyEmojiSummary(): EmojiReactionSummary {
  return {
    emoji_reactions: [],
    viewer_emojis: [],
  }
}

export async function getPostReactionSummary(postId: string, identity?: string | null): Promise<PostReactionSummary> {
  const normalizedIdentity = normalizeReactionIdentity(identity)
  const [{ data: post, error: postError }, { data: viewerReaction, error: viewerReactionError }, { data: emojiRows, error: emojiError }] = await Promise.all([
    supabaseAdmin
      .from('posts')
      .select('id, upvotes, downvotes')
      .eq('id', postId)
      .single(),
    normalizedIdentity
      ? supabaseAdmin
        .from('post_reactions')
        .select('value')
        .eq('post_id', postId)
        .eq('identity', normalizedIdentity)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabaseAdmin
      .from('post_emoji_reactions')
      .select('identity, emoji, updated_at')
      .eq('post_id', postId),
  ])

  if (postError || !post) {
    throw new Error('NOT_FOUND')
  }

  if (viewerReactionError) {
    throw new Error(viewerReactionError.message)
  }

  if (emojiError) {
    throw new Error(emojiError.message)
  }

  const emojiSummary = createEmptyEmojiSummary()
  const aggregateMap = new Map<string, { count: number; viewer: boolean; updatedAt: string }>()

  for (const row of emojiRows ?? []) {
    const emoji = normalizeEmoji(row.emoji)
    if (!emoji) {
      continue
    }

    const current = aggregateMap.get(emoji)
    const rowIdentity = normalizeReactionIdentity(row.identity)
    const updatedAt = typeof row.updated_at === 'string' ? row.updated_at : ''

    aggregateMap.set(emoji, {
      count: (current?.count ?? 0) + 1,
      viewer: current?.viewer ?? rowIdentity === normalizedIdentity,
      updatedAt: current?.updatedAt && current.updatedAt > updatedAt ? current.updatedAt : updatedAt,
    })

    if (rowIdentity === normalizedIdentity && !emojiSummary.viewer_emojis.includes(emoji)) {
      emojiSummary.viewer_emojis = [...emojiSummary.viewer_emojis, emoji]
    }
  }

  emojiSummary.emoji_reactions = [...aggregateMap.entries()]
    .map(([emoji, meta]) => ({ emoji, count: meta.count, viewer: meta.viewer, updatedAt: meta.updatedAt }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count
      }

      if (left.viewer !== right.viewer) {
        return Number(right.viewer) - Number(left.viewer)
      }

      return right.updatedAt.localeCompare(left.updatedAt)
    })
    .map((entry) => ({ emoji: entry.emoji, count: entry.count, viewer: entry.viewer }))

  emojiSummary.viewer_emojis = [...emojiSummary.viewer_emojis].sort((left, right) => left.localeCompare(right))

  return {
    upvotes: typeof post.upvotes === 'number' ? post.upvotes : 0,
    downvotes: typeof post.downvotes === 'number' ? post.downvotes : 0,
    viewer_reaction: normalizeReactionValue(viewerReaction?.value),
    ...emojiSummary,
  }
}

export async function applyPostReaction(postId: string, identity: string, reaction: ReactionValue): Promise<ReactionSummary> {
  const normalizedIdentity = normalizeReactionIdentity(identity)
  if (!normalizedIdentity) {
    throw new Error('MISSING_IDENTITY')
  }

  const { data: post, error: postError } = await supabaseAdmin
    .from('posts')
    .select('id')
    .eq('id', postId)
    .single()

  if (postError || !post) {
    throw new Error('NOT_FOUND')
  }

  const { data: existingReaction, error: reactionFetchError } = await supabaseAdmin
    .from('post_reactions')
    .select('id, value')
    .eq('post_id', postId)
    .eq('identity', normalizedIdentity)
    .maybeSingle()

  if (reactionFetchError) {
    throw new Error(reactionFetchError.message)
  }

  const currentReaction = normalizeReactionValue(existingReaction?.value)

  if (reaction === 0) {
    if (existingReaction?.id) {
      const { error } = await supabaseAdmin.from('post_reactions').delete().eq('id', existingReaction.id)
      if (error) {
        throw new Error(error.message)
      }
    }
  } else if (existingReaction?.id) {
    if (currentReaction !== reaction) {
      const { error } = await supabaseAdmin
        .from('post_reactions')
        .update({ value: reaction })
        .eq('id', existingReaction.id)

      if (error) {
        throw new Error(error.message)
      }
    }
  } else {
    const { error } = await supabaseAdmin.from('post_reactions').insert({
      post_id: postId,
      identity: normalizedIdentity,
      value: reaction,
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  const { data: reactions, error: aggregateError } = await supabaseAdmin
    .from('post_reactions')
    .select('value')
    .eq('post_id', postId)

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
    .from('posts')
    .update({ upvotes, downvotes })
    .eq('id', postId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return {
    upvotes,
    downvotes,
    viewer_reaction: reaction,
  }
}

export async function applyPostEmojiReaction(postId: string, identity: string, emoji: string | null) {
  const normalizedIdentity = normalizeReactionIdentity(identity)
  if (!normalizedIdentity) {
    throw new Error('MISSING_IDENTITY')
  }

  const normalizedEmoji = normalizeEmoji(emoji)
  if (!normalizedEmoji) {
    throw new Error('INVALID_EMOJI')
  }

  const { data: post, error: postError } = await supabaseAdmin
    .from('posts')
    .select('id')
    .eq('id', postId)
    .single()

  if (postError || !post) {
    throw new Error('NOT_FOUND')
  }

  const { data: existingReaction, error: existingReactionError } = await supabaseAdmin
    .from('post_emoji_reactions')
    .select('id')
    .eq('post_id', postId)
    .eq('identity', normalizedIdentity)
    .eq('emoji', normalizedEmoji)
    .maybeSingle()

  if (existingReactionError) {
    throw new Error(existingReactionError.message)
  }

  if (existingReaction?.id) {
    const { error } = await supabaseAdmin.from('post_emoji_reactions').delete().eq('id', existingReaction.id)
    if (error) {
      throw new Error(error.message)
    }
  } else {
    const { error } = await supabaseAdmin.from('post_emoji_reactions').insert({
      post_id: postId,
      identity: normalizedIdentity,
      emoji: normalizedEmoji,
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  return getPostReactionSummary(postId, normalizedIdentity)
}