import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PUT(req: NextRequest) {
  const { item_id, author, score, appearance_score, practicality_score, value_score } = await req.json()

  if (!item_id || !author) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // 计算综合分：若三维都有值则取平均，否则用传入的 score
  let finalScore = score
  if (
    appearance_score != null &&
    practicality_score != null &&
    value_score != null
  ) {
    finalScore = Math.round(((appearance_score + practicality_score + value_score) / 3) * 10) / 10
  }

  if (finalScore == null) {
    return NextResponse.json({ error: 'Missing score' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('ratings')
    .upsert(
      { item_id, author, score: finalScore, appearance_score, practicality_score, value_score },
      { onConflict: 'item_id,author' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
