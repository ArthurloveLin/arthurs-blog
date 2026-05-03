import { DurableObject } from 'cloudflare:workers'

const UPSTREAM_TIMEOUT_MS = 15_000
const DEFAULT_COMMENT_MAX_LENGTH = 500
const DEFAULT_COMMENT_URL_LIMIT = 2
const DEFAULT_COMMENT_RATE_LIMIT_MAX_REQUESTS = 5
const DEFAULT_COMMENT_RATE_LIMIT_WINDOW_SECONDS = 60
const DEFAULT_REACTION_FLUSH_INTERVAL_SECONDS = 300
const DEFAULT_REACTION_FLUSH_RETRY_SECONDS = 60
const COMMENT_THREAD_CACHE_TTL_SECONDS = 60
const DEFAULT_BLOCKED_TERMS = ['博彩', '裸聊', '刷单', '代刷', '纸飞机', 'telegram', '免费兼职', '加v', '加微']
const COMMENT_QUEUE_DO_NAME = 'global'
const COMMENT_QUEUE_RECORD_PREFIX = 'comment-queue:record:'
const COMMENT_QUEUE_THREAD_PREFIX = 'comment-queue:thread:'
const COMMENT_QUEUE_THREAD_LOOKUP_PREFIX = 'comment-queue:lookup:'
const POST_REACTION_POST_ID_KEY = 'post-reaction:post-id'
const POST_REACTION_META_KEY = 'post-reaction:meta'
const POST_REACTION_VALUE_PREFIX = 'post-reaction:value:'
const POST_REACTION_PENDING_PREFIX = 'post-reaction:pending:'

type EngagementEnv = Cloudflare.Env & {
  COMMENT_QUEUE_DO: DurableObjectNamespace
  COMMENT_RATE_LIMITER: DurableObjectNamespace
}

type CommentRateLimitCounter = {
  count: number
  resetAt: number
}

type CommentRateLimitResult = {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
  retryAfterSeconds: number
}

type OriginPostEngagementSummary = Record<string, unknown> & Partial<PostReactionSummaryFields>

type PostReactionMutation = {
  identity: string
  reaction: PostReactionValue
}

type PostReactionSeed = {
  upvotes: unknown
  downvotes: unknown
  viewer_reaction: unknown
  hasViewerReaction: boolean
}

type PostReactionRpcResult = Record<string, unknown> & Partial<PostReactionAggregate>

type CommentPayload = {
  target_type: unknown
  target_id: unknown
  author: unknown
  content: unknown
  parent_id?: unknown
}

type CommentQueuedRecord = {
  id: string
  target_type: string
  target_id: string
  author: string
  content: string
  parent_id: string | null
  created_at: string
  updated_at: string | null
}

type CommentThreadTarget = {
  targetType: string
  targetId: string
}

type CommentPublicRecord = {
  id: string
  author: string
  content: string
  created_at: string
  updated_at: string | null
  parent_id: string | null
  upvotes: number
  downvotes: number
  viewer_reaction: 0
  emoji_reactions: Array<{ emoji: string; count: number; viewer: boolean }>
  viewer_emojis: string[]
  sync_state: 'pending' | 'persisted'
}

type CommentMutationResult = {
  comment: CommentPublicRecord
  targetType: string
  targetId: string
}

type CommentDeletionResult = CommentThreadTarget

type CommentQueueFlushResult = {
  flushedCount: number
  threadTargets: CommentThreadTarget[]
}

type CommentBatchRpcResult = {
  inserted_count?: unknown
}

type PostReactionValue = -1 | 0 | 1

type PostReactionAggregate = {
  upvotes: number
  downvotes: number
}

type PostReactionSummaryFields = PostReactionAggregate & {
  viewer_reaction: PostReactionValue
}

function normalizePostReactionIdentity(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePostReactionValue(value: unknown): PostReactionValue {
  if (value === 1 || value === '1') {
    return 1
  }

  if (value === -1 || value === '-1') {
    return -1
  }

  return 0
}

function normalizePostReactionCount(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.trunc(value))
}

function createPostReactionSummaryFields(
  upvotes: unknown,
  downvotes: unknown,
  viewerReaction: unknown,
): PostReactionSummaryFields {
  return {
    upvotes: normalizePostReactionCount(upvotes),
    downvotes: normalizePostReactionCount(downvotes),
    viewer_reaction: normalizePostReactionValue(viewerReaction),
  }
}

function applyPostReactionTransition(
  aggregate: PostReactionAggregate,
  currentReaction: PostReactionValue,
  nextReaction: PostReactionValue,
): PostReactionSummaryFields {
  let upvotes = aggregate.upvotes
  let downvotes = aggregate.downvotes

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

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = corsHeaders(init.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  })
}

