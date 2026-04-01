import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const { ids } = await request.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 })
  }

  const { data: items, error: fetchError } = await supabaseAdmin
    .from('items')
    .select('image_path')
    .in('id', ids)

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

  const paths = (items ?? []).map((i) => i.image_path).filter(Boolean)
  if (paths.length > 0) {
    await supabaseAdmin.storage.from('wardrobe').remove(paths)
  }

  const { error } = await supabaseAdmin.from('items').delete().in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
