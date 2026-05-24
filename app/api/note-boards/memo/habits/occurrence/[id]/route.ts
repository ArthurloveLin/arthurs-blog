import { NextRequest, NextResponse } from 'next/server'
import { deleteMemoHabitOccurrence } from '@/lib/memo-habits-server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'Missing occurrence id' }, { status: 400 })
  }

  try {
    await deleteMemoHabitOccurrence(id)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete occurrence'
    if (message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