function corsHeaders(headers?: HeadersInit) {
  const nextHeaders = new Headers(headers)
  if (!nextHeaders.has('Access-Control-Allow-Origin')) {
    nextHeaders.set('Access-Control-Allow-Origin', '*')
  }
  if (!nextHeaders.has('Access-Control-Allow-Methods')) {
    nextHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  }
  if (!nextHeaders.has('Access-Control-Allow-Headers')) {
    nextHeaders.set('Access-Control-Allow-Headers', 'Content-Type')
  }
  return nextHeaders
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function normalizePath(path: string) {
  return path.startsWith('/') ? path : `/${path}`
}

function buildOriginUrl(baseUrl: string, path: string, search: string) {
  const url = new URL(baseUrl)
  const basePath = url.pathname === '/' ? '' : trimTrailingSlash(url.pathname)
  url.pathname = `${basePath}${normalizePath(path)}`
  url.search = search
  return url.toString()
}

function getRequestPath(request: Request) {
  return new URL(request.url).pathname
}

function normalizeCommentId(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeCommentIdentities(body: Record<string, unknown> | null) {
  const values = Array.isArray(body?.identities)
    ? body.identities
    : [body?.identity]

  return values
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function normalizeNullableCommentId(value: unknown) {
  const nextValue = normalizeCommentId(value)
  return nextValue || null
}

function encodeStorageKeyPart(value: string) {
  return encodeURIComponent(value)
}

function getCommentQueueRecordKey(commentId: string) {
  return `${COMMENT_QUEUE_RECORD_PREFIX}${encodeStorageKeyPart(commentId)}`
}

function getCommentQueueThreadPrefix(targetType: string, targetId: string) {
  return `${COMMENT_QUEUE_THREAD_PREFIX}${encodeStorageKeyPart(targetType)}:${encodeStorageKeyPart(targetId)}:`
}

function getCommentQueueThreadIndexKey(comment: CommentQueuedRecord) {
  return `${getCommentQueueThreadPrefix(comment.target_type, comment.target_id)}${comment.created_at}:${encodeStorageKeyPart(comment.id)}`
}

function getCommentQueueThreadLookupKey(commentId: string) {
  return `${COMMENT_QUEUE_THREAD_LOOKUP_PREFIX}${encodeStorageKeyPart(commentId)}`
}

function compareComments(left: Pick<CommentPublicRecord, 'created_at' | 'id'>, right: Pick<CommentPublicRecord, 'created_at' | 'id'>) {
  const timeDifference = new Date(left.created_at).getTime() - new Date(right.created_at).getTime()

  if (timeDifference !== 0) {
    return timeDifference
  }

  return left.id.localeCompare(right.id)
}

function createPublicCommentRecord(comment: CommentQueuedRecord, syncState: 'pending' | 'persisted' = 'pending'): CommentPublicRecord {
  return {
    id: comment.id,
    author: comment.author,
    content: comment.content,
    created_at: comment.created_at,
    updated_at: comment.updated_at,
    parent_id: comment.parent_id,
    upvotes: 0,
    downvotes: 0,
    viewer_reaction: 0,
    emoji_reactions: [],
    viewer_emojis: [],
    sync_state: syncState,
  }
}

function normalizeCommentEmojiReactions(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as CommentPublicRecord['emoji_reactions']
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return []
    }

    const payload = entry as Record<string, unknown>
    const emoji = typeof payload.emoji === 'string' ? payload.emoji : ''
    if (!emoji) {
      return []
    }

    return [{
      emoji,
      count: typeof payload.count === 'number' && Number.isFinite(payload.count) ? payload.count : 0,
      viewer: Boolean(payload.viewer),
    }]
  })
}

function normalizeCommentPublicRecord(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const payload = value as Record<string, unknown>
  const id = normalizeCommentId(payload.id)
  const author = typeof payload.author === 'string' ? payload.author : ''
  const content = typeof payload.content === 'string' ? payload.content : ''
  const createdAt = typeof payload.created_at === 'string' ? payload.created_at : ''

  if (!id || !author || !content || !createdAt) {
    return null
  }

  return {
    id,
    author,
    content,
    created_at: createdAt,
    updated_at: typeof payload.updated_at === 'string' ? payload.updated_at : null,
    parent_id: normalizeNullableCommentId(payload.parent_id),
    upvotes: typeof payload.upvotes === 'number' && Number.isFinite(payload.upvotes) ? payload.upvotes : 0,
    downvotes: typeof payload.downvotes === 'number' && Number.isFinite(payload.downvotes) ? payload.downvotes : 0,
    viewer_reaction: 0,
    emoji_reactions: normalizeCommentEmojiReactions(payload.emoji_reactions),
    viewer_emojis: [],
    sync_state: payload.sync_state === 'pending' ? 'pending' : 'persisted',
  } satisfies CommentPublicRecord
}

function normalizeCommentThreadPayload(value: unknown) {
  if (!Array.isArray(value)) {
    return null
  }

  return value.flatMap((entry) => {
    const comment = normalizeCommentPublicRecord(entry)
    return comment ? [comment] : []
  })
}

function mergeCommentThreads(originComments: CommentPublicRecord[], queuedComments: CommentPublicRecord[]) {
  const mergedComments = new Map(originComments.map((comment) => [comment.id, comment]))

  for (const queuedComment of queuedComments) {
    if (!mergedComments.has(queuedComment.id)) {
      mergedComments.set(queuedComment.id, queuedComment)
    }
  }

  return [...mergedComments.values()].sort(compareComments)
}

