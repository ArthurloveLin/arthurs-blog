import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminRequest } from '@/lib/auth'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .select('*, items(count)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { title, note, budget } = await request.json()
  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 12)

  const { data, error } = await supabaseAdmin
    .from('sessions')
    .insert({ title: title || null, note: note || null, budget: budget || null, token })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
