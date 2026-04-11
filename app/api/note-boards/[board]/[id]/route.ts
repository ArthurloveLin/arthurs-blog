import { NextRequest, NextResponse } from 'next/server'
import { deleteBoardMessage, isNoteBoardSlug } from '@/lib/note-boards'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ board: string; id: string }> },
) {
  const { board, id } = await params
  if (!isNoteBoardSlug(board)) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))

  try {
    await deleteBoardMessage(board, id, body.identity as string | undefined)
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
