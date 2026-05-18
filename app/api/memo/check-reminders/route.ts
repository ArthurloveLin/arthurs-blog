import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendNtfyReminder } from '@/lib/ntfy'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://arthurlovegrace.top'
const REMINDER_TOKEN = process.env.REMINDER_CHECK_TOKEN

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (REMINDER_TOKEN && token !== REMINDER_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date().toISOString()

  const { data: dueMemos, error } = await supabaseAdmin
    .from('comments')
    .select('id, author, content, due_at')
    .eq('target_type', 'memo')
    .eq('archived', false)
    .lte('due_at', now)
    .is('notified_at', null)
    .not('due_at', 'is', null)
    .limit(20)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!dueMemos || dueMemos.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  let sent = 0
  const errors: string[] = []

  for (const memo of dueMemos) {
    try {
      const snippet = memo.content.slice(0, 100).replace(/\n/g, ' ')
      const title = `Memo 截止提醒 · ${memo.author}`
      const body = snippet.length < memo.content.length ? `${snippet}…` : snippet

      await sendNtfyReminder(title, body, `${SITE_URL}/memo`)

      await supabaseAdmin
        .from('comments')
        .update({ notified_at: now })
        .eq('id', memo.id)

      sent++
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
  }

  return NextResponse.json({ sent, errors: errors.length > 0 ? errors : undefined })
}
