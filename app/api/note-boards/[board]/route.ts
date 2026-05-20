import { NextRequest, NextResponse } from 'next/server'
import { normalizeReactionIdentity } from '@/lib/comment-reactions'
import { isNotePriority, isNoteSortDirection, isNoteSortMode } from '@/lib/note-priority'
import {
  createBoardMessage,
  getBoardMessages,
  getNoteBoardConfig,
  isNoteBoardSlug,
} from '@/lib/note-boards'
import { getCurrentUser } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ board: string }> },
) {
  const { board } = await params
  if (!isNoteBoardSlug(board)) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 })
  }

  if (board === 'guestbook') {
    return NextResponse.json({ error: 'Guestbook reads moved to /api/comments' }, { status: 410 })
  }

  const config = getNoteBoardConfig(board)
  const { searchParams } = new URL(req.url)
  const rawLimit = Number.parseInt(searchParams.get('limit') ?? '', 10)
  const rawOffset = Number.parseInt(searchParams.get('offset') ?? '', 10)
  const archived = searchParams.get('archived') === '1'
  const rawSort = searchParams.get('sort')
  const rawDirection = searchParams.get('direction')
  const identity = normalizeReactionIdentity(searchParams.get('identity'))
  const sort = isNoteSortMode(rawSort) ? rawSort : 'time'
  const sortDirection = isNoteSortDirection(rawDirection) ? rawDirection : 'desc'
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), config?.pageSize ?? 24) : config?.initialPageLimit ?? 48
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0
  const searchQuery = searchParams.get('q') ?? null
  const tagFilters = (searchParams.get('tag') ?? '').split(',').map((t) => t.trim()).filter(Boolean)
  const dateFilter = searchParams.get('date') ?? null
  const dueDateFilter = searchParams.get('due_date') ?? null

  const currentUser = await getCurrentUser()

  try {
    const messages = await getBoardMessages(board, limit, offset, archived, sort, sortDirection, identity, searchQuery, tagFilters, currentUser?.id ?? null, dateFilter, dueDateFilter)
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

  if (board === 'guestbook') {
    return NextResponse.json({ error: 'Guestbook writes moved to /api/comments' }, { status: 410 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const author = typeof body.author === 'string' ? body.author : ''
  const content = typeof body.content === 'string' ? body.content : ''
  const rawPriority = body.priority
  const priority = rawPriority === undefined ? undefined : Number(rawPriority)
  const visibility = body.visibility === 'admin_only' ? 'admin_only' as const : 'public' as const
  const dueAt = typeof body.due_at === 'string' && body.due_at ? body.due_at : null

  if (!author.trim() || !content.trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  if (priority !== undefined && !isNotePriority(priority)) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
  }

  const currentUser = await getCurrentUser()

  try {
    const message = await createBoardMessage(board, author, content, priority, visibility, dueAt, currentUser?.id ?? null)
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
