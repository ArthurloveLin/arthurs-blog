import { NextRequest, NextResponse } from 'next/server'
import { delayMemoHabitOccurrence } from '@/lib/memo-habits-server'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const noteId = typeof body.note_id === 'string' ? body.note_id : ''
  const itemKey = typeof body.item_key === 'string' ? body.item_key : ''
  const delayUntil = typeof body.delay_until === 'string' ? body.delay_until : ''

  if (!noteId || !itemKey || !delayUntil) {
    return NextResponse.json({ error: 'Missing note_id, item_key or delay_until' }, { status: 400 })
  }

  try {
    const detail = await delayMemoHabitOccurrence(noteId, itemKey, delayUntil)
    return NextResponse.json(detail)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delay habit occurrence'
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (message === 'INVALID_DELAY') {
      return NextResponse.json({ error: 'Invalid delay_until' }, { status: 400 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}