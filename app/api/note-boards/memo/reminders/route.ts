import { NextRequest, NextResponse } from 'next/server'
import { getUserRole } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const role = await getUserRole()
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null) as {
    memo_id?: string
    label?: string
    due_at?: string
    repeat_mode?: string
    repeat_days?: number[] | null
  } | null

  if (!body?.memo_id || !body?.due_at) {
    return NextResponse.json({ error: 'memo_id and due_at are required' }, { status: 400 })
  }

  if (isNaN(Date.parse(body.due_at))) {
    return NextResponse.json({ error: 'Invalid due_at' }, { status: 400 })
  }

  const repeatMode = body.repeat_mode ?? 'once'
  const validModes = ['once', 'daily', 'weekdays', 'custom']
  if (!validModes.includes(repeatMode)) {
    return NextResponse.json({ error: 'Invalid repeat_mode' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('memo_reminders')
    .insert({
      memo_id: body.memo_id,
      label: (body.label ?? '').slice(0, 200),
      due_at: body.due_at,
      repeat_mode: repeatMode,
      repeat_days: repeatMode === 'custom' && Array.isArray(body.repeat_days) ? body.repeat_days : null,
    })
    .select('id, memo_id, label, due_at, repeat_mode, repeat_days, notified_at, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
