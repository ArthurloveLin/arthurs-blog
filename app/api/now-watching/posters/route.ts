import { type NextRequest, NextResponse } from 'next/server'
import { getPagedNowWatchingPosters } from '@/lib/now-watching'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)

  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const perPage = Math.min(30, Math.max(1, parseInt(url.searchParams.get('perPage') ?? '9', 10)))

  const result = await getPagedNowWatchingPosters(page, perPage)

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
    },
  })
}
