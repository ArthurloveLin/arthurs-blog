import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const target_type = searchParams.get('target_type')
  const target_id = searchParams.get('target_id')

  if (!target_type || !target_id) {
    return NextResponse.json({ error: 'Missing target_type or target_id' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('comments')
    .select('id, author, content, created_at, updated_at, parent_id')
    .eq('target_type', target_type)
    .eq('target_id', target_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const { target_type, target_id, author, content, parent_id } = await req.json()

  if (!target_type || !target_id || !author?.trim() || !content?.trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('comments')
    .insert({
      target_type,
      target_id,
      ...(target_type === 'wardrobe_item' ? { item_id: target_id } : {}),
      author: author.trim(),
      content: content.trim(),
      parent_id: parent_id ?? null,
    })
    .select('id, author, content, created_at, updated_at, parent_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
