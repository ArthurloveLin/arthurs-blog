import { NextRequest, NextResponse } from 'next/server'
import { fetchUmami, getUmamiAuthToken, getUmamiConfig } from '@/lib/umami'

export async function GET(request: NextRequest) {
  const cfg = getUmamiConfig()

  if ('error' in cfg) {
    return NextResponse.json({ error: cfg.error }, { status: 500 })
  }

  const path = request.nextUrl.searchParams.get('path')?.trim() || request.nextUrl.searchParams.get('url')?.trim()

  if (!path) {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 })
  }

  try {
    const token = await getUmamiAuthToken(cfg.endpoint)
    const endAt = Date.now()
    const startAt = endAt - 365 * 24 * 60 * 60 * 1000

    const stats = await fetchUmami<{
      pageviews: number
      visitors: number
      visits: number
      totaltime: number
    }>(cfg.endpoint, token, `/websites/${cfg.websiteId}/stats`, {
      startAt: String(startAt),
      endAt: String(endAt),
      unit: 'day',
      timezone: 'Asia/Shanghai',
      path,
    })

    return NextResponse.json(
      {
        pageviews: stats.pageviews ?? 0,
        visitors: stats.visitors ?? 0,
        visits: stats.visits ?? 0,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800',
        },
      },
    )
  } catch (error) {
    console.error('Failed to load article analytics:', error)
    return NextResponse.json({ error: 'Failed to fetch article analytics.' }, { status: 502 })
  }
}