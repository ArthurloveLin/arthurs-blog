import { env, runInDurableObject } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'

// Not type-checked (outside tsconfig src); declared for editor hints only.
declare module 'cloudflare:test' {
  interface ProvidedEnv {
    COMMENT_RATE_LIMITER: DurableObjectNamespace
  }
}

interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
  retryAfterSeconds: number
}

// Each test uses a unique DO name → isolated storage, no cross-test bleed.
async function check(name: string, payload: Record<string, unknown> = {}): Promise<RateLimitResult> {
  const stub = env.COMMENT_RATE_LIMITER.getByName(name)
  const res = await stub.fetch('https://rate-limit/check', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.json() as Promise<RateLimitResult>
}

describe('CommentRateLimiterDurableObject', () => {
  it('allows up to maxRequests, then rejects with a retry hint', async () => {
    const r1 = await check('allow-reject', { maxRequests: 2, windowMs: 60_000 })
    expect(r1.allowed).toBe(true)
    expect(r1.remaining).toBe(1)

    const r2 = await check('allow-reject', { maxRequests: 2, windowMs: 60_000 })
    expect(r2.allowed).toBe(true)
    expect(r2.remaining).toBe(0)

    const r3 = await check('allow-reject', { maxRequests: 2, windowMs: 60_000 })
    expect(r3.allowed).toBe(false)
    expect(r3.remaining).toBe(0)
    // ceil((resetAt-now)/1000), clamped to >= 1, within the 60s window
    expect(r3.retryAfterSeconds).toBeGreaterThanOrEqual(1)
    expect(r3.retryAfterSeconds).toBeLessThanOrEqual(60)
  })

  it('clamps maxRequests up to a floor of 1', async () => {
    // maxRequests:0 → clamped to 1 → first allowed, second rejected
    const r1 = await check('clamp-max', { maxRequests: 0, windowMs: 60_000 })
    expect(r1.allowed).toBe(true)
    expect(r1.limit).toBe(1)

    const r2 = await check('clamp-max', { maxRequests: 0, windowMs: 60_000 })
    expect(r2.allowed).toBe(false)
  })

  it('clamps windowMs up to a 1s floor (sub-second windows do not auto-expire)', async () => {
    // windowMs:10 → clamped to 1000ms; the immediate second call is still in-window.
    const r1 = await check('clamp-window', { maxRequests: 1, windowMs: 10 })
    expect(r1.allowed).toBe(true)
    const r2 = await check('clamp-window', { maxRequests: 1, windowMs: 10 })
    expect(r2.allowed).toBe(false)
    expect(r2.retryAfterSeconds).toBe(1)
  })

  it('uses the default limit of 5 when no payload is given', async () => {
    let last: RateLimitResult | null = null
    for (let i = 0; i < 5; i++) last = await check('defaults')
    expect(last?.allowed).toBe(true)
    expect(last?.limit).toBe(5)
    expect(last?.remaining).toBe(0)
    expect((await check('defaults')).allowed).toBe(false)
  })

  it('rejects non-POST methods with 405', async () => {
    const stub = env.COMMENT_RATE_LIMITER.getByName('method-guard')
    const res = await stub.fetch('https://rate-limit/check', { method: 'GET' })
    expect(res.status).toBe(405)
  })

  it('resets the counter when the alarm fires', async () => {
    await check('alarm-reset', { maxRequests: 1, windowMs: 60_000 })
    expect((await check('alarm-reset', { maxRequests: 1, windowMs: 60_000 })).allowed).toBe(false)

    const stub = env.COMMENT_RATE_LIMITER.getByName('alarm-reset')
    await runInDurableObject(stub, async (instance: { alarm: () => Promise<void> }) => {
      await instance.alarm()
    })

    // Counter deleted → fresh window, request allowed again.
    expect((await check('alarm-reset', { maxRequests: 1, windowMs: 60_000 })).allowed).toBe(true)
  })
})
