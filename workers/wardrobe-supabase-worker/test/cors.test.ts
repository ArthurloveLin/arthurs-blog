import { describe, it, expect } from 'vitest'

import { createCorsHeaders, resolveCorsOrigin } from '../src/index'

const req = (origin?: string) =>
  new Request('https://worker.example', origin ? { headers: { Origin: origin } } : undefined)

// Cloudflare.Env is an ambient worker type; a loose object suffices at runtime.
const env = (over: Record<string, unknown> = {}) => over as unknown as Cloudflare.Env

describe('resolveCorsOrigin', () => {
  it('returns the configured default when no Origin header is present', () => {
    expect(resolveCorsOrigin(req(), env())).toBe('https://arthurlovegrace.top')
  })

  it('echoes any origin when configured as "*"', () => {
    expect(resolveCorsOrigin(req('https://evil.com'), env({ CORS_ALLOW_ORIGIN: '*' }))).toBe('*')
  })

  it('reflects a matching origin and rejects a mismatch', () => {
    const e = env({ CORS_ALLOW_ORIGIN: 'https://app.example' })
    expect(resolveCorsOrigin(req('https://app.example'), e)).toBe('https://app.example')
    expect(resolveCorsOrigin(req('https://evil.example'), e)).toBeNull()
  })
})

describe('createCorsHeaders', () => {
  it('adds credentials + Vary only for a specific origin', () => {
    const specific = createCorsHeaders('https://app.example')
    expect(specific['Access-Control-Allow-Origin']).toBe('https://app.example')
    expect(specific['Access-Control-Allow-Credentials']).toBe('true')
    expect(specific['Vary']).toBe('Origin')

    const wildcard = createCorsHeaders('*')
    expect(wildcard['Access-Control-Allow-Credentials']).toBeUndefined()
    expect(wildcard['Vary']).toBeUndefined()
  })

  it('merges requested headers without duplicating defaults', () => {
    const headers = createCorsHeaders('*', 'X-Custom, content-type')
    const allow = headers['Access-Control-Allow-Headers']
    expect(allow).toContain('X-Custom')
    expect(allow).toContain('Content-Type')
    // 'content-type' requested but the default 'Content-Type' is kept (case-insensitive dedup)
    expect(allow.toLowerCase().split('content-type').length - 1).toBe(1)
  })
})
