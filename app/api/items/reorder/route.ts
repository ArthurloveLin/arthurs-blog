import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isAdminRequest } from '@/lib/auth'

export async function POST(request: NextRequest) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { ids } = await request.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 })
  }

  const updates = ids.map((id: string, idx: number) => ({ id, position: idx }))
  const { error } = await supabaseAdmin
    .from('items')
    .upsert(updates, { onConflict: 'id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
