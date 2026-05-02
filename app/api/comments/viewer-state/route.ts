import { NextRequest, NextResponse } from 'next/server'
import { getCommentViewerState } from '@/lib/comments'
import { normalizeReactionIdentity } from '@/lib/comment-reactions'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const targetType = searchParams.get('target_type')
  const targetId = searchParams.get('target_id')
  const identity = normalizeReactionIdentity(searchParams.get('identity'))

  if (!targetType || !targetId) {
    return NextResponse.json({ error: 'Missing target_type or target_id' }, { status: 400 })
  }

  if (!identity) {
    return NextResponse.json({ error: 'Missing identity' }, { status: 400 })
  }

  try {
    return NextResponse.json(await getCommentViewerState(targetType, targetId, identity))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load comment viewer state' },
      { status: 500 },
    )
  }
}