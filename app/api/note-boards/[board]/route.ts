import { NextRequest, NextResponse } from 'next/server'
import { createCommentRecord, type Comment } from '@/lib/comments'
import { fetchCommentWorker } from '@/lib/comment-worker'
import { normalizeReactionIdentity } from '@/lib/comment-reactions'
import { isNotePriority, isNoteSortMode } from '@/lib/note-priority'
import {
  createBoardMessage,
  createGuestbookNoteMessage,
  getBoardMessages,
  getNoteBoardConfig,
  isNoteBoardSlug,
} from '@/lib/note-boards'

function getResponseErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
    return payload.error
  }

  return fallback
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ board: string }> },
) {
  const { board } = await params
  if (!isNoteBoardSlug(board)) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 })
  }

  const config = getNoteBoardConfig(board)
  const { searchParams } = new URL(req.url)
  const rawLimit = Number.parseInt(searchParams.get('limit') ?? '', 10)
  const rawOffset = Number.parseInt(searchParams.get('offset') ?? '', 10)
  const archived = searchParams.get('archived') === '1'
  const rawSort = searchParams.get('sort')
  const identity = normalizeReactionIdentity(searchParams.get('identity'))
  const sort = isNoteSortMode(rawSort) ? rawSort : 'time'
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), config?.pageSize ?? 24) : config?.initialPageLimit ?? 48
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0

  try {
    const messages = await getBoardMessages(board, limit, offset, archived, sort, identity)
    return NextResponse.json({ messages, nextOffset: offset + messages.length, hasMore: messages.length === limit })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load board' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ board: string }> },
) {
  const { board } = await params
  if (!isNoteBoardSlug(board)) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const author = typeof body.author === 'string' ? body.author : ''
  const content = typeof body.content === 'string' ? body.content : ''
  const rawPriority = body.priority
  const priority = rawPriority === undefined ? undefined : Number(rawPriority)

  if (!author.trim() || !content.trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  if (priority !== undefined && !isNotePriority(priority)) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
  }

  if (board === 'guestbook') {
    const config = getNoteBoardConfig(board)
    const response = await fetchCommentWorker('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_type: config.targetType,
        target_id: config.targetId,
        author: author.trim(),
        content: content.trim(),
        parent_id: null,
      }),
      cache: 'no-store',
    })

    if (response) {
      const payload = await response.json().catch(() => null) as Record<string, unknown> | null

      if (!response.ok) {
        return NextResponse.json(
          { error: getResponseErrorMessage(payload, 'Failed to create note') },
          { status: response.status },
        )
      }

      if (!payload) {
        return NextResponse.json({ error: 'Invalid engagement response' }, { status: 502 })
      }

      return NextResponse.json(createGuestbookNoteMessage(createCommentRecord(payload as unknown as Comment), false), { status: 201 })
    }
  }

  try {
    const message = await createBoardMessage(board, author, content, priority)
    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create note'
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (message === 'INVALID_PRIORITY') {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
    }
    if (message === 'MISSING_CONTENT' || message === 'CONTENT_TOO_LONG') {
      return NextResponse.json({ error: message === 'CONTENT_TOO_LONG' ? 'Content too long' : 'Missing content' }, { status: 400 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
