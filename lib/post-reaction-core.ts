export type PostReactionValue = -1 | 0 | 1

export interface PostReactionAggregate {
  upvotes: number
  downvotes: number
}

export interface PostReactionSummaryFields extends PostReactionAggregate {
  viewer_reaction: PostReactionValue
}

function normalizeReactionCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : 0
}

export function normalizePostReactionIdentity(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizePostReactionValue(value: unknown): PostReactionValue {
  if (value === 1 || value === '1') {
    return 1
  }

  if (value === -1 || value === '-1') {
    return -1
  }

  return 0
}

export function createPostReactionSummaryFields(
  upvotes: unknown = 0,
  downvotes: unknown = 0,
  viewerReaction: unknown = 0,
): PostReactionSummaryFields {
  return {
    upvotes: normalizeReactionCount(upvotes),
    downvotes: normalizeReactionCount(downvotes),
    viewer_reaction: normalizePostReactionValue(viewerReaction),
  }
}

export function applyPostReactionTransition(
  summary: PostReactionAggregate,
  currentReaction: PostReactionValue,
  nextReaction: PostReactionValue,
): PostReactionSummaryFields {
  let upvotes = normalizeReactionCount(summary.upvotes)
  let downvotes = normalizeReactionCount(summary.downvotes)

  if (currentReaction === 1) {
    upvotes = Math.max(0, upvotes - 1)
  } else if (currentReaction === -1) {
    downvotes = Math.max(0, downvotes - 1)
  }

  if (nextReaction === 1) {
    upvotes += 1
  } else if (nextReaction === -1) {
    downvotes += 1
  }

  return {
    upvotes,
    downvotes,
    viewer_reaction: nextReaction,
  }
}

export function summarizePostReactionValues(values: Iterable<unknown>): PostReactionAggregate {
  let upvotes = 0
  let downvotes = 0

  for (const value of values) {
    const normalized = normalizePostReactionValue(value)
    if (normalized === 1) {
      upvotes += 1
    } else if (normalized === -1) {
      downvotes += 1
    }
  }

  return { upvotes, downvotes }
}