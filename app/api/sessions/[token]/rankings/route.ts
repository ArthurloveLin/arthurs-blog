import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

interface RankingPayload {
  championId?: string
  runnerUpId?: string
  thirdPlaceId?: string | null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { token } = await params
  const body = await request.json() as RankingPayload
  const { championId, runnerUpId, thirdPlaceId } = body

  if (!championId || !runnerUpId) {
    return NextResponse.json({ error: 'Champion and runner-up are required' }, { status: 400 })
  }

  const rankingIds = [championId, runnerUpId, thirdPlaceId].filter((value): value is string => Boolean(value))
  if (new Set(rankingIds).size !== rankingIds.length) {
    return NextResponse.json({ error: 'Each rank must belong to a different item' }, { status: 400 })
  }

  const { data: session, error: sessionError } = await supabaseAdmin
    .from('sessions')
    .select('id')
    .eq('token', token)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const { data: rankedItems, error: rankedItemsError } = await supabaseAdmin
    .from('items')
    .select('id')
    .eq('session_id', session.id)
    .in('id', rankingIds)

  if (rankedItemsError) {
    return NextResponse.json({ error: rankedItemsError.message }, { status: 500 })
  }

  if ((rankedItems ?? []).length !== rankingIds.length) {
    return NextResponse.json({ error: 'Ranking items must belong to the current session' }, { status: 400 })
  }

  const { error: clearError } = await supabaseAdmin
    .from('items')
    .update({ rank: null })
    .eq('session_id', session.id)

  if (clearError) {
    return NextResponse.json({ error: clearError.message }, { status: 500 })
  }

  const updates = [
    { id: championId, rank: 1 },
    { id: runnerUpId, rank: 2 },
    ...(thirdPlaceId ? [{ id: thirdPlaceId, rank: 3 }] : []),
  ]

  const updateResults = await Promise.all(
    updates.map(async ({ id, rank }) => {
      const { error } = await supabaseAdmin
        .from('items')
        .update({ rank })
        .eq('id', id)
        .eq('session_id', session.id)

      return { id, rank, error }
    })
  )

  const failedUpdate = updateResults.find((result) => result.error)
  if (failedUpdate?.error) {
    return NextResponse.json({ error: failedUpdate.error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}