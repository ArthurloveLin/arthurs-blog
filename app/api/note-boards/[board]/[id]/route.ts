import { NextRequest, NextResponse } from 'next/server'
import { createCommentRecord, type Comment } from '@/lib/comments'
import { fetchCommentWorker } from '@/lib/comment-worker'
import { isNotePriority, normalizeNotePriority } from '@/lib/note-priority'
import { createGuestbookNoteMessage, deleteBoardMessage, isNoteBoardSlug, updateBoardMessage } from '@/lib/note-boards'

function getResponseErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
    return payload.error
  }

  return fallback
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ board: string; id: string }> },
) {
  const { board, id } = await params
  if (!isNoteBoardSlug(board)) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const identities = Array.isArray(body.identities)
    ? body.identities.filter((value: unknown): value is string => typeof value === 'string')
    : undefined

  if (board === 'guestbook') {
    const response = await fetchCommentWorker(`/api/comments/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: body.identity,
        identities,
      }),
      cache: 'no-store',
    })

    if (response && response.status !== 404) {
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        return NextResponse.json(
          { error: getResponseErrorMessage(payload, 'Failed to delete note') },
          { status: response.status },
        )
      }

      return new NextResponse(null, { status: 204 })
    }
  }

  try {
    await deleteBoardMessage(board, id, identities ?? (body.identity as string | undefined))
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete note'
    if (message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ board: string; id: string }> },
) {
  const { board, id } = await params
  if (!isNoteBoardSlug(board)) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const content = typeof body.content === 'string' ? body.content.trim() : undefined
  const archived = typeof body.archived === 'boolean' ? body.archived : undefined
  const hasPriority = typeof body.priority !== 'undefined'
  const rawPriority = hasPriority
    ? (typeof body.priority === 'string' ? Number.parseInt(body.priority, 10) : body.priority)
    : undefined
  const priority = hasPriority && isNotePriority(rawPriority) ? normalizeNotePriority(rawPriority) : undefined
  const identities = Array.isArray(body.identities)
    ? body.identities.filter((value: unknown): value is string => typeof value === 'string')
    : undefined

  if (content === '' || (content === undefined && archived === undefined && priority === undefined)) {
    return NextResponse.json({ error: content === '' ? 'Missing content' : 'Missing patch' }, { status: 400 })
  }

  if (hasPriority && !isNotePriority(priority)) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
  }

  if (board === 'guestbook' && typeof archived === 'undefined' && typeof content === 'string') {
    const response = await fetchCommentWorker(`/api/comments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: body.identity,
        identities,
        content,
      }),
      cache: 'no-store',
    })

    if (response && response.status !== 404) {
      const payload = await response.json().catch(() => null) as Record<string, unknown> | null

      if (!response.ok) {
        return NextResponse.json(
          { error: getResponseErrorMessage(payload, 'Failed to update note') },
          { status: response.status },
        )
      }

      if (!payload) {
        return NextResponse.json({ error: 'Invalid engagement response' }, { status: 502 })
      }

      return NextResponse.json(createGuestbookNoteMessage(createCommentRecord(payload as unknown as Comment), false))
    }
  }

  try {
    const message = await updateBoardMessage(
      board,
      id,
      { content, archived, priority },
      identities ?? (body.identity as string | undefined),
    )
    return NextResponse.json(message)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update note'
    if (message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (message === 'INVALID_PRIORITY') {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
    }
    if (message === 'MISSING_CONTENT' || message === 'MISSING_PATCH' || message === 'CONTENT_TOO_LONG') {
      return NextResponse.json({ error: message === 'CONTENT_TOO_LONG' ? 'Content too long' : 'Missing patch' }, { status: 400 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