function normalizeQueuedCommentRecord(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const payload = value as Record<string, unknown>
  const id = normalizeCommentId(payload.id)
  const targetType = typeof payload.target_type === 'string' ? payload.target_type.trim() : ''
  const targetId = normalizeCommentId(payload.target_id)
  const author = typeof payload.author === 'string' ? payload.author.trim() : ''
  const content = typeof payload.content === 'string' ? payload.content : ''
  const createdAt = typeof payload.created_at === 'string' ? payload.created_at : ''

  if (!id || !targetType || !targetId || !author || !content || !createdAt) {
    return null
  }

  return {
    id,
    target_type: targetType,
    target_id: targetId,
    author,
    content,
    parent_id: normalizeNullableCommentId(payload.parent_id),
    created_at: createdAt,
    updated_at: typeof payload.updated_at === 'string' ? payload.updated_at : null,
  } satisfies CommentQueuedRecord
}

function normalizeCommentPayload(body: unknown) {
  if (!body || typeof body !== 'object') {
    return null
  }

  const payload = body as CommentPayload
  const targetType = typeof payload.target_type === 'string' ? payload.target_type.trim() : ''
  const targetId = normalizeCommentId(payload.target_id)
  const author = typeof payload.author === 'string' ? payload.author.trim() : ''
  const content = typeof payload.content === 'string' ? payload.content.trim() : ''

  if (!targetType || !targetId || !author || !content) {
    return null
  }

  return {
    target_type: targetType,
    target_id: targetId,
    author,
    content,
    parent_id: normalizeNullableCommentId(payload.parent_id),
  }
}

async function parseJsonResponse<T>(response: Response) {
  return response.clone().json().catch(() => null) as Promise<T | null>
}

function getBlockedTerms(env: Cloudflare.Env) {
  return (typeof env.COMMENT_BLOCKED_TERMS === 'string' ? env.COMMENT_BLOCKED_TERMS : '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function countUrls(content: string) {
  return (content.match(/(?:https?:\/\/|www\.)/gi) ?? []).length
}

function getCommentMaxLength(env: Cloudflare.Env) {
  return typeof env.COMMENT_MAX_LENGTH === 'number' && Number.isFinite(env.COMMENT_MAX_LENGTH)
    ? env.COMMENT_MAX_LENGTH
    : DEFAULT_COMMENT_MAX_LENGTH
}

function getCommentUrlLimit(env: Cloudflare.Env) {
  return typeof env.COMMENT_URL_LIMIT === 'number' && Number.isFinite(env.COMMENT_URL_LIMIT)
    ? env.COMMENT_URL_LIMIT
    : DEFAULT_COMMENT_URL_LIMIT
}

function getCommentRateLimitMaxRequests(env: Cloudflare.Env) {
  return typeof env.COMMENT_RATE_LIMIT_MAX_REQUESTS === 'number' && Number.isFinite(env.COMMENT_RATE_LIMIT_MAX_REQUESTS)
    ? env.COMMENT_RATE_LIMIT_MAX_REQUESTS
    : DEFAULT_COMMENT_RATE_LIMIT_MAX_REQUESTS
}

function getCommentRateLimitWindowMs(env: Cloudflare.Env) {
  const seconds = typeof env.COMMENT_RATE_LIMIT_WINDOW_SECONDS === 'number' && Number.isFinite(env.COMMENT_RATE_LIMIT_WINDOW_SECONDS)
    ? env.COMMENT_RATE_LIMIT_WINDOW_SECONDS
    : DEFAULT_COMMENT_RATE_LIMIT_WINDOW_SECONDS

  return Math.max(1, seconds) * 1_000
}

function getReactionFlushIntervalMs(env: Cloudflare.Env) {
  const seconds = typeof env.REACTION_FLUSH_INTERVAL_SECONDS === 'number' && Number.isFinite(env.REACTION_FLUSH_INTERVAL_SECONDS)
    ? env.REACTION_FLUSH_INTERVAL_SECONDS
    : DEFAULT_REACTION_FLUSH_INTERVAL_SECONDS

  return Math.max(1, seconds) * 1_000
}

function getReactionFlushRetryMs(env: Cloudflare.Env) {
  const seconds = typeof env.REACTION_FLUSH_RETRY_SECONDS === 'number' && Number.isFinite(env.REACTION_FLUSH_RETRY_SECONDS)
    ? env.REACTION_FLUSH_RETRY_SECONDS
    : DEFAULT_REACTION_FLUSH_RETRY_SECONDS

  return Math.max(1, seconds) * 1_000
}

function getSupabaseUrl(env: Cloudflare.Env) {
  const supabaseUrl = typeof env.SUPABASE_URL === 'string' ? trimTrailingSlash(env.SUPABASE_URL) : ''
  if (!supabaseUrl) {
    throw new Error('MISSING_SUPABASE_URL')
  }

  return supabaseUrl
}

function getSupabaseServiceRoleKey(env: Cloudflare.Env) {
  const secret = (env as Cloudflare.Env & { SUPABASE_SERVICE_ROLE_KEY?: string }).SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!secret) {
    throw new Error('MISSING_SUPABASE_SERVICE_ROLE_KEY')
  }

  return secret
}

