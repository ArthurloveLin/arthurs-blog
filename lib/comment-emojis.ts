import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizeReactionIdentity } from '@/lib/comment-reactions'

export interface EmojiReactionEntry {
  emoji: string
  count: number
  viewer: boolean
}

export interface EmojiReactionSummary {
  emoji_reactions: EmojiReactionEntry[]
  viewer_emojis: string[]
}

export interface EmojiReactionTargetRecord {
  id: string
}

export function normalizeEmoji(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  if (!normalized || normalized.length > 24) {
    return null
  }

  return normalized
}

function createEmptySummary(): EmojiReactionSummary {
  return {
    emoji_reactions: [],
    viewer_emojis: [],
  }
}

export async function getViewerEmojiMap(commentIds: string[], identity?: string | null) {
  const normalizedIdentity = normalizeReactionIdentity(identity)
  if (!normalizedIdentity || commentIds.length === 0) {
    return {} as Record<string, string[]>
  }

  const { data, error } = await supabaseAdmin
    .from('comment_emoji_reactions')
    .select('comment_id, emoji')
    .eq('identity', normalizedIdentity)
    .in('comment_id', commentIds)

  if (error) {
    throw new Error(error.message)
  }

  const emojiMap = {} as Record<string, string[]>

  for (const row of data ?? []) {
    const commentId = row.comment_id as string
    const emoji = normalizeEmoji(row.emoji)
    if (!emoji) {
      continue
    }

    const current = emojiMap[commentId] ?? []
    if (!current.includes(emoji)) {
      emojiMap[commentId] = [...current, emoji].sort((left, right) => left.localeCompare(right))
    }
  }

  return emojiMap
}

export async function getEmojiReactionSummaryMap(commentIds: string[], identity?: string | null) {
  if (commentIds.length === 0) {
    return {} as Record<string, EmojiReactionSummary>
  }

  const normalizedIdentity = normalizeReactionIdentity(identity)
  const { data, error } = await supabaseAdmin
    .from('comment_emoji_reactions')
    .select('comment_id, identity, emoji, updated_at')
    .in('comment_id', commentIds)

  if (error) {
    throw new Error(error.message)
  }

  const summaryMap = Object.fromEntries(commentIds.map((id) => [id, createEmptySummary()])) as Record<string, EmojiReactionSummary>
  const aggregateMap = new Map<string, Map<string, { count: number; viewer: boolean; updatedAt: string }>>()

  for (const row of data ?? []) {
    const commentId = row.comment_id as string
    const emoji = normalizeEmoji(row.emoji)
    if (!emoji) {
      continue
    }

    const byEmoji = aggregateMap.get(commentId) ?? new Map<string, { count: number; viewer: boolean; updatedAt: string }>()
    const current = byEmoji.get(emoji)
    const rowIdentity = normalizeReactionIdentity(row.identity)
    const updatedAt = typeof row.updated_at === 'string' ? row.updated_at : ''

    byEmoji.set(emoji, {
      count: (current?.count ?? 0) + 1,
      viewer: current?.viewer ?? rowIdentity === normalizedIdentity,
      updatedAt: current?.updatedAt && current.updatedAt > updatedAt ? current.updatedAt : updatedAt,
    })

    aggregateMap.set(commentId, byEmoji)

    if (rowIdentity === normalizedIdentity && !summaryMap[commentId].viewer_emojis.includes(emoji)) {
      summaryMap[commentId].viewer_emojis = [...summaryMap[commentId].viewer_emojis, emoji]
    }
  }

  for (const [commentId, byEmoji] of aggregateMap.entries()) {
    summaryMap[commentId].emoji_reactions = [...byEmoji.entries()]
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
    summaryMap[commentId].viewer_emojis = [...summaryMap[commentId].viewer_emojis].sort((left, right) => left.localeCompare(right))
  }

  return summaryMap
}

export async function attachViewerEmojiReactions<T extends EmojiReactionTargetRecord>(records: T[], identity?: string | null) {
  const summaryMap = await getEmojiReactionSummaryMap(records.map((record) => record.id), identity)

  return records.map((record) => ({
    ...record,
    emoji_reactions: summaryMap[record.id]?.emoji_reactions ?? [],
    viewer_emojis: summaryMap[record.id]?.viewer_emojis ?? [],
  }))
}

export async function applyCommentEmojiReaction(commentId: string, identity: string, emoji: string | null) {
  const normalizedIdentity = normalizeReactionIdentity(identity)
  if (!normalizedIdentity) {
    throw new Error('MISSING_IDENTITY')
  }

  const normalizedEmoji = normalizeEmoji(emoji)
  if (!normalizedEmoji) {
    throw new Error('INVALID_EMOJI')
  }

  const { data: comment, error: commentError } = await supabaseAdmin
    .from('comments')
    .select('id')
    .eq('id', commentId)
    .single()

  if (commentError || !comment) {
    throw new Error('NOT_FOUND')
  }

  const { data: existingReaction, error: existingReactionError } = await supabaseAdmin
    .from('comment_emoji_reactions')
    .select('id')
    .eq('comment_id', commentId)
    .eq('identity', normalizedIdentity)
    .eq('emoji', normalizedEmoji)
    .maybeSingle()

  if (existingReactionError) {
    throw new Error(existingReactionError.message)
  }

  if (existingReaction?.id) {
    const { error } = await supabaseAdmin.from('comment_emoji_reactions').delete().eq('id', existingReaction.id)
    if (error) {
      throw new Error(error.message)
    }
  } else {
    const { error } = await supabaseAdmin.from('comment_emoji_reactions').insert({
      comment_id: commentId,
      identity: normalizedIdentity,
      emoji: normalizedEmoji,
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  const summaryMap = await getEmojiReactionSummaryMap([commentId], normalizedIdentity)
  return summaryMap[commentId] ?? createEmptySummary()
}