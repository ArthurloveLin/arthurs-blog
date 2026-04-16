import { NextRequest, NextResponse } from 'next/server'
import { normalizeSearchQuery, SEARCH_MIN_QUERY_LENGTH } from '@/lib/blog-search'
import { searchPosts } from '@/lib/blog'

export async function GET(request: NextRequest) {
  const query = normalizeSearchQuery(request.nextUrl.searchParams.get('q') ?? '')
  const page = Number.parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10)
  const limit = Number.parseInt(request.nextUrl.searchParams.get('limit') ?? '6', 10)

  if (query.length < SEARCH_MIN_QUERY_LENGTH) {
    return NextResponse.json({ query, page: 1, limit, total: 0, results: [] })
  }

  try {
    const response = await searchPosts(query, page, limit)

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 },
    )
  }
}