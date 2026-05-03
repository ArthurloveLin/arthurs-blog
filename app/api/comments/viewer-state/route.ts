import { NextRequest, NextResponse } from 'next/server'
import { getCommentViewerState } from '@/lib/comments-server'
import { normalizeReactionIdentity } from '@/lib/comment-reactions'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const targetType = searchParams.get('target_type')?.trim() ?? ''
  const targetId = searchParams.get('target_id')?.trim() ?? ''
  const identity = normalizeReactionIdentity(searchParams.get('identity'))

  if (!targetType || !targetId) {
    return NextResponse.json({ error: 'Missing target_type or target_id' }, { status: 400 })
  }

  if (!identity) {
    return NextResponse.json([])
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