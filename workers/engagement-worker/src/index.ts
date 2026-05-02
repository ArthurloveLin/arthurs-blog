import { DurableObject } from 'cloudflare:workers'
import {
  applyPostReactionTransition,
  createPostReactionSummaryFields,
  normalizePostReactionIdentity,
  normalizePostReactionValue,
  type PostReactionAggregate,
  type PostReactionSummaryFields,
  type PostReactionValue,
} from '../../../lib/post-reaction-core'

const UPSTREAM_TIMEOUT_MS = 15_000
const DEFAULT_COMMENT_MAX_LENGTH = 500
const DEFAULT_COMMENT_URL_LIMIT = 2
const DEFAULT_COMMENT_RATE_LIMIT_MAX_REQUESTS = 5
const DEFAULT_COMMENT_RATE_LIMIT_WINDOW_SECONDS = 60
const DEFAULT_REACTION_FLUSH_INTERVAL_SECONDS = 300
const DEFAULT_REACTION_FLUSH_RETRY_SECONDS = 60
const COMMENT_THREAD_CACHE_TTL_SECONDS = 60
const DEFAULT_BLOCKED_TERMS = ['博彩', '裸聊', '刷单', '代刷', '纸飞机', 'telegram', '免费兼职', '加v', '加微']
const POST_REACTION_POST_ID_KEY = 'post-reaction:post-id'
const POST_REACTION_META_KEY = 'post-reaction:meta'
const POST_REACTION_VALUE_PREFIX = 'post-reaction:value:'
const POST_REACTION_PENDING_PREFIX = 'post-reaction:pending:'

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

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(init.headers),
    },
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
  const cacheUrl = new URL(requestUrl)
  cacheUrl.pathname = '/api/comments'
  cacheUrl.search = ''
  cacheUrl.searchParams.set('target_type', targetType)
  cacheUrl.searchParams.set('target_id', targetId)

  return new Request(cacheUrl.toString(), { method: 'GET' })
}

function getCommentThreadCacheKeyFromUrl(url: URL) {
  const targetType = url.searchParams.get('target_type')?.trim()
  const targetId = url.searchParams.get('target_id')?.trim()

  if (!targetType || !targetId) {
    return null
  }

  return {
    targetType,
    targetId,
    cacheKey: getCommentThreadCacheKey(url.toString(), targetType, targetId),
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

async function handleCommentThreadGet(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
  const url = new URL(request.url)

  if (url.searchParams.get('identity')?.trim()) {
    return proxyRequest(request, env, url.pathname)
  }

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
    })

    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers: corsHeaders(cachedResponse.headers),
    })
  }

  const originResponse = await proxyRequest(request, env, url.pathname)
  if (!originResponse.ok) {
    return originResponse
  }

  const response = withCommentThreadCacheHeaders(originResponse)
  ctx.waitUntil(caches.default.put(cacheEntry.cacheKey, response.clone()))

  log('log', 'comment thread cache miss', {
    path: url.pathname,
    targetType: cacheEntry.targetType,
    targetId: cacheEntry.targetId,
  })

  return response
}

async function handleCommentCreate(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
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

  const payload = body as CommentPayload
  const targetType = typeof payload.target_type === 'string' ? payload.target_type : null
  const targetId = typeof payload.target_id === 'string' ? payload.target_id : null

  const response = await proxyRequest(request, env, '/api/comments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (response.ok && targetType && targetId) {
    const cacheKey = getCommentThreadCacheKey(request.url, targetType, targetId)
    ctx.waitUntil(
      caches.default.delete(cacheKey).then((deleted) => {
        log('log', 'comment thread cache invalidated after create', {
          path: getRequestPath(request),
          targetType,
          targetId,
          deleted,
        })
      }),
    )
  }

  return response
}

function handleCommentMutationBoundary(request: Request) {
  log('warn', 'comment mutation kept on origin', {
    method: request.method,
    path: getRequestPath(request),
  })

  return jsonResponse(
    { error: '评论编辑和删除保留在站点 origin API。' },
    {
      status: 405,
      headers: {
        Allow: 'GET, POST',
      },
    },
  )
}

