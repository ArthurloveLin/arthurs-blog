import { NextResponse } from 'next/server'
import { getMemoAgendaItems } from '@/lib/note-boards'
import { getCurrentUser, getUserRole } from '@/lib/auth'

export async function GET() {
  const currentUser = await getCurrentUser()
  const ownerUserId = currentUser?.id ?? process.env.MEMO_PUBLIC_OWNER_ID ?? null
  if (!ownerUserId) return NextResponse.json([])

  const role = await getUserRole()
  const showAdminOnly = role === 'admin' && currentUser?.id != null

  try {
    const items = await getMemoAgendaItems(ownerUserId, showAdminOnly)
    return NextResponse.json(items, {
      headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' },
    })
  } catch {
    return NextResponse.json([])
  }
}
