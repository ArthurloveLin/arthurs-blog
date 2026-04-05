import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PUT(req: NextRequest) {
  const { item_id, author, score, ...restScores } = await req.json()

  if (!item_id || !author) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // 这里的 restScores 可能包含 appearance_score, taste_score 等等
  // 我们统一存入 scores 字段，并同步更新旧有的三维字段（为了向前兼容）
  const scores = { ...restScores }
  
  // 从 scores 中提取所有数值并计算平均分作为最终综合分
  const scoreValues = Object.values(scores).filter((v) => typeof v === 'number') as number[]
  let finalScore = score
  if (scoreValues.length > 0) {
    finalScore = Number((scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length).toFixed(1))
  }

  if (finalScore == null) {
    return NextResponse.json({ error: 'Missing score' }, { status: 400 })
  }

  // 构建 upsert 数据，兼容旧字段
  const upsertData: Record<string, unknown> = {
    item_id,
    author,
    score: finalScore,
    scores,
    // 向前兼容旧字段（如果存在于 scores 中）
    appearance_score: scores.appearance_score || null,
    practicality_score: scores.practicality_score || null,
    value_score: scores.value_score || null,
  }

  const { data, error } = await supabaseAdmin
    .from('ratings')
    .upsert(upsertData, { onConflict: 'item_id,author' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
