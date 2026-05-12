import { NextRequest, NextResponse } from 'next/server'
import { getBoardMessages } from '@/lib/note-boards'
import { normalizeSearchQuery, SEARCH_MIN_QUERY_LENGTH } from '@/lib/blog-search'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const q = normalizeSearchQuery(searchParams.get('q') ?? '')
  const limit = Math.min(Math.max(Number.parseInt(searchParams.get('limit') ?? '6', 10), 1), 12)

  if (q.length < SEARCH_MIN_QUERY_LENGTH) {
    return NextResponse.json({ results: [] })
  }

  try {
    const messages = await getBoardMessages('memo', limit, 0, false, 'time', null, q)
    return NextResponse.json({
      results: messages.map((m) => ({
        id: m.id,
        content: m.content,
        created_at: m.created_at,
      })),
    }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch {
    return NextResponse.json({ results: [] }, { status: 500 })
  }
}
