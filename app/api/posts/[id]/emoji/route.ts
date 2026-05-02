import { NextRequest, NextResponse } from 'next/server'
import { applyPostEmojiReaction } from '@/lib/post-reactions'
import { normalizePostReactionIdentity } from '@/lib/post-reaction-core'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const identity = normalizePostReactionIdentity(body.identity)
  const emoji = typeof body.emoji === 'string' ? body.emoji : null

  if (!identity) {
    return NextResponse.json({ error: 'Missing identity' }, { status: 400 })
  }

  try {
    const summary = await applyPostEmojiReaction(id, identity, emoji)
    return NextResponse.json(summary)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update emoji reaction'
    if (message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (message === 'MISSING_IDENTITY') {
      return NextResponse.json({ error: 'Missing identity' }, { status: 400 })
    }

    if (message === 'INVALID_EMOJI') {
      return NextResponse.json({ error: 'Invalid emoji' }, { status: 400 })
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}