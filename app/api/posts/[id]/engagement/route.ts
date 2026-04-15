import { NextRequest, NextResponse } from 'next/server'
import { getPostReactionSummary } from '@/lib/post-reactions'
import { normalizeReactionIdentity } from '@/lib/comment-reactions'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const identity = normalizeReactionIdentity(req.nextUrl.searchParams.get('identity'))

  try {
    const summary = await getPostReactionSummary(id, identity)
    return NextResponse.json(summary)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load engagement summary'
    if (message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}