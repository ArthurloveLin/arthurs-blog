import { NextResponse } from 'next/server'
import { getMemoDateCounts } from '@/lib/note-boards'
import { getCurrentUser, getUserRole } from '@/lib/auth'

export async function GET() {
  const currentUser = await getCurrentUser()
  const ownerUserId = currentUser?.id ?? process.env.MEMO_PUBLIC_OWNER_ID ?? null
  if (!ownerUserId) return NextResponse.json([])

  const role = await getUserRole()
  const showAdminOnly = role === 'admin' && currentUser?.id != null

  try {
    const dates = await getMemoDateCounts(ownerUserId, showAdminOnly)
    return NextResponse.json(dates, {
      headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=600' },
    })
  } catch {
    return NextResponse.json([])
  }
}
