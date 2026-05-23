import { NextRequest, NextResponse } from 'next/server'
import { completeMemoHabitOccurrence } from '@/lib/memo-habits-server'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const noteId = typeof body.note_id === 'string' ? body.note_id : ''
  const itemKey = typeof body.item_key === 'string' ? body.item_key : ''

  if (!noteId || !itemKey) {
    return NextResponse.json({ error: 'Missing note_id or item_key' }, { status: 400 })
  }

  try {
    const detail = await completeMemoHabitOccurrence(noteId, itemKey)
    return NextResponse.json(detail)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to complete habit occurrence'
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}