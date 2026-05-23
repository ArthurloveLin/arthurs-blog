import { NextResponse } from 'next/server'
import { getCurrentUser, getUserRole } from '@/lib/auth'
import { getMemoHabitOverview } from '@/lib/memo-habits-server'

const EMPTY_OVERVIEW = {
  summary: {
    completedToday: 0,
    currentStreak: 0,
    completionRate7d: 0,
    missedThisWeek: 0,
    delayedThisWeek: 0,
  },
  currentStates: {},
  daySummaries: [],
  recentEvents: [],
}

export async function GET() {
  const currentUser = await getCurrentUser()
  const ownerUserId = currentUser?.id ?? process.env.MEMO_PUBLIC_OWNER_ID ?? null
  if (!ownerUserId) {
    return NextResponse.json(EMPTY_OVERVIEW)
  }

  const role = await getUserRole()
  const showAdminOnly = role === 'admin' && currentUser?.id != null

  try {
    const overview = await getMemoHabitOverview(ownerUserId, showAdminOnly)
    return NextResponse.json(overview, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch {
    return NextResponse.json(EMPTY_OVERVIEW, { status: 500 })
  }
}