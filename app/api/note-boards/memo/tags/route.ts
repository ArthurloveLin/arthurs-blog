import { NextResponse } from 'next/server'
import { getMemoTagCounts } from '@/lib/note-boards'
import { getCurrentUser, getUserRole } from '@/lib/auth'

export async function GET() {
  const currentUser = await getCurrentUser()
  const ownerUserId = currentUser?.id ?? process.env.MEMO_PUBLIC_OWNER_ID ?? null
  if (!ownerUserId) return NextResponse.json([])

  const role = await getUserRole()
  const showAdminOnly = role === 'admin' && currentUser?.id != null

  try {
    const tags = await getMemoTagCounts(ownerUserId, showAdminOnly)
    return NextResponse.json(tags, {
      headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=600' },
    })
  } catch {
    return NextResponse.json([])
  }
}