function normalizePostId(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function looksLikeSpam(content: string, env: Cloudflare.Env) {
  const blockedTerms = getBlockedTerms(env)
  const normalizedContent = content.toLowerCase()
  const blockedTerm = (blockedTerms.length > 0 ? blockedTerms : DEFAULT_BLOCKED_TERMS)
    .find((term) => normalizedContent.includes(term.toLowerCase()))

  if (blockedTerm) {
    return `评论内容包含被拦截的词：${blockedTerm}`
  }

  if (countUrls(content) > getCommentUrlLimit(env)) {
    return '评论里包含过多链接。'
  }

  if (/(.)\1{14,}/u.test(content)) {
    return '评论内容重复过多。'
  }

  return null
}

function validateCommentPayload(body: unknown, env: Cloudflare.Env) {
  if (!body || typeof body !== 'object') {
    return '评论请求体无效。'
  }

  const payload = body as CommentPayload
  const author = typeof payload.author === 'string' ? payload.author.trim() : ''
  const content = typeof payload.content === 'string' ? payload.content.trim() : ''
  const targetType = typeof payload.target_type === 'string' ? payload.target_type.trim() : ''
  const targetId = typeof payload.target_id === 'string' ? payload.target_id.trim() : ''

  if (!author || !content || !targetType || !targetId) {
    return '评论缺少必要字段。'
  }

  if (content.length > getCommentMaxLength(env)) {
    return `评论不能超过 ${getCommentMaxLength(env)} 字。`
  }

  return looksLikeSpam(content, env)
}

function log(level: 'log' | 'warn' | 'error', message: string, fields: Record<string, unknown> = {}) {
  console[level](JSON.stringify({ message, ...fields }))
}

function getErrorMessage(body: unknown, fallback: string) {
  if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
    return body.error
  }

  if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
    return body.message
  }

  return fallback
}

function getPostReactionValueStorageKey(identity: string) {
  return `${POST_REACTION_VALUE_PREFIX}${encodeURIComponent(identity)}`
}

function getPostReactionPendingStorageKey(identity: string) {
  return `${POST_REACTION_PENDING_PREFIX}${encodeURIComponent(identity)}`
}

function decodePostReactionIdentity(key: string, prefix: string) {
  return decodeURIComponent(key.slice(prefix.length))
}

function getPostReactionSeed(seed: unknown): PostReactionSeed | null {
  if (!seed || typeof seed !== 'object') {
    return null
  }

  const payload = seed as Record<string, unknown>

  return {
    upvotes: payload.upvotes,
    downvotes: payload.downvotes,
    viewer_reaction: payload.viewer_reaction,
    hasViewerReaction: Object.prototype.hasOwnProperty.call(payload, 'viewer_reaction'),
  }
}

function extractClientIp(request: Request) {
  const directIp = request.headers.get('cf-connecting-ip')?.trim()
  if (directIp) {
    return directIp
  }

  const forwardedFor = request.headers.get('x-forwarded-for')
    ?.split(',')
    .map((entry) => entry.trim())
    .find(Boolean)

  return forwardedFor ?? null
}

async function enforceCommentRateLimit(request: Request, env: Cloudflare.Env) {
  const clientIp = extractClientIp(request)
  if (!clientIp) {
    return null
  }

  const response = await env.COMMENT_RATE_LIMITER.getByName(clientIp).fetch('https://comment-rate-limit/check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      maxRequests: getCommentRateLimitMaxRequests(env),
      windowMs: getCommentRateLimitWindowMs(env),
    }),
  })

  if (!response.ok) {
    throw new Error(`COMMENT_RATE_LIMIT_FAILED_${response.status}`)
  }

  return response.json<CommentRateLimitResult>()
}

function getCommentThreadCacheKey(requestUrl: string, targetType: string, targetId: string) {
  return getCommentThreadVariantCacheKey(requestUrl, targetType, targetId, null)
}

function getCommentThreadVariantCacheKey(
  requestUrl: string,
  targetType: string,
  targetId: string,
  archived: boolean | null,
) {
  const cacheUrl = new URL(requestUrl)
  cacheUrl.pathname = '/api/comments'
  cacheUrl.search = ''
  cacheUrl.searchParams.set('target_type', targetType)
  cacheUrl.searchParams.set('target_id', targetId)

  if (archived !== null) {
    cacheUrl.searchParams.set('archived', archived ? '1' : '0')
  }

  return new Request(cacheUrl.toString(), { method: 'GET' })
}

function normalizeArchivedCommentThreadQuery(value: string | null) {
  if (value === '1') {
    return true
  }

  if (value === '0') {
    return false
  }

  return null
}

function getCommentThreadCacheKeys(requestUrl: string, targetType: string, targetId: string) {
  return [
    {
      variant: 'default',
      cacheKey: getCommentThreadVariantCacheKey(requestUrl, targetType, targetId, null),
    },
    {
      variant: 'active',
      cacheKey: getCommentThreadVariantCacheKey(requestUrl, targetType, targetId, false),
    },
  ]
}

