import { NextRequest, NextResponse } from 'next/server'
import { applyPostReaction } from '@/lib/post-reactions'
import { normalizeReactionIdentity, normalizeReactionValue } from '@/lib/comment-reactions'
import { sendNtfy } from '@/lib/ntfy'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const identity = normalizeReactionIdentity(body.identity)
  const reaction = normalizeReactionValue(body.reaction)

  if (!identity) {
    return NextResponse.json({ error: 'Missing identity' }, { status: 400 })
  }

  try {
    const summary = await applyPostReaction(id, identity, reaction)
    if (reaction === 1) {
      sendNtfy('blog-reactions', '新点赞', `Post: ${id}`, { tags: ['+1'], priority: 2 }).catch(() => {})
    }
    return NextResponse.json(summary)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update reaction'
    if (message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (message === 'MISSING_IDENTITY') {
      return NextResponse.json({ error: 'Missing identity' }, { status: 400 })
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}