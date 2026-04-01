import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PUT(req: NextRequest) {
  const { item_id, author, score } = await req.json()

  if (!item_id || !author || score == null) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('ratings')
    .upsert({ item_id, author, score }, { onConflict: 'item_id,author' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