function invalidateCommentThreadCache(
  ctx: ExecutionContext,
  requestUrl: string,
  targetType: string,
  targetId: string,
  reason: string,
) {
  ctx.waitUntil(
    Promise.all(
      getCommentThreadCacheKeys(requestUrl, targetType, targetId).map(({ variant, cacheKey }) =>
        caches.default.delete(cacheKey).then((deleted) => {
          log('log', 'comment thread cache invalidated', {
            targetType,
            targetId,
            reason,
            variant,
            deleted,
          })
        }),
      ),
    ),
  )
}

function getCommentThreadCacheKeyFromUrl(url: URL) {
  const targetType = url.searchParams.get('target_type')?.trim()
  const targetId = url.searchParams.get('target_id')?.trim()
  const archived = normalizeArchivedCommentThreadQuery(url.searchParams.get('archived'))

  if (!targetType || !targetId) {
    return null
  }

  return {
    targetType,
    targetId,
    archived,
    cacheKey: getCommentThreadVariantCacheKey(url.toString(), targetType, targetId, archived),
  }
}

function withCommentThreadCacheHeaders(response: Response) {
  const headers = corsHeaders(response.headers)
  headers.set('Cache-Control', `public, s-maxage=${COMMENT_THREAD_CACHE_TTL_SECONDS}`)

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

async function proxyRequest(request: Request, env: Cloudflare.Env, path: string, init?: RequestInit) {
  const url = new URL(request.url)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

  try {
    const response = await fetch(buildOriginUrl(env.ORIGIN_BASE_URL, path, url.search), {
      method: init?.method ?? request.method,
      headers: init?.headers ?? request.headers,
      body: init?.body,
      redirect: 'manual',
      signal: controller.signal,
    })

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: corsHeaders(response.headers),
    })
  } catch (error) {
    log('error', 'origin request failed', {
      path,
      method: init?.method ?? request.method,
      error: error instanceof Error ? error.message : String(error),
    })
    return jsonResponse({ error: '上游请求失败。' }, { status: 502 })
  } finally {
    clearTimeout(timeoutId)
  }
}

async function fetchOriginPostEngagementSummary(env: Cloudflare.Env, postId: string, identity?: string) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  const searchParams = new URLSearchParams()

  if (identity) {
    searchParams.set('identity', identity)
  }

  try {
    const response = await fetch(
      buildOriginUrl(env.ORIGIN_BASE_URL, `/api/posts/${postId}/engagement`, searchParams.toString() ? `?${searchParams.toString()}` : ''),
      {
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      },
    )

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      const message = getErrorMessage(payload, `ORIGIN_ENGAGEMENT_${response.status}`)
      if (response.status === 404 || message === 'Post not found' || message === 'NOT_FOUND') {
        throw new Error('NOT_FOUND')
      }

      throw new Error(message)
    }

    if (!payload || typeof payload !== 'object') {
      throw new Error('INVALID_ORIGIN_ENGAGEMENT_RESPONSE')
    }

    return payload as OriginPostEngagementSummary
  } finally {
    clearTimeout(timeoutId)
  }
}

async function callSupabasePostReactionRpc(env: Cloudflare.Env, postId: string, mutations: PostReactionMutation[]) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  const serviceRoleKey = getSupabaseServiceRoleKey(env)

  try {
    const response = await fetch(`${getSupabaseUrl(env)}/rest/v1/rpc/apply_post_reaction_batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        target_post_id: postId,
        mutations,
      }),
      signal: controller.signal,
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(getErrorMessage(payload, `SUPABASE_RPC_${response.status}`))
    }

    return createPostReactionSummaryFields(
      (payload as PostReactionRpcResult | null)?.upvotes,
      (payload as PostReactionRpcResult | null)?.downvotes,
      0,
    )
  } finally {
    clearTimeout(timeoutId)
  }
}

async function callSupabaseCommentBatchRpc(env: EngagementEnv, comments: CommentQueuedRecord[]) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  const serviceRoleKey = getSupabaseServiceRoleKey(env)

  try {
    const response = await fetch(`${getSupabaseUrl(env)}/rest/v1/rpc/apply_comment_batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        comments: comments.map((comment) => ({
          id: comment.id,
          target_type: comment.target_type,
          target_id: comment.target_id,
          author: comment.author,
          content: comment.content,
          parent_id: comment.parent_id,
          created_at: comment.created_at,
          updated_at: comment.updated_at,
        })),
      }),
      signal: controller.signal,
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(getErrorMessage(payload, `SUPABASE_COMMENT_RPC_${response.status}`))
    }

    if (typeof payload === 'number' && Number.isFinite(payload)) {
      return payload
    }

    if (Array.isArray(payload)) {
      const [firstEntry] = payload as CommentBatchRpcResult[]
      if (typeof firstEntry?.inserted_count === 'number' && Number.isFinite(firstEntry.inserted_count)) {
        return firstEntry.inserted_count
      }
    }

    if (payload && typeof payload === 'object' && typeof (payload as CommentBatchRpcResult).inserted_count === 'number') {
      return (payload as CommentBatchRpcResult).inserted_count as number
    }

    return comments.length
  } finally {
    clearTimeout(timeoutId)
  }
}

