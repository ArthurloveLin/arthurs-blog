import { NextRequest, NextResponse } from 'next/server'

type RangeKey = '7d' | '30d'

type TokenCache = {
  token: string
  expiresAt: number
}

let tokenCache: TokenCache | null = null
const UPSTREAM_TIMEOUT_MS = 5000
const UPSTREAM_RETRIES = 1

const RANGE_DAYS: Record<RangeKey, number> = {
  '7d': 7,
  '30d': 30,
}

function getRangeDays(range: string | null): { range: RangeKey; days: number } {
  if (range === '30d') {
    return { range: '30d', days: RANGE_DAYS['30d'] }
  }

  return { range: '7d', days: RANGE_DAYS['7d'] }
}

function getBaseConfig() {
  const endpoint = process.env.UMAMI_ENDPOINT
  const websiteId = process.env.UMAMI_WEBSITE_ID

  if (!endpoint || !websiteId) {
    return {
      error: 'UMAMI_ENDPOINT or UMAMI_WEBSITE_ID is not configured on server.',
    }
  }

  return {
    endpoint: endpoint.replace(/\/$/, ''),
    websiteId,
  }
}

async function getAuthToken(endpoint: string) {
  const staticToken = process.env.UMAMI_API_TOKEN
  if (staticToken) {
    return staticToken
  }

  const now = Date.now()
  if (tokenCache && tokenCache.expiresAt > now) {
    return tokenCache.token
  }

  const username = process.env.UMAMI_USERNAME
  const password = process.env.UMAMI_PASSWORD

  if (!username || !password) {
    throw new Error('Missing UMAMI_API_TOKEN or UMAMI_USERNAME/UMAMI_PASSWORD in server environment.')
  }

  let loginData: { token?: string } | null = null

  for (let attempt = 0; attempt <= UPSTREAM_RETRIES; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

    try {
      const loginResponse = await fetch(`${endpoint}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
        cache: 'no-store',
        signal: controller.signal,
      })

      if (!loginResponse.ok) {
        if (loginResponse.status >= 500 && attempt < UPSTREAM_RETRIES) {
          continue
        }

        throw new Error(`Umami login failed: ${loginResponse.status}`)
      }

      loginData = await loginResponse.json() as { token?: string }
      break
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError'
      const isLastAttempt = attempt === UPSTREAM_RETRIES

      if (!isAbort && isLastAttempt) {
        throw error
      }

      if (isAbort && isLastAttempt) {
        throw new Error('Umami login timed out.')
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  if (!loginData) {
    throw new Error('Umami login failed after retries.')
  }

  if (!loginData.token) {
    throw new Error('Umami login succeeded but no token returned.')
  }

  tokenCache = {
    token: loginData.token,
    expiresAt: now + 10 * 60 * 1000,
  }

  return loginData.token
}

async function fetchUmami<T>(
  endpoint: string,
  token: string,
  path: string,
  query: Record<string, string>,
): Promise<T> {
  const search = new URLSearchParams(query)

  for (let attempt = 0; attempt <= UPSTREAM_RETRIES; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

    try {
      const response = await fetch(`${endpoint}/api${path}?${search.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
        signal: controller.signal,
      })

      if (!response.ok) {
        if (response.status >= 500 && attempt < UPSTREAM_RETRIES) {
          continue
        }

        throw new Error(`Umami API request failed (${response.status}) at ${path}`)
      }

      return response.json() as Promise<T>
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError'
      const isLastAttempt = attempt === UPSTREAM_RETRIES

      if (!isAbort && isLastAttempt) {
        throw error
      }

      if (isAbort && isLastAttempt) {
        throw new Error(`Umami API timeout at ${path}`)
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  throw new Error(`Umami API request failed after retries at ${path}`)
}

export async function GET(request: NextRequest) {
  const cfg = getBaseConfig()

  if ('error' in cfg) {
    return NextResponse.json({ error: cfg.error }, { status: 500 })
  }

  try {
    const { range, days } = getRangeDays(request.nextUrl.searchParams.get('range'))
    const timezone = request.nextUrl.searchParams.get('timezone') || 'Asia/Shanghai'

    const endAt = Date.now()
    const startAt = endAt - days * 24 * 60 * 60 * 1000

    const token = await getAuthToken(cfg.endpoint)

    const commonQuery = {
      startAt: String(startAt),
      endAt: String(endAt),
      unit: 'day',
      timezone,
    }

    const [statsResult, activeVisitorsResult, pageviewsResult] = await Promise.allSettled([
      fetchUmami<{
        pageviews: number
        visitors: number
        visits: number
        bounces: number
        totaltime: number
      }>(cfg.endpoint, token, `/websites/${cfg.websiteId}/stats`, commonQuery),
      fetchUmami<{ x: number }>(cfg.endpoint, token, `/websites/${cfg.websiteId}/active`, {}),
      fetchUmami<{
        pageviews: Array<{ x: string; y: number }>
        sessions: Array<{ x: string; y: number }>
      }>(cfg.endpoint, token, `/websites/${cfg.websiteId}/pageviews`, commonQuery),
    ])

    const warnings: string[] = []

    const stats = statsResult.status === 'fulfilled' ? statsResult.value : null
    if (!stats) warnings.push(`stats: ${String(statsResult.status === 'rejected' ? statsResult.reason : 'unknown error')}`)

    const activeVisitors = activeVisitorsResult.status === 'fulfilled' ? (activeVisitorsResult.value?.x ?? 0) : 0
    if (activeVisitorsResult.status === 'rejected') {
      warnings.push(`active: ${String(activeVisitorsResult.reason)}`)
    }

    const pageviewsData = pageviewsResult.status === 'fulfilled' ? pageviewsResult.value : { pageviews: [], sessions: [] }
    if (pageviewsResult.status === 'rejected') {
      warnings.push(`pageviews: ${String(pageviewsResult.reason)}`)
    }

    if (!stats && activeVisitorsResult.status === 'rejected' && pageviewsResult.status === 'rejected') {
      return NextResponse.json(
        {
          error: 'All upstream analytics requests failed.',
          warnings,
        },
        { status: 502 },
      )
    }

    return NextResponse.json(
      {
        range,
        startAt,
        endAt,
        partial: warnings.length > 0,
        warnings,
        summary: {
          pageviews: stats?.pageviews ?? 0,
          visitors: stats?.visitors ?? 0,
          visits: stats?.visits ?? 0,
          realtime: activeVisitors,
        },
        trend: pageviewsData.pageviews,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        },
      },
    )
  } catch (error) {
    console.error('Failed to load Umami analytics overview:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch analytics data from Umami.',
      },
      { status: 502 },
    )
  }
}
