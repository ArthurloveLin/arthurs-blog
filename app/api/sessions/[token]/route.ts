import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { deleteR2Object } from '@/lib/r2'
import { isAdminRequest } from '@/lib/auth'

const WARDROBE_BUCKET = process.env.R2_WARDROBE_BUCKET!

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { token } = await params
  const body = await req.json() as Record<string, unknown>

  const allowed = ['archived', 'title', 'note', 'budget']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('sessions')
    .update(update)
    .eq('token', token)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { token } = await params

  // 先查出 session id
  const { data: session, error: sessionError } = await supabaseAdmin
    .from('sessions')
    .select('id')
    .eq('token', token)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // 删除 Storage 图片
  const { data: items } = await supabaseAdmin
    .from('items')
    .select('image_path')
    .eq('session_id', session.id)

  if (items && items.length > 0) {
    const paths = items.map((i) => i.image_path).filter(Boolean)
    await Promise.all(paths.map((path) => deleteR2Object(WARDROBE_BUCKET, path)))
  }

  const { error } = await supabaseAdmin.from('sessions').delete().eq('id', session.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
