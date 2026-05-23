import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, getUserRole } from '@/lib/auth'
import { getMemoHabitItemDetail } from '@/lib/memo-habits-server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const noteId = searchParams.get('note_id')
  const itemKey = searchParams.get('item_key')

  if (!noteId || !itemKey) {
    return NextResponse.json({ error: 'Missing note_id or item_key' }, { status: 400 })
  }

  const currentUser = await getCurrentUser()
  const ownerUserId = currentUser?.id ?? process.env.MEMO_PUBLIC_OWNER_ID ?? null
  if (!ownerUserId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const role = await getUserRole()
  const showAdminOnly = role === 'admin' && currentUser?.id != null

  try {
    const detail = await getMemoHabitItemDetail(noteId, itemKey, ownerUserId, showAdminOnly)
    return NextResponse.json(detail, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load habit item'
    return NextResponse.json({ error: message === 'NOT_FOUND' ? 'Not found' : message }, { status: message === 'NOT_FOUND' ? 404 : 500 })
  }
}