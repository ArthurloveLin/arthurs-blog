import { NextRequest, NextResponse } from 'next/server'
import { applyCommentReaction, normalizeReactionIdentity, normalizeReactionValue } from '@/lib/comment-reactions'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const identity = normalizeReactionIdentity(body.identity)
  const reaction = normalizeReactionValue(body.reaction)

  if (!identity) {
    return NextResponse.json({ error: 'Missing identity' }, { status: 400 })
  }

  try {
    const summary = await applyCommentReaction(id, identity, reaction)
    return NextResponse.json(summary)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update reaction'
    if (message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    if (message === 'MISSING_IDENTITY') {
      return NextResponse.json({ error: 'Missing identity' }, { status: 400 })
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}