import { NextRequest, NextResponse } from 'next/server'
import { deleteBoardMessage, isNoteBoardSlug, updateBoardMessage } from '@/lib/note-boards'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ board: string; id: string }> },
) {
  const { board, id } = await params
  if (!isNoteBoardSlug(board)) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const identities = Array.isArray(body.identities)
    ? body.identities.filter((value: unknown): value is string => typeof value === 'string')
    : undefined

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

  const body = await req.json().catch(() => ({}))
  const hasContent = typeof body.content === 'string'
  const content = hasContent ? body.content.trim() : undefined
  const archived = typeof body.archived === 'boolean' ? body.archived : undefined
  const identities = Array.isArray(body.identities)
    ? body.identities.filter((value: unknown): value is string => typeof value === 'string')
    : undefined

  if (content === '' || (content === undefined && archived === undefined)) {
    return NextResponse.json({ error: content === '' ? 'Missing content' : 'Missing patch' }, { status: 400 })
  }

  try {
    const message = await updateBoardMessage(
      board,
      id,
      { content, archived },
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
    if (message === 'MISSING_CONTENT' || message === 'MISSING_PATCH') {
      return NextResponse.json({ error: 'Missing patch' }, { status: 400 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
