import { DurableObject } from 'cloudflare:workers'

const UPSTREAM_TIMEOUT_MS = 15_000
const DEFAULT_COMMENT_MAX_LENGTH = 500
const DEFAULT_COMMENT_URL_LIMIT = 2
const DEFAULT_COMMENT_RATE_LIMIT_MAX_REQUESTS = 5
const DEFAULT_COMMENT_RATE_LIMIT_WINDOW_SECONDS = 60
const COMMENT_THREAD_CACHE_TTL_SECONDS = 60
const COMMENT_THREAD_LIMIT_MAX = 100
const DEFAULT_BLOCKED_TERMS = ['博彩', '裸聊', '刷单', '代刷', '纸飞机', 'telegram', '免费兼职', '加v', '加微']
const SUPABASE_COMMENT_SELECT = 'id,target_type,target_id,author,content,parent_id,created_at,updated_at,upvotes,downvotes'
const COMMENT_THREAD_HEADER_HAS_MORE = 'X-Comment-Thread-Has-More'
const COMMENT_THREAD_HEADER_NEXT_OFFSET = 'X-Comment-Thread-Next-Offset'
const COMMENT_THREAD_HEADER_TOTAL = 'X-Comment-Thread-Total'
const COMMENT_THREAD_EXPOSED_HEADERS = [
  COMMENT_THREAD_HEADER_HAS_MORE,
  COMMENT_THREAD_HEADER_NEXT_OFFSET,
  COMMENT_THREAD_HEADER_TOTAL,
].join(', ')
const POST_REACTION_POST_ID_KEY = 'post-reaction:post-id'
const POST_REACTION_META_KEY = 'post-reaction:meta'
const POST_REACTION_VALUE_PREFIX = 'post-reaction:value:'
const POST_REACTION_PENDING_PREFIX = 'post-reaction:pending:'