async function requestCommentQueueDurableObject<T>(
  env: EngagementEnv,
  pathname: '/thread' | '/create' | '/update' | '/delete' | '/flush',
  payload?: Record<string, unknown>,
) {
  const response = await env.COMMENT_QUEUE_DO.getByName(COMMENT_QUEUE_DO_NAME).fetch(`https://comment-queue${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: payload ? JSON.stringify(payload) : undefined,
  })

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(getErrorMessage(body, `COMMENT_QUEUE_${response.status}`))
  }

  return body as T
}

async function handleCommentThreadGet(request: Request, env: EngagementEnv, ctx: ExecutionContext) {
  const url = new URL(request.url)

  const cacheEntry = getCommentThreadCacheKeyFromUrl(url)
  if (!cacheEntry) {
    return proxyRequest(request, env, url.pathname)
  }

  const cachedResponse = await caches.default.match(cacheEntry.cacheKey)
  if (cachedResponse) {
    log('log', 'comment thread cache hit', {
      path: url.pathname,
      targetType: cacheEntry.targetType,
      targetId: cacheEntry.targetId,
      archived: cacheEntry.archived,
    })

    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers: corsHeaders(cachedResponse.headers),
    })
  }

  const [originResponse, pendingComments] = await Promise.all([
    proxyRequest(request, env, url.pathname),
    cacheEntry.archived === true
      ? Promise.resolve([])
      : requestCommentQueueDurableObject<CommentPublicRecord[]>(env, '/thread', {
          targetType: cacheEntry.targetType,
          targetId: cacheEntry.targetId,
        }).catch((error) => {
          log('error', 'pending comment thread load failed', {
            path: url.pathname,
            targetType: cacheEntry.targetType,
            targetId: cacheEntry.targetId,
            archived: cacheEntry.archived,
            error: error instanceof Error ? error.message : String(error),
          })

          return []
        }),
  ])

  if (!originResponse.ok) {
    return originResponse
  }

  const originPayload = normalizeCommentThreadPayload(await parseJsonResponse<unknown>(originResponse))
  if (!originPayload) {
    return originResponse
  }

  const response = withCommentThreadCacheHeaders(jsonResponse(mergeCommentThreads(originPayload, pendingComments)))
  ctx.waitUntil(caches.default.put(cacheEntry.cacheKey, response.clone()))

  log('log', 'comment thread cache miss', {
    path: url.pathname,
    targetType: cacheEntry.targetType,
    targetId: cacheEntry.targetId,
    archived: cacheEntry.archived,
  })

  return response
}

async function handleCommentCreate(request: Request, env: EngagementEnv, ctx: ExecutionContext) {
  const body = await request.json().catch(() => null)

  let rateLimit: CommentRateLimitResult | null = null

  try {
    rateLimit = await enforceCommentRateLimit(request, env)
  } catch (error) {
    log('error', 'comment rate limit check failed', {
      path: getRequestPath(request),
      error: error instanceof Error ? error.message : String(error),
    })

    return jsonResponse({ error: '评论限流检查失败。' }, { status: 503 })
  }

  if (rateLimit && !rateLimit.allowed) {
    log('warn', 'comment rate limited at edge', {
      path: getRequestPath(request),
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      resetAt: rateLimit.resetAt,
    })

    return jsonResponse(
      { error: '评论提交过于频繁，请稍后再试。' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds),
        },
      },
    )
  }

  const validationError = validateCommentPayload(body, env)

  if (validationError) {
    log('warn', 'comment blocked at edge', {
      path: getRequestPath(request),
      reason: validationError,
    })
    return jsonResponse({ error: validationError }, { status: 400 })
  }

  const payload = normalizeCommentPayload(body)
  if (!payload) {
    return jsonResponse({ error: '评论缺少必要字段。' }, { status: 400 })
  }

  try {
    const result = await requestCommentQueueDurableObject<CommentMutationResult>(env, '/create', {
      comment: {
        id: crypto.randomUUID(),
        ...payload,
        created_at: new Date().toISOString(),
        updated_at: null,
      },
    })

    invalidateCommentThreadCache(ctx, request.url, result.targetType, result.targetId, 'create')
    return jsonResponse(result.comment, { status: 201 })
  } catch (error) {
    log('error', 'comment queue create failed', {
      path: getRequestPath(request),
      targetType: payload.target_type,
      targetId: payload.target_id,
      error: error instanceof Error ? error.message : String(error),
    })

    return jsonResponse({ error: '评论入队失败。' }, { status: 503 })
  }
}

async function handleCommentMutation(request: Request, env: EngagementEnv, ctx: ExecutionContext) {
  const match = getRequestPath(request).match(commentMutationRoute)
  if (!match) {
    return jsonResponse({ error: 'Not found' }, { status: 404 })
  }

  const commentId = normalizeCommentId(match[1])
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const identities = normalizeCommentIdentities(body)

  try {
    if (request.method === 'PATCH') {
      const content = typeof body?.content === 'string' ? body.content.trim() : ''
      if (!content) {
        return jsonResponse({ error: 'Missing content' }, { status: 400 })
      }

      if (content.length > getCommentMaxLength(env)) {
        return jsonResponse({ error: 'Content too long' }, { status: 400 })
      }

      const spamError = looksLikeSpam(content, env)
      if (spamError) {
        return jsonResponse({ error: spamError }, { status: 400 })
      }

      const result = await requestCommentQueueDurableObject<CommentMutationResult>(env, '/update', {
        commentId,
        content,
        identities,
      })

      invalidateCommentThreadCache(ctx, request.url, result.targetType, result.targetId, 'update')
      return jsonResponse(result.comment)
    }

    const result = await requestCommentQueueDurableObject<CommentDeletionResult>(env, '/delete', {
      commentId,
      identities,
    })

    invalidateCommentThreadCache(ctx, request.url, result.targetType, result.targetId, 'delete')
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (message === 'NOT_FOUND') {
      return jsonResponse({ error: 'Comment not found' }, { status: 404 })
    }

    if (message === 'FORBIDDEN') {
      return jsonResponse({ error: 'Forbidden' }, { status: 403 })
    }

    if (message === 'MISSING_CONTENT') {
      return jsonResponse({ error: 'Missing content' }, { status: 400 })
    }

    log('error', 'pending comment mutation failed', {
      path: getRequestPath(request),
      method: request.method,
      commentId,
      error: message,
    })

    return jsonResponse({ error: '待同步评论变更失败。' }, { status: 500 })
  }
}

export class CommentQueueDurableObject extends DurableObject<EngagementEnv> {
  private async getCommentRecord(commentId: string) {
    return this.ctx.storage.get<CommentQueuedRecord>(getCommentQueueRecordKey(commentId))
  }

  private async putCommentRecord(comment: CommentQueuedRecord) {
    await Promise.all([
      this.ctx.storage.put(getCommentQueueRecordKey(comment.id), comment),
      this.ctx.storage.put(getCommentQueueThreadIndexKey(comment), comment.id),
      this.ctx.storage.put(getCommentQueueThreadLookupKey(comment.id), getCommentQueueThreadIndexKey(comment)),
    ])
  }

  private async deleteCommentRecord(commentId: string) {
    const threadIndexKey = await this.ctx.storage.get<string>(getCommentQueueThreadLookupKey(commentId))

    await Promise.all([
      this.ctx.storage.delete(getCommentQueueRecordKey(commentId)),
      this.ctx.storage.delete(getCommentQueueThreadLookupKey(commentId)),
      threadIndexKey ? this.ctx.storage.delete(threadIndexKey) : Promise.resolve(false),
    ])
  }

  private async listThreadComments(targetType: string, targetId: string) {
    const threadEntries = await this.ctx.storage.list<string>({ prefix: getCommentQueueThreadPrefix(targetType, targetId) })
    const queuedComments = await Promise.all(
      [...threadEntries.values()].map((commentId) => this.getCommentRecord(commentId)),
    )

    return queuedComments
      .flatMap((comment) => comment ? [createPublicCommentRecord(comment)] : [])
      .sort(compareComments)
  }

  private async flushPendingComments(): Promise<CommentQueueFlushResult> {
    const queuedEntries = await this.ctx.storage.list<CommentQueuedRecord>({ prefix: COMMENT_QUEUE_RECORD_PREFIX })
    const queuedComments = [...queuedEntries.values()]

    if (queuedComments.length === 0) {
      return {
        flushedCount: 0,
        threadTargets: [],
      }
    }

    const threadTargets = new Map(
      queuedComments.map((comment) => [`${comment.target_type}:${comment.target_id}`, {
        targetType: comment.target_type,
        targetId: comment.target_id,
      } satisfies CommentThreadTarget]),
    )

    const flushedCount = await callSupabaseCommentBatchRpc(this.env, queuedComments)

    for (const comment of queuedComments) {
      await this.deleteCommentRecord(comment.id)
    }

    return {
      flushedCount,
      threadTargets: [...threadTargets.values()],
    }
  }

  private async assertCanModify(comment: CommentQueuedRecord, identities: string[]) {
    if (!identities.includes(comment.author)) {
      throw new Error('FORBIDDEN')
    }
  }

  async fetch(request: Request) {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, { status: 405 })
    }

    return this.ctx.blockConcurrencyWhile(async () => {
      const url = new URL(request.url)
      const body = await request.json().catch(() => null) as Record<string, unknown> | null

      if (url.pathname === '/thread') {
        const targetType = typeof body?.targetType === 'string' ? body.targetType.trim() : ''
        const targetId = normalizeCommentId(body?.targetId)

        if (!targetType || !targetId) {
          return jsonResponse({ error: 'MISSING_TARGET' }, { status: 400 })
        }

        return jsonResponse(await this.listThreadComments(targetType, targetId))
      }

      if (url.pathname === '/create') {
        const comment = normalizeQueuedCommentRecord(body?.comment)
        if (!comment) {
          return jsonResponse({ error: 'INVALID_COMMENT' }, { status: 400 })
        }

        await this.putCommentRecord(comment)
        return jsonResponse({
          comment: createPublicCommentRecord(comment),
          targetType: comment.target_type,
          targetId: comment.target_id,
        } satisfies CommentMutationResult)
      }

      if (url.pathname === '/update') {
        const commentId = normalizeCommentId(body?.commentId)
        const content = typeof body?.content === 'string' ? body.content.trim() : ''

        if (!commentId) {
          return jsonResponse({ error: 'NOT_FOUND' }, { status: 404 })
        }

        if (!content) {
          return jsonResponse({ error: 'MISSING_CONTENT' }, { status: 400 })
        }

        const comment = await this.getCommentRecord(commentId)
        if (!comment) {
          return jsonResponse({ error: 'NOT_FOUND' }, { status: 404 })
        }

        await this.assertCanModify(comment, normalizeCommentIdentities(body))

        const updatedComment = {
          ...comment,
          content,
          updated_at: new Date().toISOString(),
        } satisfies CommentQueuedRecord

        await this.putCommentRecord(updatedComment)
        return jsonResponse({
          comment: createPublicCommentRecord(updatedComment),
          targetType: updatedComment.target_type,
          targetId: updatedComment.target_id,
        } satisfies CommentMutationResult)
      }

      if (url.pathname === '/delete') {
        const commentId = normalizeCommentId(body?.commentId)
        if (!commentId) {
          return jsonResponse({ error: 'NOT_FOUND' }, { status: 404 })
        }

        const comment = await this.getCommentRecord(commentId)
        if (!comment) {
          return jsonResponse({ error: 'NOT_FOUND' }, { status: 404 })
        }

        await this.assertCanModify(comment, normalizeCommentIdentities(body))
        await this.deleteCommentRecord(commentId)

        return jsonResponse({
          targetType: comment.target_type,
          targetId: comment.target_id,
        } satisfies CommentDeletionResult)
      }

      if (url.pathname === '/flush') {
        return jsonResponse(await this.flushPendingComments())
      }

      return jsonResponse({ error: 'NOT_FOUND' }, { status: 404 })
    })
  }
}

export class CommentRateLimiterDurableObject extends DurableObject<EngagementEnv> {
  async fetch(request: Request) {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, { status: 405 })
    }

    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const payload = body ?? {}
    const requestedMaxRequests = typeof payload.maxRequests === 'number' && Number.isFinite(payload.maxRequests)
      ? Math.max(1, Math.trunc(payload.maxRequests))
      : DEFAULT_COMMENT_RATE_LIMIT_MAX_REQUESTS
    const requestedWindowMs = typeof payload.windowMs === 'number' && Number.isFinite(payload.windowMs)
      ? Math.max(1_000, Math.trunc(payload.windowMs))
      : DEFAULT_COMMENT_RATE_LIMIT_WINDOW_SECONDS * 1_000

    const now = Date.now()
    const current = await this.ctx.storage.get<CommentRateLimitCounter>('counter')
    const counter = current && current.resetAt > now
      ? current
      : {
        count: 0,
        resetAt: now + requestedWindowMs,
      }

    if (counter.count >= requestedMaxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((counter.resetAt - now) / 1_000))

      return jsonResponse({
        allowed: false,
        limit: requestedMaxRequests,
        remaining: 0,
        resetAt: counter.resetAt,
        retryAfterSeconds,
      } satisfies CommentRateLimitResult, { status: 200 })
    }

    const nextCounter = {
      count: counter.count + 1,
      resetAt: counter.resetAt,
    } satisfies CommentRateLimitCounter

    await this.ctx.storage.put('counter', nextCounter)
    const scheduledAlarm = await this.ctx.storage.getAlarm()
    if (scheduledAlarm == null || scheduledAlarm !== nextCounter.resetAt) {
      await this.ctx.storage.setAlarm(nextCounter.resetAt)
    }

    return jsonResponse({
      allowed: true,
      limit: requestedMaxRequests,
      remaining: Math.max(0, requestedMaxRequests - nextCounter.count),
      resetAt: nextCounter.resetAt,
      retryAfterSeconds: 0,
    } satisfies CommentRateLimitResult, { status: 200 })
  }

  async alarm() {
    await this.ctx.storage.delete('counter')
  }
}

const commentMutationRoute = /^\/api\/comments\/([^/]+)$/

const worker = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      })
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      return jsonResponse({ ok: true, service: 'blog-engagement' })
    }

    if (url.pathname === '/api/comments' && request.method === 'GET') {
      return handleCommentThreadGet(request, env, ctx)
    }

    if (url.pathname === '/api/comments' && request.method === 'POST') {
      return handleCommentCreate(request, env, ctx)
    }

    if (commentMutationRoute.test(url.pathname) && (request.method === 'PATCH' || request.method === 'DELETE')) {
      return handleCommentMutation(request, env, ctx)
    }

    return jsonResponse({ error: 'Not found' }, { status: 404 })
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        const result = await requestCommentQueueDurableObject<CommentQueueFlushResult>(env, '/flush')
        log('log', 'scheduled comment flush finished', {
          flushedCount: result.flushedCount,
          threadCount: result.threadTargets.length,
        })
      } catch (error) {
        log('error', 'scheduled comment flush failed', {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })())
  },
} satisfies ExportedHandler<EngagementEnv>

export default worker