import { NextRequest, NextResponse } from 'next/server'
import { fetchUmami, getUmamiAuthToken, getUmamiConfig } from '@/lib/umami'

type RangeKey = '7d' | '30d'

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

export async function GET(request: NextRequest) {
  const cfg = getUmamiConfig()

  if ('error' in cfg) {
    return NextResponse.json({ error: cfg.error }, { status: 500 })
  }

  try {
    const { range, days } = getRangeDays(request.nextUrl.searchParams.get('range'))
    const timezone = request.nextUrl.searchParams.get('timezone') || 'Asia/Shanghai'

    const endAt = Date.now()
    const startAt = endAt - days * 24 * 60 * 60 * 1000

    const token = await getUmamiAuthToken(cfg.endpoint)

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