type EngagementEnv = Cloudflare.Env & {
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

type CommentThreadTarget = {
  targetType: string
  targetId: string
}

type CommentThreadSortMode = 'time'

type CommentThreadSortDirection = 'asc' | 'desc'

type CommentThreadQuery = {
  offset: number
  limit: number | null
  searchQuery: string
  tag: string
  sort: CommentThreadSortMode
  direction: CommentThreadSortDirection
}

type AppliedCommentThreadQuery = {
  comments: CommentPublicRecord[]
  hasMore: boolean
  nextOffset: number
  total: number
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

type CommentInsertRecord = {
  id: string
  target_type: string
  target_id: string
  author: string
  content: string
  parent_id: string | null
  created_at: string
  updated_at: string | null
}

type CommentPersistedRecord = CommentInsertRecord & {
  upvotes: number
  downvotes: number
}

type CommentEmojiReactionRow = {
  comment_id: string
  emoji: string
  updated_at: string | null
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
    nextHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  }
  if (!nextHeaders.has('Access-Control-Allow-Headers')) {
    nextHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }
  if (!nextHeaders.has('Access-Control-Expose-Headers')) {
    nextHeaders.set('Access-Control-Expose-Headers', COMMENT_THREAD_EXPOSED_HEADERS)
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

function compareComments(left: Pick<CommentPublicRecord, 'created_at' | 'id'>, right: Pick<CommentPublicRecord, 'created_at' | 'id'>) {
  const timeDifference = new Date(left.created_at).getTime() - new Date(right.created_at).getTime()

  if (timeDifference !== 0) {
    return timeDifference
  }

  return left.id.localeCompare(right.id)
}

function compareCommentsByDirection(
  left: Pick<CommentPublicRecord, 'created_at' | 'id'>,
  right: Pick<CommentPublicRecord, 'created_at' | 'id'>,
  direction: CommentThreadSortDirection,
) {
  const difference = compareComments(left, right)
  return direction === 'desc' ? difference * -1 : difference
}

const COMMENT_THREAD_HASHTAG_PATTERN = /#([\p{L}\p{N}_-]+)/gu

function parseCommentHashtags(content: string) {
  const seen = new Set<string>()
  let match: RegExpExecArray | null
  COMMENT_THREAD_HASHTAG_PATTERN.lastIndex = 0

  while ((match = COMMENT_THREAD_HASHTAG_PATTERN.exec(content)) !== null) {
    const tag = match[1]?.toLocaleLowerCase() ?? ''
    if (tag && tag.length <= 32) {
      seen.add(tag)
    }

    COMMENT_THREAD_HASHTAG_PATTERN.lastIndex = match.index + 1
  }

  return seen
}

function normalizeCommentThreadOffsetQuery(value: string | null) {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0
  }

  return parsed
}

function normalizeCommentThreadLimitQuery(value: string | null) {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return Math.min(parsed, COMMENT_THREAD_LIMIT_MAX)
}

function normalizeCommentThreadSearchQuery(value: string | null) {
  return value?.trim().toLocaleLowerCase() ?? ''
}

function normalizeCommentThreadTagQuery(value: string | null) {
  return value?.trim().replace(/^#+/, '').toLocaleLowerCase() ?? ''
}

function normalizeCommentThreadSortModeQuery(value: string | null): CommentThreadSortMode {
  return value === 'time' ? 'time' : 'time'
}

function normalizeCommentThreadSortDirectionQuery(value: string | null): CommentThreadSortDirection {
  return value === 'desc' ? 'desc' : 'asc'
}

function getCommentThreadQuery(url: URL): CommentThreadQuery {
  return {
    offset: normalizeCommentThreadOffsetQuery(url.searchParams.get('offset')),
    limit: normalizeCommentThreadLimitQuery(url.searchParams.get('limit')),
    searchQuery: normalizeCommentThreadSearchQuery(url.searchParams.get('q')),
    tag: normalizeCommentThreadTagQuery(url.searchParams.get('tag')),
    sort: normalizeCommentThreadSortModeQuery(url.searchParams.get('sort')),
    direction: normalizeCommentThreadSortDirectionQuery(url.searchParams.get('direction')),
  }
}

function isDefaultCommentThreadQuery(query: CommentThreadQuery) {
  return (
    query.offset === 0
    && query.limit === null
    && query.searchQuery.length === 0
    && query.tag.length === 0
    && query.sort === 'time'
    && query.direction === 'asc'
  )
}

function applyCommentThreadQuery(comments: CommentPublicRecord[], query: CommentThreadQuery): AppliedCommentThreadQuery {
  let filtered = comments

  if (query.searchQuery) {
    filtered = filtered.filter((comment) => comment.content.toLocaleLowerCase().includes(query.searchQuery))
  }

  if (query.tag) {
    filtered = filtered.filter((comment) => parseCommentHashtags(comment.content).has(query.tag))
  }

  const ordered = query.direction === 'asc' && query.sort === 'time'
    ? filtered
    : [...filtered].sort((left, right) => compareCommentsByDirection(left, right, query.direction))

  const total = ordered.length

  if (query.limit === null) {
    const commentsWindow = query.offset > 0 ? ordered.slice(query.offset) : ordered
    return {
      comments: commentsWindow,
      hasMore: false,
      nextOffset: query.offset + commentsWindow.length,
      total,
    }
  }

  const pagedWindow = ordered.slice(query.offset, query.offset + query.limit + 1)
  const hasMore = pagedWindow.length > query.limit
  const commentsWindow = hasMore ? pagedWindow.slice(0, query.limit) : pagedWindow

  return {
    comments: commentsWindow,
    hasMore,
    nextOffset: query.offset + commentsWindow.length,
    total,
  }
}

function createCommentThreadQueryResponse(result: AppliedCommentThreadQuery) {
  return jsonResponse(result.comments, {
    headers: {
      'Cache-Control': 'no-store',
      [COMMENT_THREAD_HEADER_HAS_MORE]: result.hasMore ? '1' : '0',
      [COMMENT_THREAD_HEADER_NEXT_OFFSET]: String(result.nextOffset),
      [COMMENT_THREAD_HEADER_TOTAL]: String(result.total),
    },
  })
}

function normalizeCommentEmoji(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  if (!normalized || normalized.length > 24) {
    return null
  }

  return normalized
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

function normalizePersistedCommentRecord(value: unknown) {
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
    upvotes: typeof payload.upvotes === 'number' && Number.isFinite(payload.upvotes) ? payload.upvotes : 0,
    downvotes: typeof payload.downvotes === 'number' && Number.isFinite(payload.downvotes) ? payload.downvotes : 0,
  } satisfies CommentPersistedRecord
}

function createPersistedCommentPublicRecord(comment: CommentPersistedRecord): CommentPublicRecord {
  return {
    id: comment.id,
    author: comment.author,
    content: comment.content,
    created_at: comment.created_at,
    updated_at: comment.updated_at,
    parent_id: comment.parent_id,
    upvotes: comment.upvotes,
    downvotes: comment.downvotes,
    viewer_reaction: 0,
    emoji_reactions: [],
    viewer_emojis: [],
    sync_state: 'persisted',
  }
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

function getNtfyExternalUrl(env: Cloudflare.Env): string | undefined {
  return (env as Cloudflare.Env & { NTFY_EXTERNAL_URL?: string }).NTFY_EXTERNAL_URL?.trim()
}

function getNtfyToken(env: Cloudflare.Env): string | undefined {
  return (env as Cloudflare.Env & { NTFY_TOKEN?: string }).NTFY_TOKEN?.trim()
}

function sendNtfyWorker(
  ntfyUrl: string,
  ntfyToken: string | undefined,
  topic: string,
  title: string,
  message: string,
  tags: string[],
  priority: number,
): Promise<void> {
  return fetch(ntfyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(ntfyToken ? { Authorization: `Bearer ${ntfyToken}` } : {}),
    },
    body: JSON.stringify({ topic, title, message, tags, priority }),
  }).then(() => undefined)
}

function getCommentTargetLabel(targetType: string): string {
  if (targetType === 'blog_post') return '博客'
  if (targetType === 'guestbook') return '留言板'
  if (targetType === 'wardrobe_item') return '穿搭'
  if (targetType === 'note') return '卡片评论'
  return targetType
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

function getSupabaseCommentByIdUrl(env: Cloudflare.Env, commentId: string, select = SUPABASE_COMMENT_SELECT) {
  const url = new URL(`${getSupabaseUrl(env)}/rest/v1/comments`)
  url.searchParams.set('id', `eq.${commentId}`)
  url.searchParams.set('limit', '1')

  if (select) {
    url.searchParams.set('select', select)
  }

  return url.toString()
}

function getSupabaseCommentThreadUrl(
  env: Cloudflare.Env,
  targetType: string,
  targetId: string,
  archived: boolean | null,
  select = SUPABASE_COMMENT_SELECT,
) {
  const url = new URL(`${getSupabaseUrl(env)}/rest/v1/comments`)
  url.searchParams.set('target_type', `eq.${targetType}`)
  url.searchParams.set('target_id', `eq.${targetId}`)
  url.searchParams.set('order', 'created_at.asc')

  if (archived !== null) {
    url.searchParams.set('archived', `eq.${archived}`)
  }

  if (select) {
    url.searchParams.set('select', select)
  }

  return url.toString()
}

function getSupabaseCommentEmojiReactionsUrl(env: Cloudflare.Env, commentIds: string[]) {
  const url = new URL(`${getSupabaseUrl(env)}/rest/v1/comment_emoji_reactions`)
  url.searchParams.set('select', 'comment_id,emoji,updated_at')
  url.searchParams.set('comment_id', `in.(${commentIds.join(',')})`)
  return url.toString()
}

function getRequestBearerToken(request: Request) {
  const authorization = request.headers.get('Authorization')?.trim()
  if (!authorization) {
    return null
  }

  const [scheme, token] = authorization.split(/\s+/, 2)
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null
  }

  const normalizedToken = token.trim()
  return normalizedToken || null
}

async function getSupabaseUserIdFromRequest(request: Request, env: Cloudflare.Env) {
  const bearerToken = getRequestBearerToken(request)
  if (!bearerToken) {
    return null
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  const serviceRoleKey = getSupabaseServiceRoleKey(env)

  try {
    const response = await fetch(`${getSupabaseUrl(env)}/auth/v1/user`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${bearerToken}`,
      },
      signal: controller.signal,
    })

    const payload = await response.json().catch(() => null)
    if (response.status === 401 || response.status === 403) {
      return null
    }

    if (!response.ok) {
      throw new Error(getErrorMessage(payload, `SUPABASE_AUTH_${response.status}`))
    }

    const userId = payload && typeof payload === 'object' && typeof (payload as { id?: unknown }).id === 'string'
      ? (payload as { id: string }).id.trim()
      : ''

    if (!userId) {
      throw new Error('INVALID_SUPABASE_AUTH_RESPONSE')
    }

    return userId
  } finally {
    clearTimeout(timeoutId)
  }
}

async function requestHasAdminRole(request: Request, env: Cloudflare.Env) {
  const userId = await getSupabaseUserIdFromRequest(request, env)
  if (!userId) {
    return false
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  const serviceRoleKey = getSupabaseServiceRoleKey(env)
  const url = new URL(`${getSupabaseUrl(env)}/rest/v1/user_roles`)
  url.searchParams.set('select', 'role')
  url.searchParams.set('user_id', `eq.${userId}`)
  url.searchParams.set('limit', '1')

  try {
    const response = await fetch(url.toString(), {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      signal: controller.signal,
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(getErrorMessage(payload, `SUPABASE_ROLE_${response.status}`))
    }

    if (!Array.isArray(payload) || payload.length === 0) {
      return false
    }

    return payload.some((entry) => entry && typeof entry === 'object' && (entry as { role?: unknown }).role === 'admin')
  } finally {
    clearTimeout(timeoutId)
  }
}

async function fetchPersistedCommentById(env: Cloudflare.Env, commentId: string) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  const serviceRoleKey = getSupabaseServiceRoleKey(env)

  try {
    const response = await fetch(getSupabaseCommentByIdUrl(env, commentId), {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      signal: controller.signal,
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(getErrorMessage(payload, `SUPABASE_COMMENT_${response.status}`))
    }

    if (!Array.isArray(payload) || payload.length === 0) {
      return null
    }

    const comment = normalizePersistedCommentRecord(payload[0])
    if (!comment) {
      throw new Error('INVALID_SUPABASE_COMMENT_RESPONSE')
    }

    return comment
  } finally {
    clearTimeout(timeoutId)
  }
}

async function fetchPersistedCommentThread(
  env: Cloudflare.Env,
  targetType: string,
  targetId: string,
  archived: boolean | null,
) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  const serviceRoleKey = getSupabaseServiceRoleKey(env)

  try {
    const response = await fetch(getSupabaseCommentThreadUrl(env, targetType, targetId, archived), {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      signal: controller.signal,
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(getErrorMessage(payload, `SUPABASE_COMMENT_THREAD_${response.status}`))
    }

    if (!Array.isArray(payload) || payload.length === 0) {
      return [] as CommentPersistedRecord[]
    }

    return payload.flatMap((entry) => {
      const comment = normalizePersistedCommentRecord(entry)
      return comment ? [comment] : []
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

async function getCommentEmojiSummaryMap(env: Cloudflare.Env, commentIds: string[]) {
  if (commentIds.length === 0) {
    return {} as Record<string, CommentPublicRecord['emoji_reactions']>
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  const serviceRoleKey = getSupabaseServiceRoleKey(env)

  try {
    const response = await fetch(getSupabaseCommentEmojiReactionsUrl(env, commentIds), {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      signal: controller.signal,
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(getErrorMessage(payload, `SUPABASE_COMMENT_EMOJIS_${response.status}`))
    }

    const summaryMap = Object.fromEntries(
      commentIds.map((commentId) => [commentId, [] as CommentPublicRecord['emoji_reactions']]),
    ) as Record<string, CommentPublicRecord['emoji_reactions']>

    if (!Array.isArray(payload) || payload.length === 0) {
      return summaryMap
    }

    const aggregateMap = new Map<string, Map<string, { count: number; updatedAt: string }>>()

    for (const row of payload) {
      if (!row || typeof row !== 'object') {
        continue
      }

      const reaction = row as CommentEmojiReactionRow
      const commentId = normalizeCommentId(reaction.comment_id)
      const emoji = normalizeCommentEmoji(reaction.emoji)

      if (!commentId || !emoji) {
        continue
      }

      const updatedAt = typeof reaction.updated_at === 'string' ? reaction.updated_at : ''
      const byEmoji = aggregateMap.get(commentId) ?? new Map<string, { count: number; updatedAt: string }>()
      const current = byEmoji.get(emoji)

      byEmoji.set(emoji, {
        count: (current?.count ?? 0) + 1,
        updatedAt: current?.updatedAt && current.updatedAt > updatedAt ? current.updatedAt : updatedAt,
      })

      aggregateMap.set(commentId, byEmoji)
    }

    for (const [commentId, byEmoji] of aggregateMap.entries()) {
      summaryMap[commentId] = [...byEmoji.entries()]
        .map(([emoji, meta]) => ({ emoji, count: meta.count, viewer: false, updatedAt: meta.updatedAt }))
        .sort((left, right) => {
          if (right.count !== left.count) {
            return right.count - left.count
          }

          if (right.updatedAt !== left.updatedAt) {
            return right.updatedAt.localeCompare(left.updatedAt)
          }

          return left.emoji.localeCompare(right.emoji)
        })
        .map(({ emoji, count, viewer }) => ({ emoji, count, viewer }))
    }

    return summaryMap
  } finally {
    clearTimeout(timeoutId)
  }
}

async function fetchPersistedCommentThreadPublicRecords(
  env: Cloudflare.Env,
  targetType: string,
  targetId: string,
  archived: boolean | null,
) {
  const persistedComments = await fetchPersistedCommentThread(env, targetType, targetId, archived)
  const commentIds = persistedComments.map((comment) => comment.id)

  const emojiSummaryMap = commentIds.length === 0
    ? {} as Record<string, CommentPublicRecord['emoji_reactions']>
    : await getCommentEmojiSummaryMap(env, commentIds).catch((error) => {
        log('error', 'comment emoji summary load failed', {
          targetType,
          targetId,
          archived,
          error: error instanceof Error ? error.message : String(error),
        })

        return {} as Record<string, CommentPublicRecord['emoji_reactions']>
      })

  return persistedComments.map((comment) => ({
    ...createPersistedCommentPublicRecord(comment),
    emoji_reactions: emojiSummaryMap[comment.id] ?? [],
  }))
}

async function updatePersistedComment(env: Cloudflare.Env, commentId: string, content: string) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  const serviceRoleKey = getSupabaseServiceRoleKey(env)

  try {
    const response = await fetch(getSupabaseCommentByIdUrl(env, commentId), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ content }),
      signal: controller.signal,
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(getErrorMessage(payload, `SUPABASE_COMMENT_UPDATE_${response.status}`))
    }

    if (!Array.isArray(payload) || payload.length === 0) {
      return null
    }

    const comment = normalizePersistedCommentRecord(payload[0])
    if (!comment) {
      throw new Error('INVALID_SUPABASE_COMMENT_RESPONSE')
    }

    return comment
  } finally {
    clearTimeout(timeoutId)
  }
}

async function deletePersistedComment(env: Cloudflare.Env, commentId: string) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  const serviceRoleKey = getSupabaseServiceRoleKey(env)

  try {
    const response = await fetch(getSupabaseCommentByIdUrl(env, commentId, ''), {
      method: 'DELETE',
      headers: {
        Prefer: 'return=minimal',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new Error(getErrorMessage(payload, `SUPABASE_COMMENT_DELETE_${response.status}`))
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

async function assertCanModifyPersistedComment(
  request: Request,
  env: Cloudflare.Env,
  comment: CommentPersistedRecord,
  identities: string[],
) {
  if (identities.includes(comment.author)) {
    return
  }

  if (await requestHasAdminRole(request, env)) {
    return
  }

  throw new Error('FORBIDDEN')
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

async function insertCommentToSupabase(env: Cloudflare.Env, comment: CommentInsertRecord) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  const serviceRoleKey = getSupabaseServiceRoleKey(env)

  try {
    const response = await fetch(`${getSupabaseUrl(env)}/rest/v1/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        id: comment.id,
        target_type: comment.target_type,
        target_id: comment.target_id,
        author: comment.author,
        content: comment.content,
        parent_id: comment.parent_id,
        created_at: comment.created_at,
        updated_at: comment.updated_at,
      }),
      signal: controller.signal,
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(getErrorMessage(payload, `SUPABASE_COMMENT_INSERT_${response.status}`))
    }

    if (!Array.isArray(payload) || payload.length === 0) {
      throw new Error('INVALID_SUPABASE_COMMENT_RESPONSE')
    }

    const inserted = normalizePersistedCommentRecord(payload[0])
    if (!inserted) {
      throw new Error('INVALID_SUPABASE_COMMENT_RESPONSE')
    }

    return inserted
  } finally {
    clearTimeout(timeoutId)
  }
}

async function handleCommentThreadGet(request: Request, env: EngagementEnv, ctx: ExecutionContext) {
  const url = new URL(request.url)
  const query = getCommentThreadQuery(url)
  const isDefaultQuery = isDefaultCommentThreadQuery(query)

  const cacheEntry = getCommentThreadCacheKeyFromUrl(url)
  if (!cacheEntry) {
    return jsonResponse({ error: 'MISSING_TARGET' }, { status: 400 })
  }

  const cachedResponse = await caches.default.match(cacheEntry.cacheKey)
  if (cachedResponse) {
    log('log', 'comment thread cache hit', {
      path: url.pathname,
      targetType: cacheEntry.targetType,
      targetId: cacheEntry.targetId,
      archived: cacheEntry.archived,
    })

    if (!isDefaultQuery) {
      const cachedPayload = await cachedResponse.clone().json().catch(() => null)
      const cachedComments = normalizeCommentThreadPayload(cachedPayload)

      if (cachedComments) {
        return createCommentThreadQueryResponse(applyCommentThreadQuery(cachedComments, query))
      }
    }

    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers: corsHeaders(cachedResponse.headers),
    })
  }

  let comments: CommentPublicRecord[]

  try {
    comments = await fetchPersistedCommentThreadPublicRecords(
      env,
      cacheEntry.targetType,
      cacheEntry.targetId,
      cacheEntry.archived,
    )
  } catch (error) {
    log('error', 'comment thread load failed', {
      path: url.pathname,
      targetType: cacheEntry.targetType,
      targetId: cacheEntry.targetId,
      archived: cacheEntry.archived,
      error: error instanceof Error ? error.message : String(error),
    })

    return jsonResponse({ error: '评论加载失败。' }, { status: 503 })
  }

  const canonicalResponse = withCommentThreadCacheHeaders(jsonResponse(comments))
  ctx.waitUntil(caches.default.put(cacheEntry.cacheKey, canonicalResponse.clone()))

  log('log', 'comment thread cache miss', {
    path: url.pathname,
    targetType: cacheEntry.targetType,
    targetId: cacheEntry.targetId,
    archived: cacheEntry.archived,
  })

  if (!isDefaultQuery) {
    return createCommentThreadQueryResponse(applyCommentThreadQuery(comments, query))
  }

  return canonicalResponse
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

  let inserted: CommentPersistedRecord
  try {
    inserted = await insertCommentToSupabase(env, {
      id: crypto.randomUUID(),
      ...payload,
      created_at: new Date().toISOString(),
      updated_at: null,
    })
  } catch (error) {
    log('error', 'comment insert failed', {
      path: getRequestPath(request),
      targetType: payload.target_type,
      targetId: payload.target_id,
      error: error instanceof Error ? error.message : String(error),
    })

    return jsonResponse({ error: '评论提交失败。' }, { status: 503 })
  }

  invalidateCommentThreadCache(ctx, request.url, inserted.target_type, inserted.target_id, 'create')

  const ntfyUrl = getNtfyExternalUrl(env)
  const ntfyToken = getNtfyToken(env)
  if (ntfyUrl) {
    ctx.waitUntil(
      sendNtfyWorker(
        ntfyUrl,
        ntfyToken,
        'blog-comments',
        `新评论 [${getCommentTargetLabel(inserted.target_type)}]`,
        `${inserted.author}: ${inserted.content.slice(0, 120)}`,
        ['speech_balloon'],
        3,
      ).catch(() => {}),
    )
  }

  return jsonResponse(createPersistedCommentPublicRecord(inserted), { status: 201 })
}

