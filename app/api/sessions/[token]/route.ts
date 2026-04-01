import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const { data: session, error: sessionError } = await supabaseAdmin
    .from('sessions')
    .select('*')
    .eq('token', token)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const { data: items, error: itemsError } = await supabaseAdmin
    .from('items')
    .select(`
      *,
      ratings(score, author),
      comments(id)
    `)
    .eq('session_id', session.id)
    .order('created_at', { ascending: true })

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  const itemsWithAvg = (items ?? []).map((item) => {
    const scores = (item.ratings as { score: number }[] ?? []).map((r) => r.score)
    const avgScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null
    return {
      ...item,
      avgScore,
      commentCount: (item.comments as unknown[])?.length ?? 0,
    }
  })

  return NextResponse.json({ session, items: itemsWithAvg })
}