async function requestPostReactionDurableObject(
  env: Cloudflare.Env,
  postId: string,
  pathname: '/summary' | '/reaction',
  payload: Record<string, unknown>,
) {
  const response = await env.POST_REACTION_DO.getByName(postId).fetch(`https://post-reaction${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      postId,
      ...payload,
    }),
  })

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(getErrorMessage(body, `POST_REACTION_DO_${response.status}`))
  }

  return createPostReactionSummaryFields(
    (body as Record<string, unknown> | null)?.upvotes,
    (body as Record<string, unknown> | null)?.downvotes,
    (body as Record<string, unknown> | null)?.viewer_reaction,
  )
}

async function handlePostEngagementGet(request: Request, env: Cloudflare.Env) {
  const path = getRequestPath(request)
  const match = path.match(postEngagementRoute)
  if (!match) {
    return jsonResponse({ error: 'Not found' }, { status: 404 })
  }

  const identity = normalizePostReactionIdentity(new URL(request.url).searchParams.get('identity'))
  let originSummary: OriginPostEngagementSummary

  try {
    originSummary = await fetchOriginPostEngagementSummary(env, match[1], identity || undefined)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === 'NOT_FOUND') {
      return jsonResponse({ error: 'Post not found' }, { status: 404 })
    }

    log('error', 'origin engagement summary failed', {
      path,
      postId: match[1],
      error: message,
    })

    return jsonResponse({ error: '上游请求失败。' }, { status: 502 })
  }

  try {
    const summary = await requestPostReactionDurableObject(env, match[1], '/summary', {
      identity,
      seed: originSummary,
    })

    return jsonResponse({
      ...originSummary,
      upvotes: summary.upvotes,
      downvotes: summary.downvotes,
      viewer_reaction: summary.viewer_reaction,
    })
  } catch (error) {
    log('error', 'post reaction summary durable object failed', {
      path,
      postId: match[1],
      error: error instanceof Error ? error.message : String(error),
    })

    return jsonResponse(originSummary)
  }
}

async function handlePostReactionMutation(request: Request, env: Cloudflare.Env) {
  const path = getRequestPath(request)
  const match = path.match(postReactionRoute)
  if (!match) {
    return jsonResponse({ error: 'Not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const identity = normalizePostReactionIdentity(body?.identity)
  const reaction = normalizePostReactionValue(body?.reaction)

  if (!identity) {
    return jsonResponse({ error: 'Missing identity' }, { status: 400 })
  }

  try {
    const summary = await requestPostReactionDurableObject(env, match[1], '/reaction', {
      identity,
      reaction,
    })

    return jsonResponse(summary)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === 'NOT_FOUND') {
      return jsonResponse({ error: 'Post not found' }, { status: 404 })
    }

    log('error', 'post reaction durable object failed, falling back to origin', {
      path,
      postId: match[1],
      error: message,
    })

    return proxyRequest(request, env, path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identity,
        reaction,
      }),
    })
  }
}

export class CommentRateLimiterDurableObject extends DurableObject<Cloudflare.Env> {
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

export class PostReactionDurableObject extends DurableObject<Cloudflare.Env> {
  private async ensurePostId(postId: string) {
    const normalizedPostId = normalizePostId(postId)
    if (!normalizedPostId) {
      throw new Error('MISSING_POST_ID')
    }

    const storedPostId = await this.ctx.storage.get<string>(POST_REACTION_POST_ID_KEY)
    if (storedPostId && storedPostId !== normalizedPostId) {
      throw new Error('POST_ID_MISMATCH')
    }

    if (!storedPostId) {
      await this.ctx.storage.put(POST_REACTION_POST_ID_KEY, normalizedPostId)
    }

    return normalizedPostId
  }

  private async getPostId() {
    const storedPostId = await this.ctx.storage.get<string>(POST_REACTION_POST_ID_KEY)
    if (!storedPostId) {
      throw new Error('MISSING_POST_ID')
    }

    return storedPostId
  }

  private async getMeta() {
    return this.ctx.storage.get<PostReactionAggregate>(POST_REACTION_META_KEY)
  }

  private async setMeta(summary: PostReactionAggregate) {
    await this.ctx.storage.put(POST_REACTION_META_KEY, {
      upvotes: summary.upvotes,
      downvotes: summary.downvotes,
    } satisfies PostReactionAggregate)
  }

  private async ensureInitialized(postId: string, seed?: PostReactionSeed | null) {
    const existingMeta = await this.getMeta()
    if (existingMeta) {
      return existingMeta
    }

    const initialSummary = seed
      ? createPostReactionSummaryFields(seed.upvotes, seed.downvotes, 0)
      : createPostReactionSummaryFields(
        ...(await (async () => {
          const originSummary = await fetchOriginPostEngagementSummary(this.env, postId)
          return [originSummary.upvotes, originSummary.downvotes, 0] as const
        })()),
      )

    const meta = {
      upvotes: initialSummary.upvotes,
      downvotes: initialSummary.downvotes,
    } satisfies PostReactionAggregate

    await this.setMeta(meta)
    return meta
  }

  private async resolveIdentityReaction(postId: string, identity: string, seed?: PostReactionSeed | null): Promise<PostReactionValue> {
    if (!identity) {
      return 0
    }

    const storageKey = getPostReactionValueStorageKey(identity)
    const storedReaction = await this.ctx.storage.get<PostReactionValue>(storageKey)
    if (storedReaction != null) {
      return normalizePostReactionValue(storedReaction)
    }

    if (seed?.hasViewerReaction) {
      const seededReaction = normalizePostReactionValue(seed.viewer_reaction)
      await this.ctx.storage.put(storageKey, seededReaction)
      return seededReaction
    }

    const originSummary = await fetchOriginPostEngagementSummary(this.env, postId, identity)
    await this.ctx.storage.put(storageKey, normalizePostReactionValue(originSummary.viewer_reaction))
    await this.ensureInitialized(postId, getPostReactionSeed(originSummary))

    return normalizePostReactionValue(originSummary.viewer_reaction)
  }

  private async scheduleFlush() {
    const scheduledAlarm = await this.ctx.storage.getAlarm()
    if (scheduledAlarm == null) {
      await this.ctx.storage.setAlarm(Date.now() + getReactionFlushIntervalMs(this.env))
    }
  }

  private async listPendingMutations() {
    const pendingEntries = await this.ctx.storage.list<PostReactionValue>({ prefix: POST_REACTION_PENDING_PREFIX })

    return [...pendingEntries.entries()].map(([key, reaction]) => ({
      identity: decodePostReactionIdentity(key, POST_REACTION_PENDING_PREFIX),
      reaction: normalizePostReactionValue(reaction),
    }))
  }

  private async getSummary(postId: string, identity: string, seed?: PostReactionSeed | null) {
    const meta = await this.ensureInitialized(postId, seed)
    const viewerReaction = await this.resolveIdentityReaction(postId, identity, seed)

    return createPostReactionSummaryFields(meta.upvotes, meta.downvotes, viewerReaction)
  }

  private async applyReaction(postId: string, identity: string, reaction: PostReactionValue) {
    const meta = await this.ensureInitialized(postId)
    const currentReaction = await this.resolveIdentityReaction(postId, identity)
    if (currentReaction === reaction) {
      return createPostReactionSummaryFields(meta.upvotes, meta.downvotes, currentReaction)
    }

    const nextSummary = applyPostReactionTransition(meta, currentReaction, reaction)
    await Promise.all([
      this.setMeta(nextSummary),
      this.ctx.storage.put(getPostReactionValueStorageKey(identity), reaction),
      this.ctx.storage.put(getPostReactionPendingStorageKey(identity), reaction),
    ])
    await this.scheduleFlush()

    return nextSummary
  }

  async fetch(request: Request) {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 })
    }

    return this.ctx.blockConcurrencyWhile(async () => {
      const url = new URL(request.url)
      const body = await request.json().catch(() => null) as Record<string, unknown> | null
      const postId = normalizePostId(body?.postId)

      try {
        await this.ensurePostId(postId)

        if (url.pathname === '/summary') {
          const identity = normalizePostReactionIdentity(body?.identity)
          const summary = await this.getSummary(postId, identity, getPostReactionSeed(body?.seed))
          return jsonResponse(summary)
        }

        if (url.pathname === '/reaction') {
          const identity = normalizePostReactionIdentity(body?.identity)
          if (!identity) {
            return jsonResponse({ error: 'MISSING_IDENTITY' }, { status: 400 })
          }

          const reaction = normalizePostReactionValue(body?.reaction)
          const summary = await this.applyReaction(postId, identity, reaction)
          return jsonResponse(summary)
        }

        return jsonResponse({ error: 'NOT_FOUND' }, { status: 404 })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (message === 'NOT_FOUND') {
          return jsonResponse({ error: message }, { status: 404 })
        }

        return jsonResponse({ error: message }, { status: 500 })
      }
    })
  }

  async alarm() {
    await this.ctx.blockConcurrencyWhile(async () => {
      const postId = await this.getPostId().catch(() => null)
      if (!postId) {
        return
      }

      const pendingMutations = await this.listPendingMutations()
      if (pendingMutations.length === 0) {
        await this.ctx.storage.deleteAlarm()
        return
      }

      try {
        const syncedSummary = await callSupabasePostReactionRpc(this.env, postId, pendingMutations)

        for (const mutation of pendingMutations) {
          const storageKey = getPostReactionPendingStorageKey(mutation.identity)
          const currentPendingReaction = await this.ctx.storage.get<PostReactionValue>(storageKey)
          if (normalizePostReactionValue(currentPendingReaction) === mutation.reaction) {
            await this.ctx.storage.delete(storageKey)
          }
        }

        const remainingMutations = await this.listPendingMutations()
        if (remainingMutations.length === 0) {
          await this.setMeta(syncedSummary)
          await this.ctx.storage.deleteAlarm()
        } else {
          await this.ctx.storage.setAlarm(Date.now() + getReactionFlushIntervalMs(this.env))
        }

        log('log', 'post reaction flush succeeded', {
          postId,
          mutationCount: pendingMutations.length,
          upvotes: syncedSummary.upvotes,
          downvotes: syncedSummary.downvotes,
          remainingMutationCount: remainingMutations.length,
        })
      } catch (error) {
        log('error', 'post reaction flush failed', {
          postId,
          mutationCount: pendingMutations.length,
          error: error instanceof Error ? error.message : String(error),
        })

        await this.ctx.storage.setAlarm(Date.now() + getReactionFlushRetryMs(this.env))
      }
    })
  }
}

const postReactionRoute = /^\/api\/posts\/([^/]+)\/reaction$/
const postEmojiRoute = /^\/api\/posts\/([^/]+)\/emoji$/
const postEngagementRoute = /^\/api\/posts\/([^/]+)\/engagement$/
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
      return jsonResponse({ ok: true, service: 'engagement-worker' })
    }

    if (url.pathname === '/api/comments' && request.method === 'GET') {
      return handleCommentThreadGet(request, env, ctx)
    }

    if (url.pathname === '/api/comments' && request.method === 'POST') {
      return handleCommentCreate(request, env, ctx)
    }

    if (commentMutationRoute.test(url.pathname) && (request.method === 'PATCH' || request.method === 'DELETE')) {
      return handleCommentMutationBoundary(request)
    }

    if (postEngagementRoute.test(url.pathname) && request.method === 'GET') {
      return handlePostEngagementGet(request, env)
    }

    if (postReactionRoute.test(url.pathname) && request.method === 'POST') {
      return handlePostReactionMutation(request, env)
    }

    if (postEmojiRoute.test(url.pathname) && request.method === 'POST') {
      return proxyRequest(request, env, url.pathname, {
        method: 'POST',
        headers: request.headers,
        body: request.body,
      })
    }

    return jsonResponse({ error: 'Not found' }, { status: 404 })
  },
} satisfies ExportedHandler<Cloudflare.Env>

export default worker