async function handleCommentMutation(request: Request, env: EngagementEnv, ctx: ExecutionContext) {
  const match = getRequestPath(request).match(commentMutationRoute)
  if (!match) {
    return jsonResponse({ error: 'Not found' }, { status: 404 })
  }

  const commentId = normalizeCommentId(match[1])
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const identities = normalizeCommentIdentities(body)
  const content = typeof body?.content === 'string' ? body.content.trim() : ''

  try {
    const comment = await fetchPersistedCommentById(env, commentId)
    if (!comment) {
      return jsonResponse({ error: 'Comment not found' }, { status: 404 })
    }

    await assertCanModifyPersistedComment(request, env, comment, identities)

    if (request.method === 'PATCH') {
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

      const updatedComment = await updatePersistedComment(env, commentId, content)
      if (!updatedComment) {
        return jsonResponse({ error: 'Comment not found' }, { status: 404 })
      }

      invalidateCommentThreadCache(ctx, request.url, updatedComment.target_type, updatedComment.target_id, 'update')
      return jsonResponse(createPersistedCommentPublicRecord(updatedComment))
    }

    await deletePersistedComment(env, commentId)
    invalidateCommentThreadCache(ctx, request.url, comment.target_type, comment.target_id, 'delete')
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (message === 'FORBIDDEN') {
      return jsonResponse({ error: 'Forbidden' }, { status: 403 })
    }

    log('error', 'comment mutation failed', {
      path: getRequestPath(request),
      method: request.method,
      commentId,
      error: message,
    })

    return jsonResponse({ error: '评论变更失败。' }, { status: 500 })
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
      const timestamp = new Date().toISOString()
      let supabaseStatus: 'ok' | 'down' = 'ok'
      const t0 = Date.now()
      try {
        const supabaseUrl = getSupabaseUrl(env)
        const key = getSupabaseServiceRoleKey(env)
        const res = await fetch(`${supabaseUrl}/rest/v1/comments?limit=1&select=id`, {
          headers: { 'Authorization': `Bearer ${key}`, 'apikey': key },
          signal: AbortSignal.timeout(3000),
        })
        if (!res.ok) supabaseStatus = 'down'
      } catch { supabaseStatus = 'down' }
      const latency_ms = Date.now() - t0
      const status = supabaseStatus === 'ok' ? 'ok' : 'down'
      return jsonResponse(
        { status, service: 'blog-engagement', timestamp, components: { supabase: { status: supabaseStatus, latency_ms } } },
        { status: status === 'ok' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
      )
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
} satisfies ExportedHandler<EngagementEnv>

export default worker