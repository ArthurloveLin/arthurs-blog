import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Public anonymous voting endpoint (session-share MultiDimRating). Intentionally
// not auth-gated, but hardened so malformed input is rejected at the app layer
// (400) instead of reaching the DB (500) or polluting the `scores` jsonb. The
// rating scale is 1–5 (mirrors the ratings_*_score CHECK constraints).
const MIN_SCORE = 1
const MAX_SCORE = 5
const MAX_AUTHOR_LEN = 64
const MAX_DIMENSIONS = 12

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const { item_id, author, score, ...restScores } = body

  if (typeof item_id !== 'string' || !item_id.trim()) {
    return NextResponse.json({ error: 'Missing or invalid item_id' }, { status: 400 })
  }
  if (typeof author !== 'string' || !author.trim()) {
    return NextResponse.json({ error: 'Missing or invalid author' }, { status: 400 })
  }
  const authorName = author.trim()
  if (authorName.length > MAX_AUTHOR_LEN) {
    return NextResponse.json({ error: 'Author too long' }, { status: 400 })
  }

  // Keep only numeric dimension scores, each within the 1–5 scale. Non-numeric
  // junk is dropped (not stored in jsonb); out-of-range values are rejected.
  const dimEntries = Object.entries(restScores).filter(([, v]) => typeof v === 'number') as [string, number][]
  if (dimEntries.length > MAX_DIMENSIONS) {
    return NextResponse.json({ error: 'Too many score dimensions' }, { status: 400 })
  }
  for (const [, v] of dimEntries) {
    if (!Number.isFinite(v) || v < MIN_SCORE || v > MAX_SCORE) {
      return NextResponse.json(
        { error: `Scores must be numbers between ${MIN_SCORE} and ${MAX_SCORE}` },
        { status: 400 },
      )
    }
  }
  const scores: Record<string, number> = Object.fromEntries(dimEntries)

  // Final composite: average of the dimension scores, else an explicit `score`.
  let finalScore: number | null = null
  const scoreValues = Object.values(scores)
  if (scoreValues.length > 0) {
    finalScore = Number((scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length).toFixed(1))
  } else if (typeof score === 'number') {
    finalScore = score
  }

  if (finalScore == null) {
    return NextResponse.json({ error: 'Missing score' }, { status: 400 })
  }
  if (!Number.isFinite(finalScore) || finalScore < MIN_SCORE || finalScore > MAX_SCORE) {
    return NextResponse.json(
      { error: `Score must be between ${MIN_SCORE} and ${MAX_SCORE}` },
      { status: 400 },
    )
  }

  const upsertData: Record<string, unknown> = {
    item_id,
    author: authorName,
    score: finalScore,
    scores,
    // Forward-compat typed columns (only set when present among the dimensions).
    appearance_score: scores.appearance_score ?? null,
    practicality_score: scores.practicality_score ?? null,
    value_score: scores.value_score ?? null,
  }

  const { data, error } = await supabaseAdmin
    .from('ratings')
    .upsert(upsertData, { onConflict: 'item_id,author' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
